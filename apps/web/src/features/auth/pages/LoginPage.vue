<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '@/shared/api/client';
import { useSessionStore } from '../session.store';

const session = useSessionStore();
const router = useRouter();
const route = useRoute();

const form = reactive({ email: '', password: '' });
const errorMessage = ref('');
const submitting = ref(false);

async function onSubmit(): Promise<void> {
  errorMessage.value = '';
  submitting.value = true;
  try {
    await session.login({ email: form.email, password: form.password });

    if (session.mustChangePassword) {
      await router.replace({ name: 'change-password' });
      return;
    }

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.replace(redirect);
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError && error.status === 401
        ? 'Sai email hoặc mật khẩu.'
        : 'Không đăng nhập được. Vui lòng thử lại.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="public-layout">
  <section class="login">
    <div class="login__story">
      <div class="login__identity">
        <span class="login__crest"><img src="/img/utc-logo.png" alt="" width="121" height="76" /></span>
        <strong>Trường Đại học<br />Giao thông Vận tải</strong>
      </div>
      <span class="eyebrow">Thư viện · Đăng nhập tài khoản</span>
      <h1>Quản lý tài liệu, phục vụ bạn đọc.</h1>
      <p>Một không gian làm việc rõ ràng cho các nghiệp vụ thư viện.</p>
    </div>
    <div class="login__panel">
      <span class="eyebrow">Tài khoản cán bộ</span>
      <h2>Đăng nhập</h2>
      <p>Tiếp tục quản lý tài liệu và phục vụ bạn đọc.</p>
      <form @submit.prevent="onSubmit">
        <label>
          Email
          <input v-model="form.email" type="email" name="email" autocomplete="username" spellcheck="false" required />
        </label>

        <label>
          Mật khẩu
          <input v-model="form.password" type="password" name="password" autocomplete="current-password" required />
        </label>

        <p v-if="errorMessage" role="alert" aria-live="polite">{{ errorMessage }}</p>

        <button type="submit" :disabled="submitting">
          {{ submitting ? 'Đang đăng nhập…' : 'Đăng nhập' }}
        </button>
      </form>
    </div>
  </section>
  </div>
</template>
