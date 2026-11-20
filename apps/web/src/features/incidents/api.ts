import type {
  CopyDto,
  IncidentCreate,
  IncidentDecisionInput,
  IncidentDto,
  IncidentInfo,
  IncidentRequestInfo,
  IncidentStatus,
  Paginated,
} from '@thu-vien/shared';

import { apiFetch } from '@/shared/api/client';

export function listIncidents(params: { page: number; status?: IncidentStatus }): Promise<Paginated<IncidentDto>> {
  const query = new URLSearchParams({ page: String(params.page), pageSize: '20' });
  if (params.status) query.set('status', params.status);
  return apiFetch<Paginated<IncidentDto>>(`/incidents?${query}`);
}

export function searchCopies(code: string): Promise<Paginated<CopyDto>> {
  const query = new URLSearchParams({ code, pageSize: '20' });
  return apiFetch<Paginated<CopyDto>>(`/holdings/copies?${query}`);
}

export function createIncident(input: IncidentCreate): Promise<IncidentDto> {
  return apiFetch<IncidentDto>('/incidents', { method: 'POST', body: JSON.stringify(input) });
}

export function addIncidentInfo(id: string, input: IncidentInfo): Promise<IncidentDto> {
  return apiFetch<IncidentDto>(`/incidents/${id}/info`, { method: 'POST', body: JSON.stringify(input) });
}

export function submitIncident(id: string): Promise<IncidentDto> {
  return apiFetch<IncidentDto>(`/incidents/${id}/submit`, { method: 'POST' });
}

export function requestIncidentInfo(id: string, input: IncidentRequestInfo): Promise<IncidentDto> {
  return apiFetch<IncidentDto>(`/incidents/${id}/request-info`, { method: 'POST', body: JSON.stringify(input) });
}

export function decideIncident(id: string, input: IncidentDecisionInput): Promise<IncidentDto> {
  return apiFetch<IncidentDto>(`/incidents/${id}/decide`, { method: 'POST', body: JSON.stringify(input) });
}
