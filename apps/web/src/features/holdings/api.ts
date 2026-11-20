import type {
  CatalogRecordDto,
  CopyBulkCreate,
  CopyDto,
  CopyStatus,
  CopyUpdate,
  LocationDto,
  LocationInput,
  Paginated,
} from '@thu-vien/shared';

import { apiFetch } from '@/shared/api/client';

interface CopyParams {
  page?: number;
  pageSize?: number;
  editionId?: string;
  status?: CopyStatus;
  code?: string;
}

function copyQuery(params: CopyParams): string {
  const search = new URLSearchParams();
  if (params.page) {
    search.set('page', String(params.page));
  }
  if (params.pageSize) {
    search.set('pageSize', String(params.pageSize));
  }
  if (params.editionId) {
    search.set('editionId', params.editionId);
  }
  if (params.status) {
    search.set('status', params.status);
  }
  if (params.code) search.set('code', params.code);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function listCopies(params: CopyParams = {}): Promise<Paginated<CopyDto>> {
  return apiFetch<Paginated<CopyDto>>(`/holdings/copies${copyQuery(params)}`);
}

export function createCopies(input: CopyBulkCreate): Promise<CopyDto[]> {
  return apiFetch<CopyDto[]>('/holdings/copies', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCopy(id: string, input: CopyUpdate): Promise<CopyDto> {
  return apiFetch<CopyDto>(`/holdings/copies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listLocations(params: { page?: number; pageSize?: number } = {}): Promise<Paginated<LocationDto>> {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) {
    search.set('pageSize', String(params.pageSize));
  }
  const qs = search.toString();
  return apiFetch<Paginated<LocationDto>>(`/holdings/locations${qs ? `?${qs}` : ''}`);
}

export function createLocation(input: LocationInput): Promise<LocationDto> {
  return apiFetch<LocationDto>('/holdings/locations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listRecordsForPicker(): Promise<Paginated<CatalogRecordDto>> {
  return apiFetch<Paginated<CatalogRecordDto>>('/catalog/records?pageSize=100');
}
