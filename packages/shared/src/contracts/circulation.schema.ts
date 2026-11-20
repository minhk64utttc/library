import { z } from 'zod';

export const loanInputSchema = z.object({
  copyId: z.string().min(1),
  borrowerId: z.string().min(1),
});

export type LoanInput = z.infer<typeof loanInputSchema>;

export const reservationInputSchema = z.object({
  editionId: z.string().min(1),
});

export type ReservationInput = z.infer<typeof reservationInputSchema>;

export const policyUpdateSchema = z.object({
  loanDays: z.coerce.number().int().min(1).max(365).optional(),
  renewLimit: z.coerce.number().int().min(0).max(10).optional(),
  renewDays: z.coerce.number().int().min(1).max(90).optional(),
  maxActiveLoans: z.coerce.number().int().min(1).max(100).optional(),
  overdueFinePerDay: z.coerce.number().int().min(0).max(1000000).optional(),
  holdDays: z.coerce.number().int().min(1).max(30).optional(),
});

export const policyScopeSchema = z.object({
  readerGroup: z.enum(['student', 'lecturer', 'staff', 'other']).optional(),
  materialType: z.string().trim().min(1).max(100).optional(),
  branchCode: z.string().trim().min(1).max(100).optional(),
});
export type PolicyScopeQuery = z.infer<typeof policyScopeSchema>;

export type PolicyUpdate = z.infer<typeof policyUpdateSchema>;

export const policyVersionCreateSchema = policyUpdateSchema.extend({
  readerGroup: z.enum(['student', 'lecturer', 'staff', 'other']).nullable().optional(),
  materialType: z.string().trim().min(1).max(100).nullable().optional(),
  branchCode: z.string().trim().min(1).max(100).nullable().optional(),
  serviceOpenDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([1, 2, 3, 4, 5]),
  serviceOpensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('08:00'),
  serviceClosesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('17:00'),
  effectiveOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Ngày hiệu lực không hợp lệ'),
}).superRefine((value, context) => {
  if (value.serviceClosesAt <= value.serviceOpensAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['serviceClosesAt'], message: 'Closing time must be after opening time.' });
  }
});
export type PolicyVersionCreate = z.infer<typeof policyVersionCreateSchema>;

export const finePaymentSchema = z.object({
  amount: z.coerce.number().int().positive().max(1_000_000_000),
});
export type FinePaymentInput = z.infer<typeof finePaymentSchema>;

export const fineWaiverRequestSchema = z.object({
  amount: z.coerce.number().int().positive().max(1_000_000_000),
  reason: z.string().trim().min(5).max(1000),
});
export type FineWaiverRequestInput = z.infer<typeof fineWaiverRequestSchema>;

export const fineWaiverDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  approvedAmount: z.coerce.number().int().positive().max(1_000_000_000).optional(),
  reason: z.string().trim().min(5).max(1000),
}).superRefine((value, context) => {
  if (value.status === 'approved' && value.approvedAmount === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['approvedAmount'], message: 'Cần nhập số tiền được miễn' });
  }
});
export type FineWaiverDecision = z.infer<typeof fineWaiverDecisionSchema>;

export interface PolicyDto {
  id: string;
  versionNumber: number;
  effectiveFrom: string;
  createdAt: string;
  createdByName: string | null;
  scopeKey: string;
  readerGroup: 'student' | 'lecturer' | 'staff' | 'other' | null;
  materialType: string | null;
  branchCode: string | null;
  loanDays: number;
  renewLimit: number;
  renewDays: number;
  maxActiveLoans: number;
  overdueFinePerDay: number;
  holdDays: number;
  serviceOpenDays: number[];
  serviceOpensAt: string;
  serviceClosesAt: string;
}

export interface LoanDto {
  id: string;
  copyId: string;
  copyCode: string;
  workTitle: string | null;
  borrowerId: string;
  borrowerName: string | null;
  status: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  renewCount: number;
  renewLimit: number;
  renewalBlockedReason: string | null;
  renewals: LoanRenewalDto[];
  overdueDays: number;
  fineAmount: number | null;
}

export interface LoanRenewalDto {
  id: string;
  previousDueAt: string;
  dueAt: string;
  renewedByName: string | null;
  channel: 'reader' | 'staff';
  createdAt: string;
}

export interface LoanCopyOption {
  id: string;
  code: string;
  title: string;
  location: string | null;
  status: string;
}

export interface BorrowerDto {
  id: string;
  email: string;
  fullName: string | null;
  cardNumber: string | null;
  cardStatus: 'active' | 'locked' | 'expired' | 'missing';
  cardExpiresAt: string | null;
  activeLoanCount: number;
  unpaidFineCount: number;
}

export const reservationCreateSchema = z.object({
  editionId: z.string().min(1),
  borrowerId: z.string().min(1),
});

export type ReservationCreate = z.infer<typeof reservationCreateSchema>;

export interface ReservationDto {
  id: string;
  editionId: string;
  workTitle: string | null;
  borrowerId: string;
  borrowerName: string | null;
  status: string;
  readyAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface FineDto {
  id: string;
  loanId: string;
  amount: number;
  paidAmount: number;
  waivedAmount: number;
  remainingAmount: number;
  status: string;
  copyCode: string | null;
  workTitle: string | null;
  borrowerId: string | null;
  borrowerName: string | null;
  createdAt: string;
  payments: FinePaymentDto[];
  waiverRequests: FineWaiverRequestDto[];
}

export interface FinePaymentDto {
  id: string;
  fineId: string;
  amount: number;
  remainingAfter: number;
  receiptNumber: string;
  receivedByName: string;
  receivedAt: string;
}

export interface FineReceiptDto extends FinePaymentDto {
  fineAmount: number;
  copyCode: string;
  workTitle: string;
  borrowerName: string;
  collectorName: string;
}

export interface FinePaymentResult {
  payment: FinePaymentDto;
  fine: FineDto;
}

export interface FineWaiverRequestDto {
  id: string;
  fineId: string;
  loanId: string;
  workTitle: string | null;
  copyCode: string | null;
  borrowerId: string;
  borrowerName: string | null;
  requestedByName: string;
  requestedAmount: number;
  approvedAmount: number | null;
  reason: string;
  decisionReason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt: string | null;
}
