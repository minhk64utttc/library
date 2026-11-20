import type { Paginated, PublicRecordDto, PublicSearchQuery, PublicSearchFacets } from '@thu-vien/shared';
import { apiFetch } from '@/shared/api/client';

export function searchRecords(query: PublicSearchQuery): Promise<Paginated<PublicRecordDto>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return apiFetch(`/public/records?${params.toString()}`);
}

export function getRecord(id: string): Promise<PublicRecordDto> {
  return apiFetch(`/public/records/${encodeURIComponent(id)}`);
}

export function createReservation(editionId: string): Promise<unknown> {
  return apiFetch('/me/reservations', {
    method: 'POST',
    body: JSON.stringify({ editionId }),
  });
}

export function loadSearchFacets(): Promise<PublicSearchFacets> {
  return apiFetch('/public/records/facets');
}
