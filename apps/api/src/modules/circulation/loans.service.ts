import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  BorrowerDto,
  LoanDto,
  LoanCopyOption,
  LoanInput,
  LoanStatus,
  PageQuery,
  Paginated,
} from '@thu-vien/shared';

import { Clock } from '../../common/clock/clock';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CopyAvailabilityService } from './copy-availability.service';
import { CardsService } from './cards.service';
import { PolicyService } from './policy.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const LOAN_INCLUDE = {
  copy: { include: { edition: { include: { work: true, reservations: { where: { OR: [{ status: 'waiting' }, { status: 'ready_for_pickup' }] }, select: { id: true }, take: 1 } } } } },
  borrower: { include: { profile: true, libraryCard: true } },
  fine: true,
  renewals: { include: { renewedBy: { include: { profile: true } } }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.LoanInclude;

type LoanWithRelations = Prisma.LoanGetPayload<{ include: typeof LOAN_INCLUDE }>;

export interface LoanListQuery extends PageQuery {
  status?: LoanStatus;
  borrowerId?: string;
  overdue?: boolean;
  q?: string;
  copyCode?: string;
  sort?: 'newest' | 'due_asc' | 'due_desc';
}

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly clock: Clock,
    private readonly availability: CopyAvailabilityService,
    private readonly cards: CardsService,
  ) {}

  async list({
    page,
    pageSize,
    status,
    borrowerId,
    overdue,
    q,
    copyCode,
    sort = 'newest',
  }: LoanListQuery): Promise<Paginated<LoanDto>> {
    const now = this.clock.now();
    const where: Prisma.LoanWhereInput = {
      ...(q ? { OR: [
        { copy: { code: { contains: q, mode: 'insensitive' as const } } },
        { copy: { edition: { work: { title: { contains: q, mode: 'insensitive' as const } } } } },
        { borrower: { profile: { fullName: { contains: q, mode: 'insensitive' as const } } } },
      ] } : {}),
      ...(copyCode ? { copy: { code: copyCode } } : {}),
      ...(status ? { status } : {}),
      ...(borrowerId ? { borrowerId } : {}),
      ...(overdue ? { status: 'active', dueAt: { lt: now } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.loan.findMany({
        where,
        include: LOAN_INCLUDE,
        orderBy: [sort === 'newest' ? { borrowedAt: 'desc' } : { dueAt: sort === 'due_asc' ? 'asc' : 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.loan.count({ where }),
    ]);

    return { items: rows.map((row) => this.toDto(row, now)), total, page, pageSize };
  }

  async borrow(input: LoanInput): Promise<LoanDto> {
    const now = this.clock.now();

    const loan = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${input.borrowerId} FOR UPDATE`;

      const borrower = await tx.account.findUnique({
        where: { id: input.borrowerId },
        select: { id: true, status: true, profile: { select: { readerGroup: true } } },
      });
      if (!borrower || borrower.status !== 'active') {
        throw new BadRequestException({
          code: 'INVALID_BORROWER',
          message: 'Bạn đọc không hợp lệ',
        });
      }
      await this.cards.assertUsable(tx, borrower.id, now);

      const copy = await tx.copy.findUnique({
        where: { id: input.copyId },
        select: {
          status: true, editionId: true, location: { select: { code: true } },
          edition: { select: { work: { select: { classification: true } } } },
        },
      });
      if (!copy) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy bản sao' });
      }
      const policy = await this.policy.read(tx, {
        readerGroup: (borrower.profile?.readerGroup ?? 'student') as 'student' | 'lecturer' | 'staff' | 'other',
        materialType: copy.edition.work.classification ?? undefined,
        branchCode: copy.location?.code,
      });
      const activeLoans = await tx.loan.count({ where: { borrowerId: input.borrowerId, status: 'active' } });
      if (activeLoans >= policy.maxActiveLoans) {
        throw new BadRequestException({ code: 'LOAN_LIMIT', message: 'Borrower has reached the active loan limit.' });
      }
      if (copy.status !== 'available' && copy.status !== 'reserved') {
        throw new BadRequestException({
          code: 'COPY_UNAVAILABLE',
          message: 'Bản sao không sẵn sàng cho mượn',
        });
      }
      if (await tx.incident.count({ where: { copyId: input.copyId, status: { not: 'resolved' } } })) {
        throw new BadRequestException({ code: 'OPEN_INCIDENT', message: 'Bản sao đang được tra soát sự cố' });
      }

      const hold =
        copy.status === 'reserved'
          ? await tx.reservation.findFirst({
              where: {
                editionId: copy.editionId,
                borrowerId: input.borrowerId,
                status: 'ready_for_pickup',
              },
              orderBy: { createdAt: 'asc' },
            })
          : null;
      if (copy.status === 'reserved' && !hold) {
        throw new BadRequestException({
          code: 'COPY_RESERVED',
          message: 'Bản sao đang được giữ cho bạn đọc khác',
        });
      }

      const taken = await tx.copy.updateMany({
        where: { id: input.copyId, status: copy.status },
        data: { status: 'on_loan' },
      });
      if (taken.count === 0) {
        throw new BadRequestException({
          code: 'COPY_UNAVAILABLE',
          message: 'Bản sao vừa được mượn bởi giao dịch khác',
        });
      }

      const loan = await tx.loan.create({
        data: {
          copyId: input.copyId,
          borrowerId: input.borrowerId,
          borrowedAt: now,
          dueAt: new Date(now.getTime() + policy.loanDays * DAY_MS),
          loanDays: policy.loanDays,
          renewLimit: policy.renewLimit,
          renewDays: policy.renewDays,
          overdueFinePerDay: policy.overdueFinePerDay,
          policyVersionId: policy.id,
        },
        include: LOAN_INCLUDE,
      });

      if (hold) {
        await tx.reservation.update({ where: { id: hold.id }, data: { status: 'fulfilled' } });
      }

      return loan;
    });

    return this.toDto(loan, now);
  }

  async returnLoan(loanId: string): Promise<LoanDto> {
    const now = this.clock.now();

    const loan = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${loanId} FOR UPDATE`;
      const current = await tx.loan.findUnique({ where: { id: loanId }, include: { copy: true } });
      if (!current) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy khoản mượn' });
      }
      if (current.status !== 'active') {
        throw new BadRequestException({
          code: 'LOAN_CLOSED',
          message: 'Khoản mượn đã được xử lý',
        });
      }

      const overdueDays = this.overdueDays(current.dueAt, now);
      const fineAmount = overdueDays * current.overdueFinePerDay;

      const closed = await tx.loan.updateMany({
        where: { id: loanId, status: 'active' },
        data: { status: 'returned', returnedAt: now },
      });
      if (closed.count === 0) {
        throw new BadRequestException({
          code: 'LOAN_CLOSED',
          message: 'Khoản mượn vừa được xử lý',
        });
      }

      if (fineAmount > 0) {
        await tx.fine.create({ data: { loanId, amount: fineAmount } });
      }

      const [confirmedDamage, openIncident] = await Promise.all([
        tx.incident.count({ where: { loanId, status: 'resolved', decision: 'confirmed_damaged' } }),
        tx.incident.count({ where: { loanId, status: { not: 'resolved' } } }),
      ]);
      if (confirmedDamage || openIncident) {
        // Confirmed damage takes precedence; otherwise quarantine until investigation ends.
        await tx.copy.update({
          where: { id: current.copyId },
          data: { status: confirmedDamage ? 'damaged' : 'processing' },
        });
      } else {
        await this.availability.release(tx, current.copyId, current.copy.editionId, now);
      }

      return tx.loan.findUniqueOrThrow({ where: { id: loanId }, include: LOAN_INCLUDE });
    });

    return this.toDto(loan, now);
  }

  async renew(loanId: string, actorId: string | null = null, channel: 'reader' | 'staff' = 'staff'): Promise<LoanDto> {
    const now = this.clock.now();

    const loan = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${loanId} FOR UPDATE`;
      const current = await tx.loan.findUnique({ where: { id: loanId }, include: { copy: true } });
      if (!current) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy khoản mượn' });
      }
      if (current.status !== 'active') {
        throw new BadRequestException({
          code: 'LOAN_CLOSED',
          message: 'Khoản mượn đã được xử lý',
        });
      }
      await this.cards.assertUsable(tx, current.borrowerId, now);
      if (current.dueAt.getTime() < now.getTime()) {
        throw new BadRequestException({
          code: 'LOAN_OVERDUE',
          message: 'Khoản mượn đã quá hạn, không gia hạn được',
        });
      }

      if (current.renewCount >= current.renewLimit) {
        throw new BadRequestException({
          code: 'RENEW_LIMIT',
          message: 'Đã hết số lần gia hạn',
        });
      }

      await tx.$queryRaw`SELECT id FROM "Edition" WHERE id = ${current.copy.editionId} FOR UPDATE`;
      const waiting = await tx.reservation.count({
        where: {
          editionId: current.copy.editionId,
          status: { in: ['waiting', 'ready_for_pickup'] },
        },
      });
      if (waiting > 0) {
        throw new BadRequestException({
          code: 'HAS_WAITING',
          message: 'Đang có người chờ, không gia hạn được',
        });
      }

      const renewedDueAt = new Date(current.dueAt.getTime() + current.renewDays * DAY_MS);
      const renewedLoan = await tx.loan.update({
        where: { id: loanId },
        data: {
          dueAt: renewedDueAt,
          renewCount: { increment: 1 },
        },
        include: LOAN_INCLUDE,
      });
      await tx.loanRenewal.create({
        data: {
          loanId,
          previousDueAt: current.dueAt,
          dueAt: renewedDueAt,
          renewedById: actorId,
          channel,
        },
      });
      await tx.auditEvent.create({
        data: { actorId, action: 'loan.renew', targetType: 'Loan', targetId: loanId, outcome: 'success' },
      });
      return tx.loan.findUniqueOrThrow({ where: { id: renewedLoan.id }, include: LOAN_INCLUDE });
    });

    return this.toDto(loan, now);
  }

  async searchBorrowers(query?: string): Promise<BorrowerDto[]> {
    const term = query?.trim();
    const exact = term ? await this.prisma.account.findFirst({
      where: { status: 'active', OR: [{ email: { equals: term, mode: 'insensitive' } }, { libraryCard: { cardNumber: { equals: term, mode: 'insensitive' } } }] },
      include: { profile: true, libraryCard: true, _count: { select: { loans: { where: { status: 'active' } } } } },
    }) : null;
    const matches = await this.prisma.account.findMany({
      where: {
        status: 'active',
        ...(exact ? { id: { not: exact.id } } : {}),
        ...(term
          ? {
              OR: [
                { email: { contains: term, mode: 'insensitive' } },
                { libraryCard: { cardNumber: { contains: term, mode: 'insensitive' } } },
                { profile: { fullName: { contains: term, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: { profile: true, libraryCard: true, _count: { select: { loans: { where: { status: 'active' } } } } },
      orderBy: [{ email: 'asc' }, { id: 'asc' }],
      take: exact ? 19 : 20,
    });

    const rows = exact ? [exact, ...matches] : matches;

    const fines = await this.prisma.fine.groupBy({
      by: ['loanId'], where: { status: 'unpaid', loan: { borrowerId: { in: rows.map((row) => row.id) } } }, _count: true,
    });
    const fineLoans = fines.length ? await this.prisma.loan.findMany({ where: { id: { in: fines.map((fine) => fine.loanId) } }, select: { borrowerId: true } }) : [];
    const now = this.clock.now();
    return rows.map((row) => ({
      id: row.id, email: row.email, fullName: row.profile?.fullName ?? null,
      cardNumber: row.libraryCard?.cardNumber ?? null,
      cardStatus: !row.libraryCard ? 'missing' : row.libraryCard.status === 'locked' ? 'locked' : row.libraryCard.expiresAt < now ? 'expired' : 'active',
      cardExpiresAt: row.libraryCard?.expiresAt.toISOString() ?? null,
      activeLoanCount: row._count.loans,
      unpaidFineCount: fineLoans.filter((loan) => loan.borrowerId === row.id).length,
    }));
  }

  async searchCopies(q: string): Promise<LoanCopyOption[]> {
    if (!q.trim()) return [];
    const exact = await this.prisma.copy.findFirst({
      where: { code: { equals: q.trim(), mode: 'insensitive' }, status: { in: ['available', 'reserved'] } },
      include: { edition: { include: { work: true } }, location: true },
    });
    const matches = await this.prisma.copy.findMany({
      where: { ...(exact ? { id: { not: exact.id } } : {}), status: { in: ['available', 'reserved'] }, OR: [
        { code: { contains: q.trim(), mode: 'insensitive' } },
        { edition: { work: { title: { contains: q.trim(), mode: 'insensitive' } } } },
      ] },
      include: { edition: { include: { work: true } }, location: true },
      orderBy: [{ code: 'asc' }, { id: 'asc' }], take: exact ? 14 : 15,
    });
    const rows = exact ? [exact, ...matches] : matches;
    return rows.map((row) => ({ id: row.id, code: row.code, title: row.edition.work.title, location: row.location?.name ?? null, status: row.status }));
  }

  private renewalBlockedReason(row: LoanWithRelations, now: Date): string | null {
    if (row.status !== 'active') return 'Khoản mượn đã kết thúc.';
    if (row.borrower.status !== 'active') return 'Tài khoản bạn đọc không hoạt động.';
    const card = row.borrower.libraryCard;
    if (!card) return 'Bạn đọc chưa có thẻ thư viện.';
    if (card.status === 'locked') return 'Thẻ thư viện đang bị khóa.';
    if (card.expiresAt < now) return 'Thẻ thư viện đã hết hạn.';
    if (row.dueAt < now) return 'Khoản mượn đã quá hạn.';
    if (row.renewCount >= row.renewLimit) return 'Đã hết số lần gia hạn.';
    if (row.copy.edition.reservations.length) return 'Có bạn đọc đang chờ ấn bản này.';
    return null;
  }

  private overdueDays(dueAt: Date, now: Date): number {
    if (now.getTime() <= dueAt.getTime()) {
      return 0;
    }
    return Math.ceil((now.getTime() - dueAt.getTime()) / DAY_MS);
  }

  private toDto(row: LoanWithRelations, now: Date): LoanDto {
    return {
      id: row.id,
      copyId: row.copyId,
      copyCode: row.copy.code,
      workTitle: row.copy.edition.work.title,
      borrowerId: row.borrowerId,
      borrowerName: row.borrower.profile?.fullName ?? null,
      status: row.status,
      borrowedAt: row.borrowedAt.toISOString(),
      dueAt: row.dueAt.toISOString(),
      returnedAt: row.returnedAt ? row.returnedAt.toISOString() : null,
      renewCount: row.renewCount,
      renewLimit: row.renewLimit,
      renewalBlockedReason: this.renewalBlockedReason(row, now),
      renewals: row.renewals.map((renewal) => ({
        id: renewal.id,
        previousDueAt: renewal.previousDueAt.toISOString(),
        dueAt: renewal.dueAt.toISOString(),
        renewedByName: renewal.renewedBy?.profile?.fullName ?? renewal.renewedBy?.email ?? null,
        channel: renewal.channel === 'reader' ? 'reader' : 'staff',
        createdAt: renewal.createdAt.toISOString(),
      })),
      overdueDays: row.status === 'active' ? this.overdueDays(row.dueAt, now) : 0,
      fineAmount: row.fine?.amount ?? null,
    };
  }
}
