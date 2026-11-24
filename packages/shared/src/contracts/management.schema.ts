import { z } from 'zod';

import { pageQuerySchema } from './pagination.schema';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});

export const reportQuerySchema = z.object({
  from: dateOnly,
  to: dateOnly,
}).refine((value) => value.from <= value.to, { path: ['to'], message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi' });
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const auditQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(200).optional(),
  outcome: z.enum(['success', 'failed']).optional(),
  targetType: z.string().trim().max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export interface ReportSummaryDto {
  from: string;
  to: string;
  totalWorks: number;
  activeLoans: number;
  readerCount: number;
  borrowedCount: number;
  returnedCount: number;
  overdueCount: number;
  finesCreated: number;
  finesCollected: number;
  finesWaived: number;
  copyStatus: Array<{ status: string; count: number }>;
  popularWorks: Array<{ title: string; borrowCount: number }>;
  monthlyActivity: Array<{ month: number; borrowed: number; returned: number }>;
}

export interface AuditEventDto {
  id: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  outcome: 'success' | 'failed';
  createdAt: string;
}
