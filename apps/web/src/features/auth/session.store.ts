import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  permissionsFor,
  type AccountSummary,
  type ChangePasswordInput,
  type LoginInput,
  type Permission,
  type Role,
} from '@thu-vien/shared';

import { ApiError } from '@/shared/api/client';
import * as authApi from './api';

export const useSessionStore = defineStore('session', () => {
  const account = ref<AccountSummary | null>(null);
  const loading = ref(false);
  const initialized = ref(false);

  const isAuthenticated = computed(() => account.value !== null);
  const mustChangePassword = computed(() => account.value?.mustChangePassword ?? false);
  const permissions = computed<ReadonlySet<Permission>>(() =>
    account.value ? permissionsFor(account.value.roles as Role[]) : new Set<Permission>(),
  );

  function can(permission: Permission): boolean {
    return permissions.value.has(permission);
  }

  async function load(): Promise<void> {
    loading.value = true;
    try {
      account.value = await authApi.fetchMe();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        account.value = null;
      } else {
        throw error;
      }
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  }

  async function login(input: LoginInput): Promise<void> {
    account.value = await authApi.login(input);
    initialized.value = true;
  }

  async function changePassword(input: ChangePasswordInput): Promise<void> {
    await authApi.changePassword(input);
    if (account.value) {
      account.value = { ...account.value, mustChangePassword: false };
    }
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch (error) {
      // An expired server session is already signed out. Other failures must
      // preserve the current identity so the user can retry the operation.
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
    account.value = null;
  }

  return {
    account,
    loading,
    initialized,
    isAuthenticated,
    mustChangePassword,
    permissions,
    can,
    load,
    login,
    changePassword,
    logout,
  };
});
