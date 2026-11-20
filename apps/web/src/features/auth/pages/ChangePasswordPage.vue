<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '@/shared/api/client';
import { useSessionStore } from '../session.store';

const session = useSessionStore();
const router = useRouter();
const route = useRoute();
const embedded = computed(() => route.name !== 'change-password');
const profilePath = computed(() => route.meta.workspace || (route.name === 'change-password' && session.account?.roles.some(role => role !== 'reader')) ? '/account/profile' : '/me/profile');

const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });
const errorMessage = ref('');
const submitting = ref(false);

async function onSubmit(): Promise<void> {
  errorMessage.value = '';

  if (form.newPassword !== form.confirmPassword) {
    errorMessage.value = 'Mật khẩu mới nhập lại không khớp.';
    return;
  }

  submitting.value = true;
  try {
    await session.changePassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });
    await router.replace(profilePath.value);
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError && error.status === 400
        ? 'Mật khẩu hiện tại không đúng.'
        : 'Không đổi được mật khẩu. Vui lòng thử lại.';
  } finally {
    submitting.value = false;
  }
}

async function onLogout(): Promise<void> {
  try { await session.logout(); await router.replace({ name: 'login' }); }
  catch { errorMessage.value = 'Chưa hoàn tất đăng xuất. Vui lòng kiểm tra kết nối và thử lại.'; }
}
</script>

<template>
  <section class="change-password" :class="{ 'change-password--embedded': embedded }">
    <img v-if="!embedded" src="/img/utc-logo.png" alt="Trường Đại học Giao thông Vận tải" width="121" height="76" />
    <span class="eyebrow">Thư viện · Bảo vệ tài khoản</span>
    <h1>Đổi mật khẩu</h1>
    <p>{{ session.mustChangePassword ? 'Bạn cần đổi mật khẩu trước khi tiếp tục.' : 'Chọn mật khẩu mới để bảo vệ tài khoản của bạn.' }}</p>
    <button v-if="!session.mustChangePassword" type="button" @click="router.push(profilePath)">← Về hồ sơ cá nhân</button>

    <form @submit.prevent="onSubmit">
      <label>
        Mật khẩu hiện tại
        <input v-model="form.currentPassword" type="password" autocomplete="current-password" required />
      </label>

      <label>
        Mật khẩu mới
        <input v-model="form.newPassword" type="password" autocomplete="new-password" minlength="8" required />
      </label>

      <label>
        Nhập lại mật khẩu mới
        <input v-model="form.confirmPassword" type="password" autocomplete="new-password" minlength="8" required />
      </label>

      <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>

      <button type="submit" :disabled="submitting">
        {{ submitting ? 'Đang lưu…' : 'Đổi mật khẩu' }}
      </button>
    </form>

    <footer v-if="!embedded" class="change-password__footer">
      <span v-if="session.account">{{ session.account.email }}</span>
      <button type="button" class="link-button" @click="onLogout">Đăng xuất</button>
    </footer>
  </section>
</template>

<style scoped>
.change-password--embedded { max-width: 620px; width: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; box-shadow: none; background: transparent; }
.change-password--embedded > form { margin-top: 24px; }
</style>
