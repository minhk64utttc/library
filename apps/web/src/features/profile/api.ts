import type { FineDto, FineReceiptDto, FineStatus, FineWaiverRequestDto, FineWaiverRequestInput, LoanDto, LoanStatus, MyProfileDto, Paginated, ReservationDto, ReservationStatus, UpdateMyProfile } from '@thu-vien/shared';
import { apiFetch } from '@/shared/api/client';

export function loadMyProfile(): Promise<MyProfileDto> {
  return apiFetch<MyProfileDto>('/me/profile');
}

export function saveMyProfile(input: UpdateMyProfile): Promise<MyProfileDto> {
  return apiFetch<MyProfileDto>('/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function uploadMyProfilePhoto(file: File): Promise<MyProfileDto> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<MyProfileDto>('/me/profile/photo', { method: 'POST', body: form });
}

export function removeMyProfilePhoto(): Promise<MyProfileDto> {
  return apiFetch<MyProfileDto>('/me/profile/photo', { method: 'DELETE' });
}

export function listMyLoans(query: { page: number; status?: LoanStatus; overdue?: boolean }): Promise<Paginated<LoanDto>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: '10' });
  if (query.status) params.set('status', query.status);
  if (query.overdue) params.set('overdue', 'true');
  return apiFetch<Paginated<LoanDto>>(`/me/loans?${params.toString()}`);
}

export function renewMyLoan(id: string): Promise<LoanDto> {
  return apiFetch<LoanDto>(`/me/loans/${encodeURIComponent(id)}/renew`, { method: 'POST' });
}

export function listMyReservations(query: { page: number; status?: ReservationStatus }): Promise<Paginated<ReservationDto>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: '10' });
  if (query.status) params.set('status', query.status);
  return apiFetch<Paginated<ReservationDto>>(`/me/reservations?${params.toString()}`);
}

export function cancelMyReservation(id: string): Promise<ReservationDto> {
  return apiFetch<ReservationDto>(`/me/reservations/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}

export function listMyFines(query: { page: number; status?: FineStatus }): Promise<Paginated<FineDto>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: '10' });
  if (query.status) params.set('status', query.status);
  return apiFetch<Paginated<FineDto>>(`/me/fines?${params.toString()}`);
}

export function requestMyFineWaiver(id: string, input: FineWaiverRequestInput): Promise<FineWaiverRequestDto> {
  return apiFetch<FineWaiverRequestDto>(`/me/fines/${encodeURIComponent(id)}/waivers`, { method: 'POST', body: JSON.stringify(input) });
}

export function getMyFineReceipt(paymentId: string): Promise<FineReceiptDto> {
  return apiFetch<FineReceiptDto>(`/me/fines/payments/${encodeURIComponent(paymentId)}/receipt`);
}
