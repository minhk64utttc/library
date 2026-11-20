import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PageQuery,
  Paginated,
  ReservationCreate,
  ReservationDto,
  ReservationStatus,
} from '@thu-vien/shared';

import { Clock } from '../../common/clock/clock';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PolicyService } from './policy.service';
import { CardsService } from './cards.service';

const RESERVATION_INCLUDE = {
  edition: { include: { work: true } },
  borrower: { include: { profile: true } },
} as const;

type ReservationWithRelations = Prisma.ReservationGetPayload<{
  include: typeof RESERVATION_INCLUDE;
}>;

export interface ReservationListQuery extends PageQuery {
  status?: ReservationStatus;
  editionId?: string;
  borrowerId?: string;
}

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly clock: Clock,
    private readonly cards: CardsService,
  ) {}

  async list({
    page,
    pageSize,
    status,
    editionId,
    borrowerId,
  }: ReservationListQuery): Promise<Paginated<ReservationDto>> {
    const where: Prisma.ReservationWhereInput = {
      ...(status ? { status } : {}),
      ...(editionId ? { editionId } : {}),
      ...(borrowerId ? { borrowerId } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        include: RESERVATION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return { items: rows.map((row) => this.toDto(row)), total, page, pageSize };
  }

  async create(input: ReservationCreate): Promise<ReservationDto> {
    const now = this.clock.now();
    const created = await this.prisma.$transaction(async (tx) => {
      await this.cards.assertUsable(tx, input.borrowerId, now);
      await tx.$queryRaw`SELECT id FROM "Edition" WHERE id = ${input.editionId} FOR UPDATE`;
      const edition = await tx.edition.findUnique({
        where: { id: input.editionId },
        select: {
          id: true,
          work: { select: { status: true } },
          copies: { where: { status: 'available' }, select: { id: true }, take: 1 },
        },
      });
      if (!edition || edition.work.status !== 'published') {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy ấn bản' });
      }
      if (edition.copies.length > 0) {
        throw new BadRequestException({ code: 'COPY_AVAILABLE', message: 'Ấn bản vẫn còn bản sao sẵn sàng; vui lòng liên hệ quầy mượn trả' });
      }

      const existing = await tx.reservation.findFirst({
        where: {
          editionId: input.editionId,
          borrowerId: input.borrowerId,
          status: { in: ['waiting', 'ready_for_pickup'] },
        },
      });
      if (existing) {
        throw new BadRequestException({
          code: 'DUPLICATE',
          message: 'Bạn đọc đã có đặt trước cho ấn bản này',
        });
      }

      return tx.reservation.create({
        data: { editionId: input.editionId, borrowerId: input.borrowerId },
        include: RESERVATION_INCLUDE,
      });
    });
    return this.toDto(created);
  }

  async cancel(id: string): Promise<ReservationDto> {
    const now = this.clock.now();

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findUnique({
        where: { id },
        select: { editionId: true, status: true },
      });
      if (!current) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy đặt trước' });
      }

      const changed = await tx.reservation.updateMany({
        where: { id, status: { in: ['waiting', 'ready_for_pickup'] } },
        data: { status: 'cancelled' },
      });
      if (changed.count === 0) {
        throw new BadRequestException({
          code: 'INVALID_STATE',
          message: 'Đặt trước không thể hủy ở trạng thái hiện tại',
        });
      }

      await this.rebalance(tx, current.editionId, now);
      return tx.reservation.findUniqueOrThrow({ where: { id }, include: RESERVATION_INCLUDE });
    });

    return this.toDto(updated);
  }

  async releaseExpired(): Promise<number> {
    const now = this.clock.now();
    const expired = await this.prisma.reservation.findMany({
      where: { status: 'ready_for_pickup', expiresAt: { lt: now } },
      select: { id: true, editionId: true },
    });

    let released = 0;
    for (const hold of expired) {
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.reservation.updateMany({
          where: { id: hold.id, status: 'ready_for_pickup' },
          data: { status: 'expired' },
        });
        if (changed.count === 0) {
          return;
        }
        released += 1;
        await this.rebalance(tx, hold.editionId, now);
      });
    }

    return released;
  }

  private async rebalance(
    tx: Prisma.TransactionClient,
    editionId: string,
    now: Date,
  ): Promise<void> {
    const reservedCopies = await tx.copy.count({ where: { editionId, status: 'reserved' } });
    const readyHolds = await tx.reservation.count({
      where: { editionId, status: 'ready_for_pickup' },
    });

    let surplus = reservedCopies - readyHolds;
    while (surplus > 0) {
      const next = await tx.reservation.findFirst({
        where: { editionId, status: 'waiting' },
        orderBy: { createdAt: 'asc' },
        include: { borrower: { include: { profile: true } } },
      });

      if (next) {
        const [edition, copy] = await Promise.all([
          tx.edition.findUnique({ where: { id: editionId }, select: { work: { select: { classification: true } } } }),
          tx.copy.findFirst({ where: { editionId, status: 'reserved' }, include: { location: true } }),
        ]);
        const policy = await this.policy.read(tx, {
          readerGroup: (next.borrower.profile?.readerGroup ?? 'student') as 'student' | 'lecturer' | 'staff' | 'other',
          materialType: edition?.work.classification ?? undefined,
          branchCode: copy?.location?.code,
        });
        await tx.reservation.update({
          where: { id: next.id },
          data: {
            status: 'ready_for_pickup',
            readyAt: now,
            expiresAt: this.policy.addServiceDays(now, policy.holdDays, policy.serviceOpenDays, policy.serviceClosesAt),
          },
        });
      } else {
        const copy = await tx.copy.findFirst({ where: { editionId, status: 'reserved' } });
        if (!copy) {
          break;
        }
        await tx.copy.update({ where: { id: copy.id }, data: { status: 'available' } });
      }
      surplus -= 1;
    }
  }

  private toDto(row: ReservationWithRelations): ReservationDto {
    return {
      id: row.id,
      editionId: row.editionId,
      workTitle: row.edition.work.title,
      borrowerId: row.borrowerId,
      borrowerName: row.borrower.profile?.fullName ?? null,
      status: row.status,
      readyAt: row.readyAt ? row.readyAt.toISOString() : null,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
