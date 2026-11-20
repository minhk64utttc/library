import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  IncidentCreate,
  IncidentDecisionInput,
  IncidentDto,
  IncidentInfo,
  IncidentRequestInfo,
  IncidentStatus,
  PageQuery,
  Paginated,
} from '@thu-vien/shared';

import { Clock } from '../../common/clock/clock';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CopyAvailabilityService } from '../circulation/copy-availability.service';

const INCIDENT_INCLUDE = {
  copy: { include: { edition: { include: { work: true } } } },
  reportedBy: { include: { profile: true } },
  decidedBy: { include: { profile: true } },
} as const;

type IncidentWithRelations = Prisma.IncidentGetPayload<{ include: typeof INCIDENT_INCLUDE }>;

export interface IncidentListQuery extends PageQuery {
  status?: IncidentStatus;
}

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly availability: CopyAvailabilityService,
  ) {}

  async list({ page, pageSize, status }: IncidentListQuery): Promise<Paginated<IncidentDto>> {
    const where: Prisma.IncidentWhereInput = status ? { status } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.incident.findMany({
        where,
        include: INCIDENT_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.incident.count({ where }),
    ]);
    return { items: rows.map((row) => this.toDto(row)), total, page, pageSize };
  }

  async create(input: IncidentCreate, actorId: string): Promise<IncidentDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      // Serialize reports for the same copy so two open cases cannot be created together.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Copy" WHERE id = ${input.copyId} FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy bản sao' });
      }
      const existing = await tx.incident.findFirst({
        where: { copyId: input.copyId, status: { not: 'resolved' } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({ code: 'OPEN_INCIDENT', message: 'Bản sao đã có hồ sơ sự cố đang xử lý' });
      }
      const inventoryCase = await tx.inventoryItem.findFirst({
        where: { copyId: input.copyId, result: 'pending_search', run: { closedAt: null } },
        select: { id: true },
      });
      if (inventoryCase) {
        throw new ConflictException({ code: 'OPEN_INVENTORY', message: 'Bản sao đang được tra soát trong đợt kiểm kê; hãy xử lý tại mục Kiểm kê' });
      }
      const copy = await tx.copy.findUniqueOrThrow({ where: { id: input.copyId }, select: { status: true } });
      const activeLoan = await tx.loan.findFirst({
        where: { copyId: input.copyId, status: 'active' },
        select: { id: true },
      });
      if ((copy.status === 'on_loan') !== Boolean(activeLoan)) {
        throw new ConflictException({ code: 'COPY_STATE_MISMATCH', message: 'Cần tra soát khoản mượn của bản sao' });
      }
      if (['reserved', 'lost', 'withdrawn'].includes(copy.status)) {
        throw new BadRequestException({ code: 'INVALID_COPY_STATE', message: 'Không thể mở hồ sơ từ trạng thái bản sao hiện tại' });
      }
      if (copy.status === 'available') {
        await tx.copy.update({ where: { id: input.copyId }, data: { status: 'processing' } });
      }
      const incident = await tx.incident.create({
        data: {
          copyId: input.copyId,
          loanId: activeLoan?.id,
          reportedById: actorId,
          kind: input.kind,
          copyStatusAtReport: copy.status,
          description: input.description,
          evidence: input.evidence ?? null,
        },
        include: INCIDENT_INCLUDE,
      });
      await tx.incidentEvent.create({
        data: { incidentId: incident.id, actorId, action: 'reported', note: input.description },
      });
      return incident;
    });
    return this.toDto(created);
  }

  async addInfo(id: string, input: IncidentInfo, actorId: string): Promise<IncidentDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.findUnique({ where: { id }, select: { status: true, evidence: true } });
      if (!incident) this.notFound();
      if (incident.status !== 'new' && incident.status !== 'need_info') this.invalidState();

      const changed = await tx.incident.updateMany({
        where: { id, status: incident.status },
        data: {
          evidence: [incident.evidence, input.evidence].filter(Boolean).join('\n\n'),
          status: 'under_review',
          requestInfo: null,
        },
      });
      if (changed.count === 0) this.changed();
      await tx.incidentEvent.create({ data: { incidentId: id, actorId, action: 'info_added', note: input.evidence } });
      return tx.incident.findUniqueOrThrow({ where: { id }, include: INCIDENT_INCLUDE });
    });
    return this.toDto(updated);
  }

  async submit(id: string, actorId: string): Promise<IncidentDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.incident.updateMany({ where: { id, status: 'new' }, data: { status: 'under_review' } });
      if (changed.count === 0) await this.assertExistsOrInvalid(tx, id);
      await tx.incidentEvent.create({ data: { incidentId: id, actorId, action: 'submitted' } });
      return tx.incident.findUniqueOrThrow({ where: { id }, include: INCIDENT_INCLUDE });
    });
    return this.toDto(updated);
  }

  async requestInfo(id: string, input: IncidentRequestInfo, actorId: string): Promise<IncidentDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.incident.updateMany({
        where: { id, status: 'under_review' },
        data: { status: 'need_info', requestInfo: input.requestInfo },
      });
      if (changed.count === 0) await this.assertExistsOrInvalid(tx, id);
      await tx.incidentEvent.create({ data: { incidentId: id, actorId, action: 'info_requested', note: input.requestInfo } });
      return tx.incident.findUniqueOrThrow({ where: { id }, include: INCIDENT_INCLUDE });
    });
    return this.toDto(updated);
  }

  async decide(id: string, input: IncidentDecisionInput, actorId: string): Promise<IncidentDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.findUnique({ where: { id }, select: { copyId: true, loanId: true } });
      if (!incident) this.notFound();
      // Return processing locks the loan before the copy. Keep the same order.
      if (incident.loanId) {
        await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${incident.loanId} FOR UPDATE`;
      }
      await tx.$queryRaw`SELECT id FROM "Copy" WHERE id = ${incident.copyId} FOR UPDATE`;
      const current = await tx.incident.findUnique({ where: { id }, include: { copy: true, loan: true } });
      if (!current || current.status !== 'under_review') this.invalidState();

      if (input.decision === 'confirmed_lost') {
        if (current.loanId) {
          if (current.copy.status !== 'on_loan' || current.loan?.status !== 'active') {
            throw new ConflictException({ code: 'LOAN_CHANGED', message: 'Khoản mượn đã thay đổi, cần tra soát lại' });
          }
          const closed = await tx.loan.updateMany({
            where: { id: current.loanId, status: 'active' },
            data: { status: 'lost' },
          });
          if (closed.count === 0) this.changed();
        } else {
          const wasAvailableAndQuarantined = current.copyStatusAtReport === 'available' && current.copy.status === 'processing';
          if (!wasAvailableAndQuarantined && current.copy.status !== 'pending_search') this.invalidCopyState();
          const activeLoan = await tx.loan.findFirst({ where: { copyId: current.copyId, status: 'active' }, select: { id: true } });
          if (activeLoan) this.changed();
        }
        await tx.copy.update({ where: { id: current.copyId }, data: { status: 'lost' } });
      }
      if (input.decision === 'confirmed_damaged') {
        if (current.copy.status === 'on_loan') {
          if (!current.loan || current.loan.status !== 'active') this.invalidCopyState();
          // The copy stays on loan until physically returned; return processing applies the damage.
        } else {
          if (!['available', 'processing', 'pending_search'].includes(current.copy.status)) this.invalidCopyState();
          await tx.copy.update({ where: { id: current.copyId }, data: { status: 'damaged' } });
        }
      }
      if (input.decision === 'no_change' && current.copy.status === 'processing' &&
          ['available', 'on_loan'].includes(current.copyStatusAtReport)) {
        if (!current.copy.locationId) {
          throw new BadRequestException({ code: 'LOCATION_REQUIRED', message: 'Cần gán vị trí trước khi đưa bản sao trở lại phục vụ' });
        }
        await this.availability.release(tx, current.copyId, current.copy.editionId, this.clock.now());
      }

      const changed = await tx.incident.updateMany({
        where: { id, status: 'under_review' },
        data: {
          status: 'resolved',
          decision: input.decision,
          decisionReason: input.reason,
          decidedById: actorId,
          decidedAt: this.clock.now(),
        },
      });
      if (changed.count === 0) this.changed();
      await tx.incidentEvent.create({ data: { incidentId: id, actorId, action: 'decided', note: `${input.decision}: ${input.reason}` } });
      return tx.incident.findUniqueOrThrow({ where: { id }, include: INCIDENT_INCLUDE });
    });
    return this.toDto(updated);
  }

  private async assertExistsOrInvalid(tx: Prisma.TransactionClient, id: string): Promise<never> {
    const exists = await tx.incident.findUnique({ where: { id }, select: { id: true } });
    if (!exists) this.notFound();
    this.invalidState();
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy hồ sơ sự cố' });
  }

  private invalidState(): never {
    throw new BadRequestException({ code: 'INVALID_STATE', message: 'Hồ sơ không ở trạng thái cho phép thao tác này' });
  }

  private invalidCopyState(): never {
    throw new BadRequestException({ code: 'INVALID_COPY_STATE', message: 'Hiện trạng bản sao không phù hợp quyết định' });
  }

  private changed(): never {
    throw new ConflictException({ code: 'INCIDENT_CHANGED', message: 'Hồ sơ vừa được thay đổi, hãy tải lại' });
  }

  private toDto(row: IncidentWithRelations): IncidentDto {
    return {
      id: row.id,
      copyId: row.copyId,
      copyCode: row.copy.code,
      workTitle: row.copy.edition.work.title,
      loanId: row.loanId,
      kind: row.kind,
      status: row.status,
      description: row.description,
      evidence: row.evidence,
      requestInfo: row.requestInfo,
      decision: row.decision,
      decisionReason: row.decisionReason,
      reportedByName: row.reportedBy.profile?.fullName ?? row.reportedBy.email,
      decidedByName: row.decidedBy?.profile?.fullName ?? row.decidedBy?.email ?? null,
      createdAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
    };
  }
}
