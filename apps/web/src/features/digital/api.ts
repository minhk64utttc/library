import type {
  DigitalAccessLevel,
  DigitalListQuery,
  DigitalPublish,
  DigitalReviewNote,
  DigitalSubmissionCreate,
  DigitalSubmissionDto,
  Paginated,
} from '@thu-vien/shared';
import { apiFetch, ApiError } from '@/shared/api/client';

export interface DigitalSubmissionDetails {
  submission: DigitalSubmissionDto;
  events: Array<{ id: string; action: string; note: string | null; actorName: string; createdAt: string }>;
}

export interface DigitalPublicRecord {
  submissionCode: string; title: string; abstract: string; author: string;
  department: string | null; publishedYear: number | null; license: string; publishedAt: string | null;
  fileName: string | null;
}

export interface DigitalMemberRecord extends DigitalPublicRecord {
  submissionId: string;
  accessLevel: DigitalAccessLevel;
  fileId: string | null;
}

function queryString(query: DigitalListQuery): string {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.status) params.set('status', query.status);
  if (query.q) params.set('q', query.q);
  return params.toString();
}

export function listMySubmissions(query: DigitalListQuery): Promise<Paginated<DigitalSubmissionDto>> {
  return apiFetch(`/digital/submissions/mine?${queryString(query)}`);
}

export function listDigitalSubmissions(query: DigitalListQuery): Promise<Paginated<DigitalSubmissionDto>> {
  return apiFetch(`/digital/submissions?${queryString(query)}`);
}

export function listPublicDigitalRecords(query: { page: number; pageSize: number; q?: string }): Promise<Paginated<DigitalPublicRecord>> {
  return apiFetch(`/digital/public?${queryString(query)}`);
}

export function listMemberDigitalRecords(query: { page: number; pageSize: number; q?: string }): Promise<Paginated<DigitalMemberRecord>> {
  return apiFetch(`/digital/submissions/members?${queryString(query)}`);
}

export function createDigitalSubmission(input: DigitalSubmissionCreate): Promise<DigitalSubmissionDto> {
  return apiFetch('/digital/submissions', { method: 'POST', body: JSON.stringify(input) });
}

export function updateDigitalSubmission(id: string, input: DigitalSubmissionCreate): Promise<DigitalSubmissionDto> {
  return apiFetch(`/digital/submissions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function uploadDigitalFile(id: string, file: File): Promise<{ originalName: string; sizeBytes: number; versionNumber: number; checksumSha256: string }> {
  const body = new FormData();
  body.set('file', file);
  return apiFetch(`/digital/submissions/${encodeURIComponent(id)}/files`, { method: 'POST', body });
}

export function getDigitalSubmission(id: string): Promise<DigitalSubmissionDetails> {
  return apiFetch(`/digital/submissions/${encodeURIComponent(id)}`);
}

export function startDigitalReview(id: string): Promise<unknown> {
  return apiFetch(`/digital/submissions/${encodeURIComponent(id)}/start-review`, { method: 'POST' });
}

export function requestDigitalInfo(id: string, input: DigitalReviewNote): Promise<unknown> {
  return apiFetch(`/digital/submissions/${encodeURIComponent(id)}/request-info`, { method: 'POST', body: JSON.stringify(input) });
}

export function acceptDigitalSubmission(id: string, input: DigitalReviewNote): Promise<unknown> {
  return apiFetch(`/digital/submissions/${encodeURIComponent(id)}/accept`, { method: 'POST', body: JSON.stringify(input) });
}

export function publishDigitalSubmission(id: string, input: DigitalPublish): Promise<unknown> {
  return apiFetch(`/digital/submissions/${encodeURIComponent(id)}/publish`, { method: 'POST', body: JSON.stringify(input) });
}

async function download(path: string): Promise<Blob> {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? '/api'}${path}`, { credentials: 'include' });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { code?: string; message?: string } | null;
    throw new ApiError(response.status, payload?.message ?? `Không tải được tệp (${response.status})`, payload?.code);
  }
  return response.blob();
}

export function downloadDigitalFile(fileId: string): Promise<Blob> {
  return download(`/digital/files/${encodeURIComponent(fileId)}`);
}

export function downloadPublicDigitalFile(submissionCode: string): Promise<Blob> {
  return download(`/digital/public/${encodeURIComponent(submissionCode)}/file`);
}

export type { DigitalAccessLevel };
