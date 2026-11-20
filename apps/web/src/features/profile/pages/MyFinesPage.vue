<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { reactive } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import type { FineDto, FineStatus, Paginated } from '@thu-vien/shared';
import { listMyFines, requestMyFineWaiver } from '../api';

const route = useRoute();
const router = useRouter();
const fines = ref<Paginated<FineDto> | null>(null);
const loading = ref(false);
const error = ref('');
const statusFilter = ref<FineStatus | ''>('');
const totalPages = computed(() => Math.max(1, Math.ceil((fines.value?.total ?? 0) / (fines.value?.pageSize ?? 10))));
const pendingId = ref('');
const notice = ref('');
const waiverAmounts = reactive<Record<string, number>>({});
const waiverReasons = reactive<Record<string, string>>({});

const labels: Record<string, string> = { unpaid: 'Chưa thanh toán', paid: 'Đã thanh toán', waived: 'Đã miễn' };

function queryFor(page: number) {
  return { ...(statusFilter.value ? { status: statusFilter.value } : {}), page: String(page) };
}

async function load(): Promise<void> {
  const statuses: FineStatus[] = ['unpaid', 'paid', 'waived'];
  statusFilter.value = typeof route.query.status === 'string' && statuses.includes(route.query.status as FineStatus)
    ? route.query.status as FineStatus
    : '';
  const page = Math.max(1, Number(route.query.page) || 1);
  loading.value = true;
  error.value = '';
  try {
    fines.value = await listMyFines({ page, ...(statusFilter.value ? { status: statusFilter.value } : {}) });
    for (const fine of fines.value.items) {
      waiverAmounts[fine.id] = Math.min(waiverAmounts[fine.id] ?? fine.remainingAmount, fine.remainingAmount);
    }
  } catch {
    error.value = 'Không tải được khoản phạt của bạn. Vui lòng thử lại.';
  } finally {
    loading.value = false;
  }
}

async function requestWaiver(fine: FineDto): Promise<void> {
  if (pendingId.value) return;
  pendingId.value = fine.id;
  error.value = '';
  notice.value = '';
  try {
    await requestMyFineWaiver(fine.id, { amount: waiverAmounts[fine.id] ?? 0, reason: waiverReasons[fine.id] ?? '' });
    notice.value = 'Đã gửi đề nghị miễn giảm để thư viện xem xét.';
    waiverReasons[fine.id] = '';
    await load();
  } catch {
    error.value = 'Không gửi được đề nghị. Kiểm tra số tiền còn nợ hoặc liên hệ quầy thư viện.';
  } finally {
    pendingId.value = '';
  }
}

function applyFilters(): void {
  void router.push({ name: 'my-fines', query: queryFor(1) });
}

function changePage(page: number): void {
  void router.push({ name: 'my-fines', query: queryFor(page) });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

watch(() => route.fullPath, () => void load());
onMounted(() => void load());
</script>

<template>
  <section class="reader-fines" aria-labelledby="reader-fines-title">
    <header class="reader-fines__heading">
      <p class="eyebrow">Khu vực bạn đọc</p>
      <h1 id="reader-fines-title">Khoản phạt của tôi</h1>
      <p>Xem các khoản phát sinh gắn với tài liệu bạn đã mượn.</p>
    </header>
    <p v-if="notice" class="reader-fines__notice" role="status">{{ notice }}</p>

    <form class="reader-fines__filters" @submit.prevent="applyFilters">
      <label>Trạng thái
        <select v-model="statusFilter">
          <option value="">Tất cả khoản phạt</option>
          <option value="unpaid">Chưa thanh toán</option>
          <option value="paid">Đã thanh toán</option>
          <option value="waived">Đã miễn</option>
        </select>
      </label>
      <button type="submit">Lọc danh sách</button>
    </form>

    <p v-if="error" role="alert">{{ error }}</p>
    <div v-if="loading" class="empty-state" role="status">Đang tải khoản phạt…</div>
    <template v-else-if="fines">
      <p class="reader-fines__count">{{ fines.total }} khoản</p>
      <div v-if="fines.items.length" class="reader-fines__list">
        <article v-for="fine in fines.items" :key="fine.id" class="reader-fine">
          <div class="reader-fine__top">
            <div>
              <h2>{{ fine.workTitle || 'Tài liệu chưa có nhan đề' }}</h2>
              <p>{{ fine.copyCode ? `Mã bản sao ${fine.copyCode}` : 'Mã bản sao chưa được ghi nhận' }} · Phát sinh {{ formatDate(fine.createdAt) }}</p>
            </div>
            <span class="status-badge" :data-state="fine.status">{{ labels[fine.status] || fine.status }}</span>
          </div>
          <dl class="reader-fine__totals">
            <div><dt>Tiền gốc</dt><dd>{{ fine.amount.toLocaleString('vi-VN') }} ₫</dd></div>
            <div><dt>Đã thu</dt><dd>{{ fine.paidAmount.toLocaleString('vi-VN') }} ₫</dd></div>
            <div><dt>Đã miễn</dt><dd>{{ fine.waivedAmount.toLocaleString('vi-VN') }} ₫</dd></div>
            <div><dt>Còn phải thu</dt><dd>{{ fine.remainingAmount.toLocaleString('vi-VN') }} ₫</dd></div>
          </dl>
          <div v-if="fine.payments.length" class="reader-fine__receipts">
            <strong>Biên nhận</strong>
            <ul><li v-for="payment in fine.payments" :key="payment.id">{{ payment.receiptNumber }} · {{ payment.amount.toLocaleString('vi-VN') }} ₫ · <RouterLink :to="`/me/receipts/${payment.id}`">Xem / in</RouterLink></li></ul>
          </div>
          <details v-if="fine.status === 'unpaid' && fine.remainingAmount > 0 && !fine.waiverRequests.some((request) => request.status === 'pending')" class="reader-fine__waiver">
            <summary>Đề nghị miễn giảm</summary>
            <form @submit.prevent="requestWaiver(fine)">
              <label>Số tiền đề nghị<input v-model.number="waiverAmounts[fine.id]" type="number" min="1" :max="fine.remainingAmount" required /></label>
              <label>Lý do và căn cứ<textarea v-model="waiverReasons[fine.id]" minlength="5" maxlength="1000" required /></label>
              <button type="submit" :disabled="Boolean(pendingId)">{{ pendingId === fine.id ? 'Đang gửi…' : 'Gửi đề nghị' }}</button>
            </form>
          </details>
          <ul v-if="fine.waiverRequests.length" class="reader-fine__waivers">
            <li v-for="request in fine.waiverRequests" :key="request.id">
              Đề nghị {{ request.requestedAmount.toLocaleString('vi-VN') }} ₫ — {{ request.status }}<span v-if="request.decisionReason">: {{ request.decisionReason }}</span>
            </li>
          </ul>
        </article>
      </div>
      <div v-else class="empty-state">Không có khoản phạt trong bộ lọc này.</div>
      <nav v-if="totalPages > 1" class="reader-fines__pagination" aria-label="Phân trang khoản phạt">
        <button type="button" :disabled="fines.page <= 1" @click="changePage(fines.page - 1)">Trang trước</button>
        <span>Trang {{ fines.page }} / {{ totalPages }}</span>
        <button type="button" :disabled="fines.page >= totalPages" @click="changePage(fines.page + 1)">Trang sau</button>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.reader-fines__heading { margin-bottom: 22px; }
.reader-fines__heading h1 { margin: 7px 0 4px; }
.reader-fines__heading > p:last-child { margin: 0; color: var(--muted); }
.reader-fines__filters { display: flex; flex-wrap: wrap; align-items: end; gap: 14px; margin-bottom: 20px; padding: 18px; background: #f8faff; border: 1px solid var(--line); border-radius: 11px; }
.reader-fines__filters label { flex: 1 1 230px; }
.reader-fines__count { color: var(--muted); font-size: .83rem; }
.reader-fines__list { display: grid; gap: 12px; }
.reader-fine { padding: 20px; border: 1px solid var(--line); border-radius: 12px; }
.reader-fine__top { display: flex; justify-content: space-between; align-items: start; gap: 14px; }
.reader-fine h2 { margin: 0 0 5px; font-size: 1rem; }
.reader-fine__top p { margin: 0; color: var(--muted); font-size: .78rem; }
.reader-fine__amount { margin: 18px 0 0; color: var(--navy-deep); font-size: 1.25rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.reader-fine__totals { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 17px 0; padding: 14px 0; border-block: 1px solid var(--line); }
.reader-fine__totals div { display: grid; gap: 4px; }
.reader-fine__totals dt { color: var(--muted); font-size: .72rem; }
.reader-fine__totals dd { margin: 0; color: var(--navy-deep); font-size: .84rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.reader-fine__receipts, .reader-fine__waivers { color: var(--muted); font-size: .77rem; }
.reader-fine__receipts ul { display: flex; flex-wrap: wrap; gap: 8px 22px; padding-left: 20px; }
.reader-fine__waiver { margin-top: 13px; }
.reader-fine__waiver summary { width: fit-content; padding: 8px 11px; color: var(--navy); background: #f4f7fd; border: 1px solid #cbd8eb; border-radius: 8px; cursor: pointer; font-size: .78rem; font-weight: 600; }
.reader-fine__waiver form { max-width: 460px; margin-top: 10px; padding: 14px; background: #f8faff; border: 1px solid var(--line); border-radius: 10px; }
.reader-fine__waiver form label { width: 100%; }
.reader-fines__notice { padding: 11px 13px; color: #2f6451; background: #e8f5ed; border: 1px solid #c8e4d1; border-radius: 8px; font-size: .83rem; }
.reader-fine__note { margin: 10px 0 0; color: var(--muted); font-size: .78rem; }
.reader-fines__pagination { display: flex; justify-content: center; align-items: center; gap: 15px; margin: 22px 0 0; color: var(--muted); font-size: .82rem; }
@media (max-width: 540px) { .reader-fine { padding: 15px; } .reader-fine__top { flex-direction: column; } .reader-fine__totals { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
