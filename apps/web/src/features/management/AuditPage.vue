<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { AuditEventDto, Paginated } from '@thu-vien/shared';
import { listAuditEvents } from './api';

const route = useRoute();
const router = useRouter();
const result = ref<Paginated<AuditEventDto> | null>(null);
const loading = ref(false);
const error = ref('');
const query = ref(typeof route.query.q === 'string' ? route.query.q : '');
const outcome = ref(typeof route.query.outcome === 'string' ? route.query.outcome : '');
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const totalPages = computed(() => Math.max(1, Math.ceil((result.value?.total ?? 0) / (result.value?.pageSize ?? 20))));

async function load(): Promise<void> {
  loading.value = true; error.value = '';
  try {
    result.value = await listAuditEvents({ page: page.value, pageSize: 20, q: query.value.trim() || undefined, outcome: (outcome.value || undefined) as 'success' | 'failed' | undefined });
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không tải được nhật ký thao tác.';
  } finally { loading.value = false; }
}

function applyFilters(nextPage = 1): void {
  void router.replace({ name: 'management-audit', query: {
    ...(query.value.trim() ? { q: query.value.trim() } : {}),
    ...(outcome.value ? { outcome: outcome.value } : {}),
    ...(nextPage > 1 ? { page: String(nextPage) } : {}),
  } });
}

watch(() => [route.query.q, route.query.outcome, route.query.page], () => {
  query.value = typeof route.query.q === 'string' ? route.query.q : '';
  outcome.value = typeof route.query.outcome === 'string' ? route.query.outcome : '';
  void load();
}, { immediate: true });

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
</script>

<template>
  <section class="audit" aria-labelledby="audit-title">
    <header class="audit__heading"><p class="eyebrow">Quản trị hệ thống</p><h1 id="audit-title">Nhật ký thao tác</h1><p>Ghi nhận các yêu cầu thay đổi dữ liệu có xác thực; không lưu nội dung biểu mẫu, mật khẩu hoặc tệp.</p></header>
    <form class="audit__filters" @submit.prevent="applyFilters(1)">
      <label>Tìm thao tác, người dùng hoặc đối tượng<input v-model="query" type="search" maxlength="200" placeholder="Ví dụ: circulation/loans" /></label>
      <label>Kết quả<select v-model="outcome"><option value="">Tất cả</option><option value="success">Thành công</option><option value="failed">Thất bại</option></select></label>
      <button type="submit" :disabled="loading">{{ loading ? 'Đang tải…' : 'Lọc nhật ký' }}</button>
    </form>
    <p v-if="error" class="audit__error" role="alert">{{ error }}</p>
    <p v-if="loading" class="audit__empty" role="status">Đang tải nhật ký…</p>
    <template v-else-if="result">
      <p class="audit__count">{{ result.total.toLocaleString('vi-VN') }} sự kiện</p>
      <div class="audit__table-wrap">
        <table>
          <thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Thao tác</th><th>Đối tượng</th><th>Kết quả</th></tr></thead>
          <tbody>
            <tr v-for="event in result.items" :key="event.id">
              <td>{{ formatDate(event.createdAt) }}</td><td>{{ event.actorName }}</td><td><code>{{ event.action }}</code></td>
              <td><span>{{ event.targetType }}</span><code v-if="event.targetId">{{ event.targetId }}</code></td>
              <td><span class="audit__result" :class="event.outcome === 'success' ? 'audit__result--success' : 'audit__result--failed'">{{ event.outcome === 'success' ? 'Thành công' : 'Thất bại' }}</span></td>
            </tr>
            <tr v-if="result.items.length === 0"><td colspan="5" class="audit__empty">Chưa có sự kiện phù hợp.</td></tr>
          </tbody>
        </table>
      </div>
      <nav v-if="totalPages > 1" class="audit__pagination" aria-label="Phân trang nhật ký"><button type="button" :disabled="page <= 1" @click="applyFilters(page - 1)">Trước</button><span>Trang {{ page }} / {{ totalPages }}</span><button type="button" :disabled="page >= totalPages" @click="applyFilters(page + 1)">Sau</button></nav>
    </template>
  </section>
</template>

<style scoped>
.audit { --section-accent: var(--navy); max-width: 1180px; margin: 0 auto; }
.audit__heading { margin-bottom: 20px; }
.audit__heading h1 { margin: 6px 0; color: var(--navy-deep); font-size: clamp(1.5rem, 3vw, 2rem); }
.audit__heading > p:last-child, .audit__count { color: var(--muted); font-size: .84rem; }
.audit__filters { display: grid; grid-template-columns: minmax(220px, 1fr) 200px auto; align-items: end; gap: 13px; margin-bottom: 18px; padding: 16px; background: #f8faff; border: 1px solid var(--line); border-radius: 10px; }
.audit__filters label { display: grid; gap: 6px; font-size: .81rem; font-weight: 600; }
.audit__filters input, .audit__filters select { min-height: 39px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 7px; font: inherit; }
.audit__filters button, .audit__pagination button { min-height: 38px; padding: 6px 12px; color: white; background: var(--navy); border: 0; border-radius: 7px; font: inherit; font-size: .82rem; cursor: pointer; }
.audit__filters button:disabled { opacity: .6; }
.audit__table-wrap { overflow: auto; border: 1px solid var(--line); border-radius: 10px; }
.audit table { width: 100%; min-width: 800px; border-collapse: collapse; font-size: .79rem; }
.audit th, .audit td { padding: 11px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); }
.audit th { color: var(--muted); background: #f8faff; font-weight: 650; }
.audit td code { display: block; max-width: 300px; margin: 2px 0; color: #344a64; font-size: .72rem; overflow-wrap: anywhere; }
.audit__result { display: inline-block; padding: 4px 8px; border-radius: 99px; white-space: nowrap; font-size: .7rem; }
.audit__result--success { color: #285c45; background: #e8f5ed; }
.audit__result--failed { color: #873535; background: #fff1ef; }
.audit__empty { padding: 20px; color: var(--muted); text-align: center; }
.audit__error { padding: 11px; color: #873535; background: #fff1ef; border-radius: 8px; }
.audit__pagination { display: flex; justify-content: center; align-items: center; gap: 14px; margin: 20px 0; color: var(--muted); font-size: .82rem; }
@media (max-width: 700px) { .audit__filters { grid-template-columns: 1fr; } }
</style>
