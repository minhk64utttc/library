import type {
  CatalogRecordDto,
  CallNumberUpdate,
  Paginated,
  PublisherDto,
  PublisherInput,
  PublisherUpdate,
  RecordInput,
  RecordStatus,
} from '@thu-vien/shared';

import { apiFetch } from '@/shared/api/client';

interface PageParams {
  page?: number;
  pageSize?: number;
  status?: RecordStatus;
  q?: string;
  rejected?: 'true' | 'false';
  sort?: string;
}

function toQuery(params: PageParams): string {
  const search = new URLSearchParams();
  if (params.page) {
    search.set('page', String(params.page));
  }
  if (params.pageSize) {
    search.set('pageSize', String(params.pageSize));
  }
  if (params.status) {
    search.set('status', params.status);
  }
  if (params.q) search.set('q', params.q);
  if (params.rejected) search.set('rejected', params.rejected);
  if (params.sort) search.set('sort', params.sort);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function listRecords(params: PageParams = {}): Promise<Paginated<CatalogRecordDto>> {
  return apiFetch<Paginated<CatalogRecordDto>>(`/catalog/records${toQuery(params)}`);
}

export function getRecord(id: string): Promise<CatalogRecordDto> {
  return apiFetch<CatalogRecordDto>(`/catalog/records/${id}`);
}

export function createRecord(input: RecordInput): Promise<CatalogRecordDto> {
  return apiFetch<CatalogRecordDto>('/catalog/records', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateRecord(id: string, input: Partial<RecordInput>): Promise<CatalogRecordDto> {
  return apiFetch<CatalogRecordDto>(`/catalog/records/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function submitRecord(id: string): Promise<CatalogRecordDto> {
  return apiFetch<CatalogRecordDto>(`/catalog/records/${id}/submit`, { method: 'POST' });
}

export function approveRecord(id: string): Promise<CatalogRecordDto> {
  return apiFetch<CatalogRecordDto>(`/catalog/records/${id}/approve`, { method: 'POST' });
}

export function rejectRecord(id: string, reason: string): Promise<CatalogRecordDto> {
  return apiFetch<CatalogRecordDto>(`/catalog/records/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function publishRecord(id: string): Promise<CatalogRecordDto> {
  return apiFetch<CatalogRecordDto>(`/catalog/records/${id}/publish`, { method: 'POST' });
}

export function setCallNumber(
  recordId: string,
  editionId: string,
  input: CallNumberUpdate,
): Promise<CatalogRecordDto> {
  return apiFetch<CatalogRecordDto>(`/catalog/records/${recordId}/editions/${editionId}/call-number`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listPublishers(params: PageParams = {}): Promise<Paginated<PublisherDto>> {
  return apiFetch<Paginated<PublisherDto>>(`/catalog/publishers${toQuery(params)}`);
}

export function createPublisher(input: PublisherInput): Promise<PublisherDto> {
  return apiFetch<PublisherDto>('/catalog/publishers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePublisher(id: string, input: PublisherUpdate): Promise<PublisherDto> {
  return apiFetch<PublisherDto>(`/catalog/publishers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
