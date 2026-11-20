import type {
  AccountCreate,
  AccountDto,
  AccountResetPassword,
  AccountUpdate,
  Paginated,
  Role,
} from '@thu-vien/shared';

import { apiFetch } from '@/shared/api/client';

interface AccountParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: 'active' | 'disabled';
  role?: Role;
}

function toQuery(params: AccountParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  if (params.q) search.set('q', params.q);
  if (params.status) search.set('status', params.status);
  if (params.role) search.set('role', params.role);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function listAccounts(params: AccountParams = {}): Promise<Paginated<AccountDto>> {
  return apiFetch<Paginated<AccountDto>>(`/accounts${toQuery(params)}`);
}

export function createAccount(input: AccountCreate): Promise<AccountDto> {
  return apiFetch<AccountDto>('/accounts', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAccount(id: string, input: AccountUpdate): Promise<AccountDto> {
  return apiFetch<AccountDto>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function resetAccountPassword(
  id: string,
  input: AccountResetPassword,
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/accounts/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
