import type { AccountSummary, ChangePasswordInput, LoginInput } from '@thu-vien/shared';

import { apiFetch } from '@/shared/api/client';

export function login(input: LoginInput): Promise<AccountSummary> {
  return apiFetch<AccountSummary>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' });
}

export function fetchMe(): Promise<AccountSummary> {
  return apiFetch<AccountSummary>('/auth/me');
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return apiFetch<void>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
