import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  LibraryCardAction,
  LibraryCardBorrowerDto,
  LibraryCardCreate,
  LibraryCardDto,
  LibraryCardListQuery,
  LibraryCardRenew,
  Paginated,
} from '@thu-vien/shared';

import { Clock } from '../../common/clock/clock';
import { isUniqueViolation } from '../../common/prisma/errors';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const CARD_INCLUDE = {
  account: { include: { profile: true } },
  events: { include: { actor: { include: { profile: true } } }, orderBy: { createdAt: 'desc' }, take: 25 },
} as const;

type CardWithRelations = Prisma.LibraryCardGetPayload<{ include: typeof CARD_INCLUDE }>;

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService, private readonly clock: Clock) {}

  async list(query: LibraryCardListQuery): Promise<Paginated<LibraryCardDto>> {
    const now = this.clock.now();
    const where: Prisma.LibraryCardWhereInput = {
      ...(query.status === 'active' ? { status: 'active', expiresAt: { gte: now } } : {}),
      ...(query.status === 'locked' ? { status: 'locked' } : {}),
      ...(query.status === 'expired' ? { status: 'active', expiresAt: { lt: now } } : {}),
      ...(query.q
        ? {
            OR: [
              { cardNumber: { contains: query.q, mode: 'insensitive' } },
              { account: { email: { contains: query.q, mode: 'insensitive' } } },
              { account: { profile: { fullName: { contains: query.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.libraryCard.findMany({
        where,
        include: CARD_INCLUDE,
        orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.libraryCard.count({ where }),
    ]);
    return { items: rows.map((row) => this.toDto(row, now)), total, page: query.page, pageSize: query.pageSize };
  }

  async borrowers(q?: string): Promise<LibraryCardBorrowerDto[]> {
    const term = q?.trim();
    const rows = await this.prisma.account.findMany({
      where: {
        status: 'active',
        roles: { some: { role: 'reader' } },
        libraryCard: null,
        ...(term
          ? {
              OR: [
                { email: { contains: term, mode: 'insensitive' } },
                { profile: { fullName: { contains: term, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: { profile: true },
      orderBy: { email: 'asc' },
      take: 20,
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.profile?.fullName ?? row.email,
    }));
  }

  async issue(input: LibraryCardCreate, actorId: string): Promise<LibraryCardDto> {
    const now = this.clock.now();
    const expiresAt = this.expirationDate(input.expiresOn);
    if (expiresAt <= now) {
      throw new BadRequestException({ code: 'INVALID_EXPIRY', message: 'Ngày hết hạn phải là ngày trong tương lai' });
    }

    try {
      const card = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${input.accountId} FOR UPDATE`;
        const account = await tx.account.findFirst({
          where: { id: input.accountId, status: 'active', roles: { some: { role: 'reader' } } },
          select: { id: true },
        });
        if (!account) {
          throw new NotFoundException({ code: 'READER_NOT_FOUND', message: 'Không tìm thấy bạn đọc đang hoạt động' });
        }
        const existing = await tx.libraryCard.findUnique({ where: { accountId: input.accountId }, select: { id: true } });
        if (existing) {
          throw new ConflictException({ code: 'CARD_EXISTS', message: 'Bạn đọc đã có thẻ, hãy dùng chức năng gia hạn hoặc khóa thẻ' });
        }
        const created = await tx.libraryCard.create({
          data: { accountId: input.accountId, cardNumber: input.cardNumber, expiresAt },
        });
        await tx.libraryCardEvent.create({
          data: { cardId: created.id, actorId, action: 'issued', reason: 'Cấp thẻ mới', newExpiresAt: expiresAt },
        });
        return tx.libraryCard.findUniqueOrThrow({ where: { id: created.id }, include: CARD_INCLUDE });
      });
      return this.toDto(card, now);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ code: 'CARD_NUMBER_IN_USE', message: 'Mã thẻ đã được sử dụng' });
      }
      throw error;
    }
  }

  async renew(id: string, input: LibraryCardRenew, actorId: string): Promise<LibraryCardDto> {
    const now = this.clock.now();
    const newExpiresAt = this.expirationDate(input.expiresOn);
    if (newExpiresAt <= now) {
      throw new BadRequestException({ code: 'INVALID_EXPIRY', message: 'Ngày hết hạn phải là ngày trong tương lai' });
    }
    const card = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "LibraryCard" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.libraryCard.findUnique({ where: { id }, select: { expiresAt: true } });
      if (!current) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy thẻ bạn đọc' });
      }
      if (newExpiresAt <= current.expiresAt) {
        throw new BadRequestException({ code: 'INVALID_EXPIRY', message: 'Ngày mới phải sau ngày hết hạn hiện tại' });
      }
      const updated = await tx.libraryCard.update({ where: { id }, data: { expiresAt: newExpiresAt } });
      await tx.libraryCardEvent.create({
        data: {
          cardId: id,
          actorId,
          action: 'renewed',
          reason: input.reason?.trim() || null,
          previousExpiresAt: current.expiresAt,
          newExpiresAt,
        },
      });
      return tx.libraryCard.findUniqueOrThrow({ where: { id: updated.id }, include: CARD_INCLUDE });
    });
    return this.toDto(card, now);
  }

  async lock(id: string, input: LibraryCardAction, actorId: string): Promise<LibraryCardDto> {
    return this.changeStatus(id, 'active', 'locked', input.reason, actorId);
  }

  async unlock(id: string, input: LibraryCardAction, actorId: string): Promise<LibraryCardDto> {
    return this.changeStatus(id, 'locked', 'active', input.reason, actorId);
  }

  async assertUsable(tx: Prisma.TransactionClient, accountId: string, now: Date): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR UPDATE`;
    const account = await tx.account.findUnique({ where: { id: accountId }, select: { status: true } });
    if (!account || account.status !== 'active') {
      throw new BadRequestException({ code: 'INVALID_BORROWER', message: 'Tài khoản bạn đọc không hoạt động' });
    }
    await tx.$queryRaw`SELECT id FROM "LibraryCard" WHERE "accountId" = ${accountId} FOR UPDATE`;
    const card = await tx.libraryCard.findUnique({ where: { accountId }, select: { status: true, expiresAt: true } });
    if (!card) {
      throw new BadRequestException({ code: 'CARD_MISSING', message: 'Bạn đọc chưa được cấp thẻ thư viện' });
    }
    if (card.status === 'locked') {
      throw new BadRequestException({ code: 'CARD_LOCKED', message: 'Thẻ thư viện đang bị khóa' });
    }
    if (card.expiresAt < now) {
      throw new BadRequestException({ code: 'CARD_EXPIRED', message: 'Thẻ thư viện đã hết hạn' });
    }
  }

  private async changeStatus(
    id: string,
    from: 'active' | 'locked',
    to: 'active' | 'locked',
    reason: string,
    actorId: string,
  ): Promise<LibraryCardDto> {
    const now = this.clock.now();
    const card = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "LibraryCard" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.libraryCard.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy thẻ bạn đọc' });
      }
      if (current.status !== from) {
        throw new BadRequestException({ code: 'INVALID_STATE', message: 'Trạng thái thẻ vừa thay đổi; hãy tải lại danh sách' });
      }
      if (to === 'active' && current.expiresAt < now) {
        throw new BadRequestException({ code: 'CARD_EXPIRED', message: 'Cần gia hạn thẻ trước khi mở khóa' });
      }
      const updated = await tx.libraryCard.update({
        where: { id },
        data: {
          status: to,
          lockedAt: to === 'locked' ? now : null,
          lockReason: to === 'locked' ? reason : null,
        },
      });
      await tx.libraryCardEvent.create({
        data: { cardId: id, actorId, action: to, reason: reason.trim() },
      });
      return tx.libraryCard.findUniqueOrThrow({ where: { id: updated.id }, include: CARD_INCLUDE });
    });
    return this.toDto(card, now);
  }

  private expirationDate(value: string): Date {
    // Treat expiry as the end of the selected calendar day in Vietnam (UTC+7).
    return new Date(`${value}T16:59:59.999Z`);
  }

  private dateOnly(value: Date): string {
    return new Date(value.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private toDto(row: CardWithRelations, now: Date): LibraryCardDto {
    const status = row.status === 'locked' ? 'locked' : row.expiresAt < now ? 'expired' : 'active';
    return {
      id: row.id,
      accountId: row.accountId,
      borrowerName: row.account.profile?.fullName ?? row.account.email,
      borrowerEmail: row.account.email,
      cardNumber: row.cardNumber,
      status,
      expiresOn: this.dateOnly(row.expiresAt),
      lockedAt: row.lockedAt?.toISOString() ?? null,
      lockReason: row.lockReason,
      events: row.events.map((event) => ({
        id: event.id,
        actorName: event.actor.profile?.fullName ?? event.actor.email,
        action: event.action,
        reason: event.reason,
        previousExpiresOn: event.previousExpiresAt ? this.dateOnly(event.previousExpiresAt) : null,
        newExpiresOn: event.newExpiresAt ? this.dateOnly(event.newExpiresAt) : null,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }
}
