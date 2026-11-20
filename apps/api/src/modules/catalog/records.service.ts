import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CatalogRecordDto,
  EditionInput,
  RecordListQuery,
  Paginated,
  RecordInput,
  RecordStatus,
  RecordUpdate,
} from '@thu-vien/shared';

import { Clock } from '../../common/clock/clock';
import { isRecordNotFound, isUniqueViolation } from '../../common/prisma/errors';
import { PrismaService } from '../../infrastructure/database/prisma.service';

type WorkWithEditions = Prisma.WorkGetPayload<{ include: { editions: { include: { publisher: true } } } }>;

const EDITABLE_STATUSES: readonly RecordStatus[] = ['draft', 'withdrawn'];

@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async list({ page, pageSize, status, q, sort, rejected }: RecordListQuery): Promise<Paginated<CatalogRecordDto>> {
    const where: Prisma.WorkWhereInput = {
      ...(status ? { status } : {}),
      ...(rejected === 'true' ? { rejectReason: { not: null } } : {}),
      ...(q ? { OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { author: { contains: q, mode: 'insensitive' } },
        { editions: { some: { isbn: { contains: q, mode: 'insensitive' } } } },
      ] } : {}),
    };
    const orderBy: Prisma.WorkOrderByWithRelationInput[] = sort === 'title'
      ? [{ title: 'asc' }, { id: 'asc' }]
      : sort === 'oldest' ? [{ createdAt: 'asc' }, { id: 'asc' }]
      : [{ updatedAt: 'desc' }, { id: 'asc' }];

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.work.findMany({
        where,
        include: { editions: { include: { publisher: true } } },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.work.count({ where }),
    ]);

    return { items: rows.map((row) => this.toDto(row)), total, page, pageSize };
  }

  async get(id: string): Promise<CatalogRecordDto> {
    const row = await this.prisma.work.findUnique({ where: { id }, include: { editions: { include: { publisher: true } } } });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi' });
    }
    return this.toDto(row);
  }

  async setCallNumber(recordId: string, editionId: string, callNumber: string): Promise<CatalogRecordDto> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Edition" WHERE id = ${editionId} FOR UPDATE`;
      const edition = await tx.edition.findUnique({
        where: { id: editionId },
        select: { workId: true, callNumber: true },
      });
      if (!edition || edition.workId !== recordId) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy ấn bản' });
      }
      const work = await tx.work.findUnique({ where: { id: recordId }, select: { status: true } });
      if (!work) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi' });
      }
      if (work.status !== 'published') {
        throw new BadRequestException({
          code: 'INVALID_STATE',
          message: 'Chỉ gán mã xếp giá sau khi công bố bản ghi',
        });
      }
      const copyCount = await tx.copy.count({ where: { editionId } });
      // Legacy copies may already have CP-prefixed barcodes; preserve those codes.
      const isChangingAssignedCallNumber = edition.callNumber !== null && edition.callNumber !== callNumber;
      if (copyCount > 0 && isChangingAssignedCallNumber) {
        throw new BadRequestException({
          code: 'CALL_NUMBER_IN_USE',
          message: 'Không thể đổi mã xếp giá khi ấn bản đã có bản sao',
        });
      }
      const changed = await tx.edition.updateMany({
        where: { id: editionId, workId: recordId },
        data: { callNumber },
      });
      if (changed.count === 0) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy ấn bản' });
      }
    });

    return this.get(recordId);
  }

  async create(input: RecordInput): Promise<CatalogRecordDto> {
    try {
      const created = await this.prisma.work.create({
        data: {
          title: input.title,
          author: input.author ?? null,
          subject: input.subject ?? null,
          classification: input.classification ?? null,
          editions: { create: input.editions.map((edition) => this.toEditionData(edition)) },
        },
        include: { editions: { include: { publisher: true } } },
      });
      return this.toDto(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ code: 'DUPLICATE', message: 'ISBN đã tồn tại' });
      }
      throw error;
    }
  }

  async update(id: string, input: RecordUpdate): Promise<CatalogRecordDto> {
    const current = await this.prisma.work.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi' });
    }
    if (!EDITABLE_STATUSES.includes(current.status as RecordStatus)) {
      throw new BadRequestException({
        code: 'INVALID_STATE',
        message: 'Chỉ sửa được bản ghi ở trạng thái nháp',
      });
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (input.editions) {
          await tx.edition.deleteMany({ where: { workId: id } });
        }
        return tx.work.update({
          where: { id },
          data: {
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.author !== undefined ? { author: input.author } : {}),
            ...(input.subject !== undefined ? { subject: input.subject } : {}),
            ...(input.classification !== undefined ? { classification: input.classification } : {}),
            ...(input.editions
              ? { editions: { create: input.editions.map((edition) => this.toEditionData(edition)) } }
              : {}),
          },
          include: { editions: { include: { publisher: true } } },
        });
      });
      return this.toDto(updated);
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi' });
      }
      if (isUniqueViolation(error)) {
        throw new ConflictException({ code: 'DUPLICATE', message: 'ISBN đã tồn tại' });
      }
      throw error;
    }
  }

  submit(id: string): Promise<CatalogRecordDto> {
    return this.transition(id, ['draft'], 'pending', (now) => ({
      submittedAt: now,
      rejectReason: null,
    }));
  }

  approve(id: string, actorId: string): Promise<CatalogRecordDto> {
    return this.transition(id, ['pending'], 'approved', (now) => ({
      decidedAt: now,
      decidedById: actorId,
      rejectReason: null,
    }));
  }

  reject(id: string, actorId: string, reason: string): Promise<CatalogRecordDto> {
    return this.transition(id, ['pending'], 'draft', (now) => ({
      decidedAt: now,
      decidedById: actorId,
      rejectReason: reason,
    }));
  }

  publish(id: string): Promise<CatalogRecordDto> {
    return this.transition(id, ['approved'], 'published', () => ({}));
  }

  private async transition(
    id: string,
    from: readonly RecordStatus[],
    to: RecordStatus,
    extra: (now: Date) => Prisma.WorkUpdateInput,
  ): Promise<CatalogRecordDto> {
    const result = await this.prisma.work.updateMany({
      where: { id, status: { in: [...from] } },
      data: { status: to, ...extra(this.clock.now()) },
    });

    if (result.count === 0) {
      throw new BadRequestException({
        code: 'INVALID_STATE',
        message: 'Trạng thái bản ghi không cho phép thao tác này',
      });
    }

    return this.get(id);
  }

  private toEditionData(input: EditionInput): Prisma.EditionCreateWithoutWorkInput {
    return {
      isbn: input.isbn && input.isbn.length > 0 ? input.isbn : null,
      language: input.language ?? null,
      publishYear: input.publishYear ?? null,
      editionNo: input.editionNo ?? null,
      callNumber: input.callNumber ?? null,
      ...(input.publisherId ? { publisher: { connect: { id: input.publisherId } } } : {}),
    };
  }

  private toDto(row: WorkWithEditions): CatalogRecordDto {
    return {
      id: row.id,
      title: row.title,
      author: row.author,
      subject: row.subject,
      classification: row.classification,
      status: row.status,
      rejectReason: row.rejectReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      editions: row.editions.map((edition) => ({
        id: edition.id,
        publisherId: edition.publisherId,
        publisherName: edition.publisher?.name ?? null,
        isbn: edition.isbn,
        language: edition.language,
        publishYear: edition.publishYear,
        editionNo: edition.editionNo,
        callNumber: edition.callNumber,
      })),
    };
  }
}
