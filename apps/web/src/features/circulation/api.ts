import type {
  BorrowerDto,
  CatalogRecordDto,
  CopyDto,
  FineDto,
  FinePaymentInput,
  FinePaymentResult,
  FineReceiptDto,
  FineWaiverDecision,
  FineWaiverRequestDto,
  FineWaiverRequestInput,
  FineStatus,
  LoanDto,
  LoanCopyOption,
  LoanInput,
  LoanStatus,
  Paginated,
  PolicyDto,
  PolicyScopeQuery,
  PolicyVersionCreate,
  ReservationCreate,
  ReservationDto,
  ReservationStatus,
} from '@thu-vien/shared';

import { apiFetch } from '@/shared/api/client';

type QueryValue = string | number | boolean | undefined;

interface QueryParams {
  page?: number;
  pageSize?: number;
  status?: string;
  borrowerId?: string;
  editionId?: string;
  overdue?: boolean;
  q?: string;
  copyCode?: string;
  sort?: string;
}

function toQuery(params: QueryParams): string {
  const search = new URLSearchParams();
  const entries: Array<[string, QueryValue]> = [
    ['page', params.page],
    ['pageSize', params.pageSize],
    ['status', params.status],
    ['borrowerId', params.borrowerId],
    ['editionId', params.editionId],
    ['overdue', params.overdue],
    ['q', params.q], ['copyCode', params.copyCode], ['sort', params.sort],
  ];
  for (const [key, value] of entries) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

interface PageParams {
  page?: number;
  pageSize?: number;
}

export function listLoans(
  params: PageParams & { status?: LoanStatus; borrowerId?: string; overdue?: boolean; q?: string; copyCode?: string; sort?: string } = {},
): Promise<Paginated<LoanDto>> {
  return apiFetch<Paginated<LoanDto>>(`/circulation/loans${toQuery(params)}`);
}

export function borrow(input: LoanInput): Promise<LoanDto> {
  return apiFetch<LoanDto>('/circulation/loans', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function returnLoan(id: string): Promise<LoanDto> {
  return apiFetch<LoanDto>(`/circulation/loans/${id}/return`, { method: 'POST' });
}

export function renewLoan(id: string): Promise<LoanDto> {
  return apiFetch<LoanDto>(`/circulation/loans/${id}/renew`, { method: 'POST' });
}

export function searchBorrowers(term: string): Promise<BorrowerDto[]> {
  const search = new URLSearchParams();
  if (term) {
    search.set('q', term);
  }
  const qs = search.toString();
  return apiFetch<BorrowerDto[]>(`/circulation/borrowers${qs ? `?${qs}` : ''}`);
}

export function searchLoanCopies(term: string): Promise<LoanCopyOption[]> {
  return apiFetch<LoanCopyOption[]>(`/circulation/loans/copies?q=${encodeURIComponent(term)}`);
}

export function listAvailableCopies(): Promise<Paginated<CopyDto>> {
  return apiFetch<Paginated<CopyDto>>('/holdings/copies?status=available&pageSize=100');
}

export function listEditionsForPicker(q = ''): Promise<Paginated<CatalogRecordDto>> {
  const search = new URLSearchParams({ pageSize: '100' });
  if (q.trim()) search.set('q', q.trim());
  return apiFetch<Paginated<CatalogRecordDto>>(`/catalog/records?${search.toString()}`);
}

export function listReservations(
  params: PageParams & { status?: ReservationStatus; editionId?: string; borrowerId?: string } = {},
): Promise<Paginated<ReservationDto>> {
  return apiFetch<Paginated<ReservationDto>>(`/circulation/reservations${toQuery(params)}`);
}

export function createReservation(input: ReservationCreate): Promise<ReservationDto> {
  return apiFetch<ReservationDto>('/circulation/reservations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function cancelReservation(id: string): Promise<ReservationDto> {
  return apiFetch<ReservationDto>(`/circulation/reservations/${id}/cancel`, { method: 'POST' });
}

export function expireReservations(): Promise<{ released: number }> {
  return apiFetch<{ released: number }>('/circulation/reservations/expire-due', { method: 'POST' });
}

export function listFines(
  params: PageParams & { status?: FineStatus; borrowerId?: string; q?: string } = {},
): Promise<Paginated<FineDto>> {
  return apiFetch<Paginated<FineDto>>(`/circulation/fines${toQuery(params)}`);
}

export function payFine(id: string, input: FinePaymentInput, idempotencyKey: string): Promise<FinePaymentResult> {
  return apiFetch<FinePaymentResult>(`/circulation/fines/${id}/pay`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function requestFineWaiver(id: string, input: FineWaiverRequestInput): Promise<FineWaiverRequestDto> {
  return apiFetch<FineWaiverRequestDto>(`/circulation/fines/${id}/waivers`, { method: 'POST', body: JSON.stringify(input) });
}

export function listFineWaivers(page: number): Promise<Paginated<FineWaiverRequestDto>> {
  return apiFetch<Paginated<FineWaiverRequestDto>>(`/circulation/fines/waivers?status=pending&page=${page}&pageSize=20`);
}

export function decideFineWaiver(id: string, input: FineWaiverDecision): Promise<FineWaiverRequestDto> {
  return apiFetch<FineWaiverRequestDto>(`/circulation/fines/waivers/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify(input) });
}

export function getFineReceipt(paymentId: string): Promise<FineReceiptDto> {
  return apiFetch<FineReceiptDto>(`/circulation/fines/payments/${encodeURIComponent(paymentId)}/receipt`);
}

export function getMyFineReceipt(paymentId: string): Promise<FineReceiptDto> {
  return apiFetch<FineReceiptDto>(`/me/fines/payments/${encodeURIComponent(paymentId)}/receipt`);
}

function policyScopeQuery(scope: PolicyScopeQuery = {}): string {
  const params = new URLSearchParams();
  if (scope.readerGroup) params.set('readerGroup', scope.readerGroup);
  if (scope.materialType) params.set('materialType', scope.materialType);
  if (scope.branchCode) params.set('branchCode', scope.branchCode);
  return params.toString();
}

export function getPolicy(scope: PolicyScopeQuery = {}): Promise<PolicyDto> {
  const query = policyScopeQuery(scope);
  return apiFetch<PolicyDto>(`/circulation/policy${query ? `?${query}` : ''}`);
}

export function listPolicyVersions(scope: PolicyScopeQuery = {}): Promise<PolicyDto[]> {
  const query = policyScopeQuery(scope);
  return apiFetch<PolicyDto[]>(`/circulation/policy/versions${query ? `?${query}` : ''}`);
}

export function updatePolicy(input: PolicyVersionCreate): Promise<PolicyDto> {
  return apiFetch<PolicyDto>('/circulation/policy', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
