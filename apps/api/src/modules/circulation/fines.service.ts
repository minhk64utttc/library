import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type {
  FineDto,
  FinePaymentDto,
  FinePaymentResult,
  FineReceiptDto,
  FineStatus,
  FineWaiverDecision,
  FineWaiverRequestDto,
  PageQuery,
  Paginated,
} from '@thu-vien/shared';

import { Clock } from '../../common/clock/clock';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const FINE_INCLUDE = {
  loan: {
    include: {
      copy: { include: { edition: { include: { work: true } } } },
      borrower: { include: { profile: true } },
    },
  },
  payments: { include: { receivedBy: { include: { profile: true } } }, orderBy: { receivedAt: 'asc' } },
  waiverRequests: {
    include: {
      requestedBy: { include: { profile: true } },
      decidedBy: { include: { profile: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
} as const;

const RECEIPT_INCLUDE = {
  receivedBy: { include: { profile: true } },
  fine: { include: FINE_INCLUDE },
} as const;

const WAIVER_INCLUDE = {
  fine: { include: FINE_INCLUDE },
  requestedBy: { include: { profile: true } },
  decidedBy: { include: { profile: true } },
} as const;

type FineWithRelations = Prisma.FineGetPayload<{ include: typeof FINE_INCLUDE }>;
type WaiverWithRelations = Prisma.FineWaiverRequestGetPayload<{ include: typeof WAIVER_INCLUDE }>;

export interface FineListQuery extends PageQuery {
  status?: FineStatus;
  borrowerId?: string;
}

export interface FineWaiverListQuery extends PageQuery {
  status?: 'pending' | 'approved' | 'rejected';
}

@Injectable()
export class FinesService {
  constructor(private readonly prisma: PrismaService, private readonly clock: Clock) {}

  async list({ page, pageSize, status, borrowerId }: FineListQuery): Promise<Paginated<FineDto>> {
    const where: Prisma.FineWhereInput = {
      ...(status ? { status } : {}),
      ...(borrowerId ? { loan: { borrowerId } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.fine.findMany({
        where,
        include: FINE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.fine.count({ where }),
    ]);
    return { items: rows.map((row) => this.toDto(row)), total, page, pageSize };
  }

  async collect(id: string, amount: number, receivedById: string, idempotencyKey: string): Promise<FinePaymentResult> {
    if (idempotencyKey.trim().length < 8 || idempotencyKey.length > 200) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Thiếu khóa chống ghi nhận thu trùng' });
    }
    const now = this.clock.now();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${idempotencyKey})::bigint)`;
      await tx.$queryRaw`SELECT id FROM "Fine" WHERE id = ${id} FOR UPDATE`;
      const prior = await tx.finePayment.findUnique({ where: { idempotencyKey }, include: RECEIPT_INCLUDE });
      if (prior) {
        if (prior.fineId !== id || prior.amount !== amount) {
          throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: 'Khóa chống lặp đã được dùng cho giao dịch khác' });
        }
        return prior;
      }

      const fine = await tx.fine.findUnique({ where: { id }, include: FINE_INCLUDE });
      if (!fine) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy khoản phạt' });
      const totals = this.totals(fine);
      if (amount > totals.remainingAmount) {
        throw new BadRequestException({ code: 'AMOUNT_EXCEEDS_BALANCE', message: 'Số tiền thu vượt quá số còn phải thu' });
      }
      if (totals.remainingAmount <= 0) {
        throw new BadRequestException({ code: 'FINE_SETTLED', message: 'Khoản phạt đã được thanh toán hoặc miễn đủ' });
      }

      const payment = await tx.finePayment.create({
        data: {
          fineId: id,
          amount,
          remainingAfter: totals.remainingAmount - amount,
          idempotencyKey,
          receiptNumber: `TV-${now.getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          receivedById,
          receivedAt: now,
        },
        include: RECEIPT_INCLUDE,
      });
      if (amount === totals.remainingAmount) {
        await tx.fine.update({ where: { id }, data: { status: 'paid' } });
      }
      return tx.finePayment.findUniqueOrThrow({ where: { id: payment.id }, include: RECEIPT_INCLUDE });
    });

    return { payment: this.toPaymentDto(result), fine: this.toDto(result.fine) };
  }

  async requestWaiver(
    fineId: string,
    requestedById: string,
    amount: number,
    reason: string,
  ): Promise<FineWaiverRequestDto> {
    const request = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Fine" WHERE id = ${fineId} FOR UPDATE`;
      const fine = await tx.fine.findUnique({ where: { id: fineId }, include: FINE_INCLUDE });
      if (!fine) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy khoản phạt' });
      const balance = this.totals(fine).remainingAmount;
      if (balance <= 0) {
        throw new BadRequestException({ code: 'FINE_SETTLED', message: 'Khoản phạt đã được xử lý hết' });
      }
      const pending = await tx.fineWaiverRequest.findFirst({ where: { fineId, status: 'pending' }, select: { id: true } });
      if (pending) {
        throw new ConflictException({ code: 'WAIVER_PENDING', message: 'Khoản phạt đã có đề nghị đang chờ duyệt' });
      }
      if (amount > balance) {
        throw new BadRequestException({ code: 'AMOUNT_EXCEEDS_BALANCE', message: 'Số tiền đề nghị vượt quá số còn phải thu' });
      }
      const created = await tx.fineWaiverRequest.create({
        data: { fineId, requestedById, requestedAmount: amount, reason },
      });
      return tx.fineWaiverRequest.findUniqueOrThrow({ where: { id: created.id }, include: WAIVER_INCLUDE });
    });
    return this.toWaiverDto(request);
  }

  async waiverRequests(query: FineWaiverListQuery): Promise<Paginated<FineWaiverRequestDto>> {
    const where: Prisma.FineWaiverRequestWhereInput = query.status ? { status: query.status } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.fineWaiverRequest.findMany({
        where,
        include: WAIVER_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.fineWaiverRequest.count({ where }),
    ]);
    return { items: rows.map((row) => this.toWaiverDto(row)), total, page: query.page, pageSize: query.pageSize };
  }

  async decideWaiver(id: string, actorId: string, input: FineWaiverDecision): Promise<FineWaiverRequestDto> {
    const reference = await this.prisma.fineWaiverRequest.findUnique({ where: { id }, select: { fineId: true } });
    if (!reference) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy đề nghị miễn giảm' });
    const request = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Fine" WHERE id = ${reference.fineId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "FineWaiverRequest" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.fineWaiverRequest.findUnique({ where: { id }, include: { fine: { include: FINE_INCLUDE } } });
      if (!current) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy đề nghị miễn giảm' });
      if (current.status !== 'pending') {
        throw new BadRequestException({ code: 'INVALID_STATE', message: 'Đề nghị này đã được xử lý' });
      }
      const remaining = this.totals(current.fine).remainingAmount;
      if (input.status === 'approved') {
        const approvedAmount = input.approvedAmount;
        if (approvedAmount === undefined || approvedAmount > current.requestedAmount || approvedAmount > remaining) {
          throw new BadRequestException({ code: 'AMOUNT_EXCEEDS_BALANCE', message: 'Số tiền miễn không được vượt đề nghị hoặc số còn phải thu' });
        }
      }
      const updated = await tx.fineWaiverRequest.update({
        where: { id },
        data: {
          status: input.status,
          approvedAmount: input.status === 'approved' ? input.approvedAmount! : null,
          decidedById: actorId,
          decisionReason: input.reason,
          decidedAt: this.clock.now(),
        },
      });

      if (input.status === 'approved' && input.approvedAmount === remaining) {
        const paidTotal = this.totals(current.fine).paidAmount;
        await tx.fine.update({ where: { id: current.fineId }, data: { status: paidTotal > 0 ? 'paid' : 'waived' } });
      }
      return tx.fineWaiverRequest.findUniqueOrThrow({ where: { id: updated.id }, include: WAIVER_INCLUDE });
    });
    return this.toWaiverDto(request);
  }

  async receipt(paymentId: string, borrowerId?: string): Promise<FineReceiptDto> {
    const payment = await this.prisma.finePayment.findUnique({ where: { id: paymentId }, include: RECEIPT_INCLUDE });
    if (!payment || (borrowerId && payment.fine.loan.borrowerId !== borrowerId)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy biên nhận' });
    }
    const fine = this.toDto(payment.fine);
    return {
      ...this.toPaymentDto(payment),
      fineAmount: fine.amount,
      copyCode: payment.fine.loan.copy.code,
      workTitle: payment.fine.loan.copy.edition.work.title,
      borrowerName: payment.fine.loan.borrower.profile?.fullName ?? payment.fine.loan.borrower.email,
      collectorName: payment.receivedBy.profile?.fullName ?? payment.receivedBy.email,
    };
  }

  private totals(row: FineWithRelations): { paidAmount: number; waivedAmount: number; remainingAmount: number } {
    const paidAmount = row.payments.reduce((total, payment) => total + payment.amount, 0);
    const waivedAmount = row.waiverRequests.reduce(
      (total, request) => total + (request.status === 'approved' ? request.approvedAmount ?? 0 : 0),
      0,
    );
    return { paidAmount, waivedAmount, remainingAmount: Math.max(0, row.amount - paidAmount - waivedAmount) };
  }

  private toDto(row: FineWithRelations): FineDto {
    const totals = this.totals(row);
    return {
      id: row.id,
      loanId: row.loanId,
      amount: row.amount,
      ...totals,
      status: row.status,
      copyCode: row.loan.copy.code,
      workTitle: row.loan.copy.edition.work.title,
      borrowerId: row.loan.borrowerId,
      borrowerName: row.loan.borrower.profile?.fullName ?? null,
      createdAt: row.createdAt.toISOString(),
      payments: row.payments.map((payment) => this.toPaymentDto(payment)),
      waiverRequests: row.waiverRequests.map((request) => ({
        id: request.id,
        fineId: request.fineId,
        loanId: row.loanId,
        workTitle: row.loan.copy.edition.work.title,
        copyCode: row.loan.copy.code,
        borrowerId: row.loan.borrowerId,
        borrowerName: row.loan.borrower.profile?.fullName ?? null,
        requestedByName: request.requestedBy.profile?.fullName ?? request.requestedBy.email,
        requestedAmount: request.requestedAmount,
        approvedAmount: request.approvedAmount,
        reason: request.reason,
        decisionReason: request.decisionReason,
        status: request.status,
        createdAt: request.createdAt.toISOString(),
        decidedAt: request.decidedAt?.toISOString() ?? null,
      })),
    };
  }

  private toPaymentDto(row: {
    id: string;
    fineId: string;
    amount: number;
    remainingAfter: number;
    receiptNumber: string;
    receivedAt: Date;
    receivedBy: { email: string; profile: { fullName: string } | null };
  }): FinePaymentDto {
    return {
      id: row.id,
      fineId: row.fineId,
      amount: row.amount,
      remainingAfter: row.remainingAfter,
      receiptNumber: row.receiptNumber,
      receivedByName: row.receivedBy.profile?.fullName ?? row.receivedBy.email,
      receivedAt: row.receivedAt.toISOString(),
    };
  }

  private toWaiverDto(row: WaiverWithRelations): FineWaiverRequestDto {
    return {
      id: row.id,
      fineId: row.fineId,
      loanId: row.fine.loanId,
      workTitle: row.fine.loan.copy.edition.work.title,
      copyCode: row.fine.loan.copy.code,
      borrowerId: row.fine.loan.borrowerId,
      borrowerName: row.fine.loan.borrower.profile?.fullName ?? null,
      requestedByName: row.requestedBy.profile?.fullName ?? row.requestedBy.email,
      requestedAmount: row.requestedAmount,
      approvedAmount: row.approvedAmount,
      reason: row.reason,
      decisionReason: row.decisionReason,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
    };
  }
}
