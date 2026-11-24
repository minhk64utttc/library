import type { AuditEventDto, Paginated, ReportSummaryDto } from '@thu-vien/shared';
import { apiFetch } from '@/shared/api/client';

export function getReportSummary(query: { from: string; to: string }): Promise<ReportSummaryDto> {
  const params = new URLSearchParams(query);
  return apiFetch(`/management/reports?${params.toString()}`);
}

export function listAuditEvents(query: { page: number; pageSize: number; q?: string; outcome?: 'success' | 'failed'; targetType?: string; from?: string; to?: string }): Promise<Paginated<AuditEventDto>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.q) params.set('q', query.q);
  if (query.outcome) params.set('outcome', query.outcome);
  if (query.targetType) params.set('targetType', query.targetType);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return apiFetch(`/management/audit?${params.toString()}`);
}
