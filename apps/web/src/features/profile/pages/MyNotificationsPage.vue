<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiFetch } from '@/shared/api/client';

interface ReminderItem { id: string; subject: string; body: string; createdAt: string; sentAt: string | null }
interface ReminderPage { items: ReminderItem[]; total: number; page: number; pageSize: number }

const route = useRoute();
const router = useRouter();
const result = ref<ReminderPage | null>(null);
const error = ref('');
const loading = ref(false);
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const pages = computed(() => Math.max(1, Math.ceil((result.value?.total ?? 0) / (result.value?.pageSize ?? 20))));

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    result.value = await apiFetch<ReminderPage>(`/me/notifications?page=${page.value}&pageSize=20`);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không tải được thông báo.';
  } finally {
    loading.value = false;
  }
}

function goToPage(nextPage: number): void {
  void router.push({ name: route.meta.workspace ? 'staff-notifications' : 'my-notifications', query: nextPage > 1 ? { page: String(nextPage) } : {} });
}

watch(page, () => void load(), { immediate: true });
</script>

<template>
  <section class="my-notifications" aria-labelledby="notifications-title">
    <p class="eyebrow">{{ route.meta.workspace ? 'Khu nghiệp vụ thư viện' : 'Cổng bạn đọc' }}</p>
    <h1 id="notifications-title">Nhắc hạn mượn</h1>
    <p class="my-notifications__intro">Thông báo được tạo tự động cho tài liệu sắp đến hạn và đã quá hạn.</p>
    <p v-if="error" class="my-notifications__error" role="alert">{{ error }}</p>
    <p v-if="loading" class="my-notifications__empty" role="status">Đang tải thông báo…</p>
    <template v-else-if="result">
      <p class="my-notifications__count">{{ result.total }} thông báo</p>
      <div v-if="result.items.length" class="my-notifications__list">
        <article v-for="item in result.items" :key="item.id" class="my-notification">
          <div class="my-notification__top"><h2>{{ item.subject }}</h2><time :datetime="item.createdAt">{{ new Date(item.createdAt).toLocaleString('vi-VN') }}</time></div>
          <p>{{ item.body }}</p>
        </article>
      </div>
      <p v-else class="my-notifications__empty">Bạn chưa có thông báo nhắc hạn nào.</p>
      <nav v-if="pages > 1" class="my-notifications__pages" aria-label="Phân trang thông báo">
        <button type="button" :disabled="page <= 1" @click="goToPage(page - 1)">Trang trước</button>
        <span>Trang {{ page }} / {{ pages }}</span>
        <button type="button" :disabled="page >= pages" @click="goToPage(page + 1)">Trang sau</button>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.my-notifications h1 { margin: 5px 0 7px; color: var(--navy-deep); font-size: clamp(1.5rem, 3vw, 2rem); }
.my-notifications__intro, .my-notifications__count { color: var(--muted); font-size: .86rem; }
.my-notifications__list { display: grid; gap: 12px; margin-top: 20px; }
.my-notification { padding: 16px 18px; background: #fbfcfe; border: 1px solid var(--line); border-left: 3px solid var(--amber); border-radius: 10px; }
.my-notification__top { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
.my-notification h2 { margin: 0; color: var(--navy-deep); font-size: .98rem; }
.my-notification time { color: var(--muted); font-size: .76rem; white-space: nowrap; }
.my-notification p { margin: 9px 0 0; line-height: 1.55; }
.my-notifications__empty { padding: 24px 14px; color: var(--muted); text-align: center; background: #f8faff; border-radius: 9px; }
.my-notifications__error { padding: 12px; color: #873535; background: #fff1ef; border-radius: 8px; }
.my-notifications__pages { display: flex; justify-content: center; align-items: center; gap: 15px; margin: 20px 0; color: var(--muted); font-size: .82rem; }
.my-notifications__pages button { min-height: 36px; padding: 6px 10px; }
@media (max-width: 560px) { .my-notification__top { align-items: flex-start; flex-direction: column; gap: 7px; } }
</style>
