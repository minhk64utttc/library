<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { FineDto, FineStatus, FineWaiverRequestDto, Paginated } from '@thu-vien/shared';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useSessionStore } from '@/features/auth/session.store';
import { ApiError } from '@/shared/api/client';
import * as circApi from '../api';

const session = useSessionStore();
const route = useRoute();
const router = useRouter();
function navigate(nextPage = 1): void { void router.push({ query: { status: statusFilter.value || 'all', page: String(nextPage) } }); }
const canCollect = computed(() => session.can('fines:collect'));
const canWaive = computed(() => session.can('fines:waive'));
const canRequestWaiver = computed(() => session.can('fines:request-waiver'));
const fines = ref<Paginated<FineDto> | null>(null);
const waivers = ref<Paginated<FineWaiverRequestDto> | null>(null);
const loading = ref(false);
const error = ref('');
const notice = ref('');
const statusFilter = ref<FineStatus | ''>('unpaid');
const page = ref(1);
const pendingId = ref('');
const paymentAmounts = reactive<Record<string, number>>({});
const waiverAmounts = reactive<Record<string, number>>({});
const waiverReasons = reactive<Record<string, string>>({});
const decisionAmounts = reactive<Record<string, number>>({});
const decisionReasons = reactive<Record<string, string>>({});
const receiptId = ref('');

const statusLabels: Record<string, string> = { unpaid: 'Còn phải thu', paid: 'Đã thanh toán', waived: 'Đã miễn đủ' };

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const [fineResult, waiverResult] = await Promise.all([
      circApi.listFines({ page: page.value, pageSize: 10, ...(statusFilter.value ? { status: statusFilter.value } : {}) }),
      canWaive.value ? circApi.listFineWaivers(1) : Promise.resolve(null),
    ]);
    fines.value = fineResult;
    waivers.value = waiverResult;
    for (const fine of fineResult.items) {
      paymentAmounts[fine.id] = Math.min(paymentAmounts[fine.id] ?? fine.remainingAmount, fine.remainingAmount);
      waiverAmounts[fine.id] = Math.min(waiverAmounts[fine.id] ?? fine.remainingAmount, fine.remainingAmount);
    }
    for (const request of waiverResult?.items ?? []) {
      decisionAmounts[request.id] = Math.min(decisionAmounts[request.id] ?? request.requestedAmount, request.requestedAmount);
    }
  } catch {
    error.value = 'Không tải được khoản phạt hoặc đề nghị miễn giảm.';
  } finally {
    loading.value = false;
  }
}

async function collect(fine: FineDto): Promise<void> {
  if (pendingId.value) return;
  pendingId.value = fine.id;
  error.value = '';
  notice.value = '';
  receiptId.value = '';
  try {
    const result = await circApi.payFine(fine.id, { amount: paymentAmounts[fine.id] ?? 0 }, crypto.randomUUID());
    receiptId.value = result.payment.id;
    notice.value = `Đã ghi nhận ${result.payment.amount.toLocaleString('vi-VN')} ₫. Biên nhận ${result.payment.receiptNumber}.`;
    await load();
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.code === 'AMOUNT_EXCEEDS_BALANCE'
      ? 'Số tiền thu vượt quá số còn phải thu. Tải lại khoản phạt rồi thử lại.'
      : 'Không ghi nhận được khoản thu. Giao dịch được bảo vệ chống ghi nhận lặp.';
  } finally {
    pendingId.value = '';
  }
}

async function requestWaiver(fine: FineDto): Promise<void> {
  if (pendingId.value) return;
  pendingId.value = fine.id;
  error.value = '';
  notice.value = '';
  try {
    await circApi.requestFineWaiver(fine.id, {
      amount: waiverAmounts[fine.id] ?? 0,
      reason: waiverReasons[fine.id] ?? '',
    });
    notice.value = 'Đã gửi đề nghị miễn giảm để quản lý xem xét.';
    waiverReasons[fine.id] = '';
    await load();
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.code === 'WAIVER_PENDING'
      ? 'Khoản phạt này đã có đề nghị đang chờ duyệt.'
      : 'Không gửi được đề nghị. Kiểm tra số tiền còn nợ và nội dung căn cứ.';
  } finally {
    pendingId.value = '';
  }
}

async function decide(request: FineWaiverRequestDto, status: 'approved' | 'rejected'): Promise<void> {
  if (pendingId.value) return;
  pendingId.value = request.id;
  error.value = '';
  notice.value = '';
  try {
    await circApi.decideFineWaiver(request.id, {
      status,
      ...(status === 'approved' ? { approvedAmount: decisionAmounts[request.id] } : {}),
      reason: decisionReasons[request.id] ?? '',
    });
    notice.value = status === 'approved' ? 'Đã duyệt mức miễn giảm.' : 'Đã từ chối đề nghị miễn giảm.';
    decisionReasons[request.id] = '';
    await load();
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.code === 'AMOUNT_EXCEEDS_BALANCE'
      ? 'Số tiền duyệt vượt quá số còn phải thu hoặc số tiền đề nghị.'
      : 'Không cập nhật được đề nghị. Tải lại danh sách rồi thử lại.';
  } finally {
    pendingId.value = '';
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('vi-VN');
}

watch(() => route.fullPath, () => {
  const status = route.query.status;
  statusFilter.value = status === 'all' ? '' : status === 'paid' || status === 'waived' ? status : 'unpaid';
  const value = Number(route.query.page);
  page.value = Number.isInteger(value) && value > 0 ? value : 1;
  void load();
}, { immediate: true });
</script>

<template>
  <section class="fines" aria-labelledby="fines-title">
    <header class="fines__heading">
      <p class="eyebrow">Lưu thông</p>
      <h1 id="fines-title">Khoản phạt và thu tiền</h1>
      <p>Theo dõi tiền gốc, số đã thu, số được miễn và số còn phải thu.</p>
    </header>

    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="fines__notice" role="status">
      {{ notice }} <RouterLink v-if="receiptId" :to="`/circulation/receipts/${receiptId}`">Mở biên nhận</RouterLink>
    </p>

    <section v-if="canWaive" class="fines__waivers" aria-labelledby="waiver-queue-title">
      <h2 id="waiver-queue-title">Đề nghị miễn giảm đang chờ</h2>
      <p v-if="!waivers?.items.length" class="empty-state">Không có đề nghị cần xem xét.</p>
      <article v-for="request in waivers?.items ?? []" :key="request.id" class="waiver-request">
        <div class="waiver-request__head">
          <div><strong>{{ request.workTitle || 'Tài liệu' }}</strong><span>{{ request.borrowerName || request.borrowerId }} · {{ request.copyCode || '—' }}</span></div>
          <span class="status-badge" data-state="pending">{{ request.requestedAmount.toLocaleString('vi-VN') }} ₫ đề nghị</span>
        </div>
        <p class="waiver-request__reason">{{ request.reason }}</p>
        <form @submit.prevent>
          <label>Số tiền duyệt<input v-model.number="decisionAmounts[request.id]" type="number" min="1" :max="request.requestedAmount" required /></label>
          <label>Lý do quyết định<textarea v-model="decisionReasons[request.id]" minlength="5" maxlength="1000" required /></label>
          <div class="waiver-request__actions">
            <button type="button" :disabled="Boolean(pendingId)" @click="decide(request, 'approved')">{{ pendingId === request.id ? 'Đang lưu…' : 'Duyệt số tiền' }}</button>
            <button type="button" :disabled="Boolean(pendingId)" @click="decide(request, 'rejected')">Từ chối</button>
          </div>
        </form>
      </article>
    </section>

    <div class="fines__filters">
      <label>Trạng thái
        <select v-model="statusFilter" @change="navigate()">
          <option value="">Tất cả</option><option value="unpaid">Còn phải thu</option><option value="paid">Đã thanh toán</option><option value="waived">Đã miễn đủ</option>
        </select>
      </label>
    </div>
    <div v-if="loading" class="empty-state" role="status">Đang tải khoản phạt…</div>
    <template v-else-if="fines">
      <p class="fines__count">{{ fines.total }} khoản</p>
      <div v-if="fines.items.length" class="fines__list">
        <article v-for="fine in fines.items" :key="fine.id" class="fine-card">
          <div class="fine-card__head">
            <div><h2>{{ fine.workTitle || 'Tài liệu' }}</h2><p>{{ fine.borrowerName || fine.borrowerId }} · {{ fine.copyCode || '—' }}</p></div>
            <span class="status-badge" :data-state="fine.status">{{ statusLabels[fine.status] || fine.status }}</span>
          </div>
          <dl class="fine-card__totals">
            <div><dt>Tiền gốc</dt><dd>{{ fine.amount.toLocaleString('vi-VN') }} ₫</dd></div>
            <div><dt>Đã thu</dt><dd>{{ fine.paidAmount.toLocaleString('vi-VN') }} ₫</dd></div>
            <div><dt>Đã miễn</dt><dd>{{ fine.waivedAmount.toLocaleString('vi-VN') }} ₫</dd></div>
            <div><dt>Còn phải thu</dt><dd>{{ fine.remainingAmount.toLocaleString('vi-VN') }} ₫</dd></div>
          </dl>
          <div v-if="fine.payments.length" class="fine-card__payments">
            <strong>Lần thu</strong>
            <ul><li v-for="payment in fine.payments" :key="payment.id">{{ payment.amount.toLocaleString('vi-VN') }} ₫ · {{ formatDate(payment.receivedAt) }} · {{ payment.receivedByName }} · <RouterLink :to="`/circulation/receipts/${payment.id}`">{{ payment.receiptNumber }}</RouterLink></li></ul>
          </div>
          <div class="fine-card__actions">
            <details v-if="canCollect && fine.remainingAmount > 0">
              <summary>Thu tiền</summary>
              <form @submit.prevent="collect(fine)">
                <label>Số tiền thực thu<input v-model.number="paymentAmounts[fine.id]" type="number" min="1" :max="fine.remainingAmount" required /></label>
                <button type="submit" :disabled="Boolean(pendingId)">{{ pendingId === fine.id ? 'Đang ghi nhận…' : 'Xác nhận thu' }}</button>
              </form>
            </details>
            <details v-if="canRequestWaiver && fine.remainingAmount > 0 && !fine.waiverRequests.some((request) => request.status === 'pending')">
              <summary>Đề nghị miễn giảm</summary>
              <form @submit.prevent="requestWaiver(fine)">
                <label>Số tiền đề nghị<input v-model.number="waiverAmounts[fine.id]" type="number" min="1" :max="fine.remainingAmount" required /></label>
                <label>Căn cứ<textarea v-model="waiverReasons[fine.id]" minlength="5" maxlength="1000" required /></label>
                <button type="submit" :disabled="Boolean(pendingId)">Gửi đề nghị</button>
              </form>
            </details>
          </div>
          <details v-if="fine.waiverRequests.length" class="fine-card__history">
            <summary>Lịch sử đề nghị miễn giảm</summary>
            <ul><li v-for="request in fine.waiverRequests" :key="request.id">{{ request.status }} · {{ request.requestedAmount.toLocaleString('vi-VN') }} ₫ · {{ request.reason }}<span v-if="request.decisionReason"> — {{ request.decisionReason }}</span></li></ul>
          </details>
        </article>
      </div>
      <p v-else class="empty-state">Không có khoản phạt trong bộ lọc này.</p>
      <nav v-if="Math.ceil(fines.total / fines.pageSize) > 1" class="fines__pagination" aria-label="Phân trang khoản phạt">
        <button type="button" :disabled="fines.page <= 1 || loading" @click="navigate(page - 1)">Trang trước</button>
        <span>Trang {{ fines.page }} / {{ Math.ceil(fines.total / fines.pageSize) }}</span>
        <button type="button" :disabled="fines.page >= Math.ceil(fines.total / fines.pageSize) || loading" @click="navigate(page + 1)">Trang sau</button>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.fines__heading { margin-bottom: 22px; }
.fines__heading h1 { margin: 7px 0 4px; }
.fines__heading > p:last-child { margin: 0; color: var(--muted); }
.fines__notice { padding: 11px 13px; color: #2f6451; background: #e8f5ed; border: 1px solid #c8e4d1; border-radius: 8px; font-size: .83rem; }
.fines__filters { display: flex; justify-content: flex-end; margin: 18px 0; }
.fines__filters label { min-width: 210px; }
.fines__count { color: var(--muted); font-size: .83rem; }
.fines__waivers { margin: 0 0 25px; padding: 20px; background: #fbfcff; border: 1px solid var(--line); border-radius: 12px; }
.fines__waivers > h2 { margin-bottom: 14px; }
.waiver-request { margin-top: 12px; padding: 17px; background: white; border: 1px solid var(--line); border-radius: 10px; }
.waiver-request__head, .fine-card__head { display: flex; justify-content: space-between; align-items: start; gap: 14px; }
.waiver-request__head > div { display: grid; gap: 4px; }
.waiver-request__head span, .fine-card__head p { color: var(--muted); font-size: .78rem; }
.waiver-request__reason { margin: 10px 0; font-size: .84rem; }
.waiver-request form { display: grid; grid-template-columns: minmax(120px, .5fr) minmax(200px, 1.5fr); align-items: end; gap: 12px; }
.waiver-request__actions { display: flex; grid-column: 1 / -1; gap: 9px; }
.waiver-request__actions button:last-child { color: #8a404d; }
.fines__list { display: grid; gap: 12px; }
.fine-card { padding: 20px; border: 1px solid var(--line); border-radius: 12px; }
.fine-card__head h2 { margin: 0 0 4px; font-size: 1rem; }
.fine-card__head p { margin: 0; }
.fine-card__totals { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 17px 0; padding: 14px 0; border-block: 1px solid var(--line); }
.fine-card__totals div { display: grid; gap: 4px; }
.fine-card__totals dt { color: var(--muted); font-size: .72rem; }
.fine-card__totals dd { margin: 0; color: var(--navy-deep); font-size: .87rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.fine-card__payments { color: var(--muted); font-size: .76rem; }
.fine-card__payments ul, .fine-card__history ul { display: grid; gap: 5px; padding-left: 20px; }
.fine-card__actions { display: flex; flex-wrap: wrap; gap: 9px; margin: 15px 0; }
.fine-card details summary { width: fit-content; padding: 8px 11px; color: var(--navy); background: #f4f7fd; border: 1px solid #cbd8eb; border-radius: 8px; cursor: pointer; font-size: .78rem; font-weight: 600; }
.fine-card details form { min-width: min(360px, calc(100vw - 80px)); margin-top: 9px; padding: 14px; background: #f8faff; border: 1px solid var(--line); border-radius: 10px; }
.fine-card details form label { width: 100%; }
.fine-card__history { margin-top: 12px; }
.fine-card__history li { font-size: .77rem; }
.fines__pagination { display: flex; justify-content: center; align-items: center; gap: 15px; margin: 22px 0 0; color: var(--muted); font-size: .82rem; }
@media (max-width: 680px) { .fine-card__totals { grid-template-columns: repeat(2, minmax(0, 1fr)); } .waiver-request form { grid-template-columns: 1fr; } .waiver-request__actions { grid-column: auto; } }
@media (max-width: 480px) { .fine-card { padding: 15px; } .fine-card__head { flex-direction: column; } }
</style>
