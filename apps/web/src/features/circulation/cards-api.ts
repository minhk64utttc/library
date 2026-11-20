import type {
  LibraryCardAction,
  LibraryCardBorrowerDto,
  LibraryCardCreate,
  LibraryCardDto,
  LibraryCardListQuery,
  LibraryCardRenew,
  Paginated,
} from '@thu-vien/shared';
import { apiFetch } from '@/shared/api/client';

export function listCards(query: LibraryCardListQuery): Promise<Paginated<LibraryCardDto>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return apiFetch<Paginated<LibraryCardDto>>(`/circulation/cards?${params.toString()}`);
}

export function findCardBorrowers(q: string): Promise<LibraryCardBorrowerDto[]> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  return apiFetch<LibraryCardBorrowerDto[]>(`/circulation/cards/borrowers?${params.toString()}`);
}

export function issueCard(input: LibraryCardCreate): Promise<LibraryCardDto> {
  return apiFetch<LibraryCardDto>('/circulation/cards', { method: 'POST', body: JSON.stringify(input) });
}

export function renewCard(id: string, input: LibraryCardRenew): Promise<LibraryCardDto> {
  return apiFetch<LibraryCardDto>(`/circulation/cards/${encodeURIComponent(id)}/renew`, { method: 'POST', body: JSON.stringify(input) });
}

export function changeCardStatus(id: string, action: 'lock' | 'unlock', input: LibraryCardAction): Promise<LibraryCardDto> {
  return apiFetch<LibraryCardDto>(`/circulation/cards/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: JSON.stringify(input) });
}
