<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ReportSummaryDto } from '@thu-vien/shared';
import { getReportSummary } from './api';

const route = useRoute();
const router = useRouter();
const summary = ref<ReportSummaryDto | null>(null);
const loading = ref(false);
const error = ref('');
const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
const thirtyDaysAgo = new Date(Date.now() + 7 * 60 * 60 * 1000 - 29 * 86_400_000).toISOString().slice(0, 10);
const from = ref(typeof route.query.from === 'string' ? route.query.from : thirtyDaysAgo);
const to = ref(typeof route.query.to === 'string' ? route.query.to : today);
const maxCopies = computed(() => Math.max(1, ...(summary.value?.copyStatus.map((entry) => entry.count) ?? [1])));
const maxPopularity = computed(() => Math.max(1, ...(summary.value?.popularWorks.map((entry) => entry.borrowCount) ?? [1])));
const statusLabels: Record<string, string> = {
  processing: 'Đang xử lý', available: 'Sẵn sàng', on_loan: 'Đang mượn', reserved: 'Đang giữ',
  damaged: 'Hư hỏng', lost: 'Mất', pending_search: 'Đang tìm', withdrawn: 'Đã thanh lý',
};

async function load(): Promise<void> {
  loading.value = true; error.value = '';
  try { summary.value = await getReportSummary({ from: from.value, to: to.value }); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không tải được báo cáo.'; }
  finally { loading.value = false; }
}

function apply(): void {
  if (!from.value || !to.value || from.value > to.value) { error.value = 'Chọn khoảng thời gian hợp lệ.'; return; }
  void router.replace({ name: 'management-reports', query: { from: from.value, to: to.value } });
}

watch(() => [route.query.from, route.query.to], ([queryFrom, queryTo]) => {
  if (typeof queryFrom === 'string') from.value = queryFrom;
  if (typeof queryTo === 'string') to.value = queryTo;
  void load();
}, { immediate: true });
</script>

<template>
  <section class="reports" aria-labelledby="reports-title">
    <header class="reports__heading"><p class="eyebrow">Quản trị thư viện</p><h1 id="reports-title">Báo cáo hoạt động</h1><p>Tổng hợp lưu thông, công nợ và tình trạng bản sao theo khoảng thời gian.</p></header>
    <form class="reports__filters" @submit.prevent="apply">
      <label>Từ ngày<input v-model="from" type="date" required /></label>
      <label>Đến ngày<input v-model="to" type="date" required /></label>
      <button type="submit" :disabled="loading">{{ loading ? 'Đang tải…' : 'Xem báo cáo' }}</button>
    </form>
    <p v-if="error" class="reports__message reports__message--error" role="alert">{{ error }}</p>
    <p v-if="loading" class="reports__empty" role="status">Đang tổng hợp số liệu…</p>
    <template v-else-if="summary">
      <p class="reports__range">Kỳ báo cáo: {{ new Date(`${summary.from}T12:00:00+07:00`).toLocaleDateString('vi-VN') }} – {{ new Date(`${summary.to}T12:00:00+07:00`).toLocaleDateString('vi-VN') }}</p>
      <section class="reports__cards" aria-label="Chỉ số lưu thông">
        <article><span>Lượt mượn</span><strong>{{ summary.borrowedCount.toLocaleString('vi-VN') }}</strong></article>
        <article><span>Lượt trả</span><strong>{{ summary.returnedCount.toLocaleString('vi-VN') }}</strong></article>
        <article><span>Khoản mượn quá hạn hiện tại</span><strong>{{ summary.overdueCount.toLocaleString('vi-VN') }}</strong></article>
      </section>
      <section class="reports__cards reports__cards--money" aria-label="Tổng hợp khoản phạt">
        <article><span>Phạt phát sinh trong kỳ</span><strong>{{ summary.finesCreated.toLocaleString('vi-VN') }} ₫</strong></article>
        <article><span>Đã thu trong kỳ</span><strong>{{ summary.finesCollected.toLocaleString('vi-VN') }} ₫</strong></article>
        <article><span>Đã miễn trong kỳ</span><strong>{{ summary.finesWaived.toLocaleString('vi-VN') }} ₫</strong></article>
      </section>
      <div class="reports__columns">
        <section class="reports__panel"><h2>Tình trạng bản sao</h2><p v-if="!summary.copyStatus.length" class="reports__empty">Chưa có bản sao.</p><ul v-else class="reports__bars"><li v-for="entry in summary.copyStatus" :key="entry.status"><span>{{ statusLabels[entry.status] ?? entry.status }}</span><div class="reports__track"><i :style="{ width: `${entry.count / maxCopies * 100}%` }"></i></div><strong>{{ entry.count }}</strong></li></ul></section>
        <section class="reports__panel"><h2>Tài liệu được mượn nhiều</h2><p v-if="!summary.popularWorks.length" class="reports__empty">Chưa có lượt mượn trong kỳ.</p><ol v-else class="reports__popular"><li v-for="work in summary.popularWorks" :key="work.title"><div><strong>{{ work.title }}</strong><span>{{ work.borrowCount }} lượt</span></div><div class="reports__track"><i :style="{ width: `${work.borrowCount / maxPopularity * 100}%` }"></i></div></li></ol></section>
      </div>
      <p class="reports__note">“Quá hạn hiện tại” là số khoản mượn đang còn mở và đã quá hạn tại thời điểm xem báo cáo.</p>
    </template>
  </section>
</template>

<style scoped>
.reports { --section-accent: var(--navy); max-width: 1180px; margin: 0 auto; }
.reports__heading { margin-bottom: 20px; }
.reports__heading h1 { margin: 6px 0; color: var(--navy-deep); font-size: clamp(1.5rem, 3vw, 2rem); }
.reports__heading > p:last-child, .reports__range, .reports__note { color: var(--muted); font-size: .84rem; }
.reports__filters { display: flex; flex-wrap: wrap; align-items: end; gap: 13px; margin-bottom: 18px; padding: 16px; background: #f8faff; border: 1px solid var(--line); border-radius: 10px; }
.reports__filters label { display: grid; gap: 6px; min-width: 180px; font-size: .81rem; font-weight: 600; }
.reports__filters input { min-height: 39px; padding: 8px; border: 1px solid var(--line); border-radius: 7px; font: inherit; }
.reports__filters button { min-height: 39px; padding: 0 15px; color: white; background: var(--navy); border: 0; border-radius: 7px; font: inherit; font-weight: 650; cursor: pointer; }
.reports__cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 13px; margin: 16px 0; }
.reports__cards article, .reports__panel { padding: 17px; background: white; border: 1px solid var(--line); border-radius: 10px; }
.reports__cards span, .reports__cards strong { display: block; }
.reports__cards span { color: var(--muted); font-size: .77rem; }
.reports__cards strong { margin-top: 8px; color: var(--navy-deep); font-size: clamp(1.2rem, 2.5vw, 1.65rem); }
.reports__cards--money strong { color: #74591a; font-size: clamp(1rem, 2vw, 1.35rem); }
.reports__columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
.reports__panel h2 { margin: 0 0 16px; font-size: 1rem; }
.reports__bars, .reports__popular { display: grid; gap: 13px; margin: 0; padding: 0; list-style: none; }
.reports__bars li { display: grid; grid-template-columns: 110px 1fr 30px; align-items: center; gap: 9px; font-size: .78rem; }
.reports__track { height: 9px; overflow: hidden; background: #edf1f6; border-radius: 99px; }
.reports__track i { display: block; height: 100%; background: #7d97bb; border-radius: inherit; }
.reports__bars li strong { text-align: right; }
.reports__popular li > div:first-child { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 6px; font-size: .77rem; }
.reports__popular li strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reports__popular li span { flex: none; color: var(--muted); }
.reports__empty { color: var(--muted); text-align: center; }
.reports__message { padding: 11px; color: #873535; background: #fff1ef; border-radius: 8px; }
.reports__note { margin-top: 16px; }
@media (max-width: 760px) { .reports__columns { grid-template-columns: 1fr; } }
@media (max-width: 520px) { .reports__cards { grid-template-columns: 1fr; } .reports__bars li { grid-template-columns: 94px 1fr 25px; } }
</style>
