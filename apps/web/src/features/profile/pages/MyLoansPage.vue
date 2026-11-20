<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { LoanDto, LoanStatus, Paginated } from '@thu-vien/shared';
import { ApiError } from '@/shared/api/client';
import { listMyLoans, renewMyLoan } from '../api';

const route = useRoute();
const router = useRouter();
const loans = ref<Paginated<LoanDto> | null>(null);
const loading = ref(false);
const pendingLoanId = ref('');
const error = ref('');
const notice = ref('');
const statusFilter = ref<LoanStatus | ''>('');
const overdueOnly = ref(false);
const totalPages = computed(() => Math.max(1, Math.ceil((loans.value?.total ?? 0) / (loans.value?.pageSize ?? 10))));

const labels: Record<string, string> = { active: 'Đang mượn', returned: 'Đã trả', lost: 'Đã xác nhận mất' };

function queryFor(page: number) {
  return {
    ...(statusFilter.value ? { status: statusFilter.value } : {}),
    ...(overdueOnly.value ? { overdue: 'true' } : {}),
    page: String(page),
  };
}

async function load(): Promise<void> {
  const query = route.query;
  statusFilter.value = query.status === 'active' || query.status === 'returned' || query.status === 'lost' ? query.status : '';
  overdueOnly.value = query.overdue === 'true';
  const page = Math.max(1, Number(query.page) || 1);
  loading.value = true;
  error.value = '';
  try {
    loans.value = await listMyLoans({
      page,
      ...(statusFilter.value ? { status: statusFilter.value } : {}),
      overdue: overdueOnly.value,
    });
  } catch {
    error.value = 'Không tải được các khoản mượn của bạn. Vui lòng thử lại.';
  } finally {
    loading.value = false;
  }
}

function applyFilters(): void {
  void router.push({ name: 'my-loans', query: queryFor(1) });
}

function changePage(page: number): void {
  void router.push({ name: 'my-loans', query: queryFor(page) });
}

async function renew(loan: LoanDto): Promise<void> {
  if (pendingLoanId.value) return;
  pendingLoanId.value = loan.id;
  error.value = '';
  notice.value = '';
  try {
    await renewMyLoan(loan.id);
    notice.value = 'Đã gia hạn khoản mượn.';
    await load();
  } catch (cause) {
    if (cause instanceof ApiError && cause.code.startsWith('CARD_')) {
      error.value = 'Thẻ thư viện chưa hoạt động hoặc đã hết hạn. Vui lòng liên hệ quầy thư viện trước khi gia hạn.';
    } else if (cause instanceof ApiError && cause.code === 'LOAN_OVERDUE') {
      error.value = 'Khoản mượn đã quá hạn nên không thể gia hạn.';
    } else if (cause instanceof ApiError && cause.code === 'RENEW_LIMIT') {
      error.value = 'Khoản mượn đã hết số lượt gia hạn.';
    } else if (cause instanceof ApiError && cause.code === 'HAS_WAITING') {
      error.value = 'Đang có bạn đọc khác chờ ấn bản này nên chưa thể gia hạn.';
    } else {
      error.value = 'Không gia hạn được khoản mượn. Hãy tải lại danh sách và thử lại.';
    }
  } finally {
    pendingLoanId.value = '';
  }
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
}

watch(() => route.fullPath, () => void load());
onMounted(() => void load());
</script>

<template>
  <section class="reader-loans" aria-labelledby="reader-loans-title">
    <header class="reader-loans__heading">
      <p class="eyebrow">Khu vực bạn đọc</p>
      <h1 id="reader-loans-title">Khoản mượn của tôi</h1>
      <p>Theo dõi hạn trả, tình trạng và các lần gia hạn của những tài liệu đứng tên bạn.</p>
    </header>

    <form class="reader-loans__filters" @submit.prevent="applyFilters">
      <label>Trạng thái
        <select v-model="statusFilter">
          <option value="">Tất cả khoản mượn</option>
          <option value="active">Đang mượn</option>
          <option value="returned">Đã trả</option>
          <option value="lost">Đã xác nhận mất</option>
        </select>
      </label>
      <label class="reader-loans__overdue"><input v-model="overdueOnly" type="checkbox" /> Chỉ khoản quá hạn</label>
      <button type="submit">Lọc danh sách</button>
    </form>

    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="reader-loans__notice" role="status">{{ notice }}</p>
    <div v-if="loading" class="empty-state" role="status">Đang tải khoản mượn…</div>
    <template v-else-if="loans">
      <p class="reader-loans__count">{{ loans.total }} khoản mượn</p>
      <div v-if="loans.items.length" class="reader-loans__list">
        <article v-for="loan in loans.items" :key="loan.id" class="reader-loan" :class="{ 'reader-loan--overdue': loan.overdueDays > 0 }">
          <div class="reader-loan__top">
            <div class="reader-loan__title">
              <h2>{{ loan.workTitle || 'Tài liệu chưa có nhan đề' }}</h2>
              <p>Mã bản sao <strong>{{ loan.copyCode }}</strong></p>
            </div>
            <span class="status-badge" :data-state="loan.overdueDays > 0 ? 'unpaid' : loan.status">{{ loan.overdueDays > 0 ? 'Quá hạn' : labels[loan.status] || loan.status }}</span>
          </div>
          <dl class="reader-loan__facts">
            <div><dt>Ngày mượn</dt><dd>{{ formatDate(loan.borrowedAt) }}</dd></div>
            <div><dt>Hạn trả</dt><dd>{{ formatDate(loan.dueAt) }}</dd></div>
            <div v-if="loan.returnedAt"><dt>Ngày trả</dt><dd>{{ formatDate(loan.returnedAt) }}</dd></div>
            <div><dt>Số lần gia hạn</dt><dd>{{ loan.renewCount }} / {{ loan.renewLimit }}</dd></div>
            <div v-if="loan.overdueDays > 0"><dt>Số ngày quá hạn</dt><dd>{{ loan.overdueDays }}</dd></div>
            <div v-if="loan.fineAmount !== null"><dt>Khoản phạt</dt><dd>{{ loan.fineAmount.toLocaleString('vi-VN') }} ₫</dd></div>
          </dl>
          <details v-if="loan.renewals.length" class="reader-loan__history">
            <summary>Lịch sử gia hạn ({{ loan.renewals.length }})</summary>
            <ol>
              <li v-for="renewal in loan.renewals" :key="renewal.id">
                {{ formatDate(renewal.previousDueAt) }} → {{ formatDate(renewal.dueAt) }}
                <span>{{ renewal.channel === 'reader' ? 'Bạn đọc tự gia hạn' : `Cán bộ ${renewal.renewedByName || 'thư viện'} gia hạn` }} · {{ formatDate(renewal.createdAt) }}</span>
              </li>
            </ol>
          </details>
          <p v-if="loan.status === 'active' && loan.renewalBlockedReason" class="reader-loan__hint" :id="`renew-reason-${loan.id}`">{{ loan.renewalBlockedReason }}</p>
          <button
            v-if="loan.status === 'active'"
            class="reader-loan__renew"
            type="button"
            :disabled="Boolean(pendingLoanId) || Boolean(loan.renewalBlockedReason)"
            :title="loan.renewalBlockedReason || 'Gia hạn khoản mượn'"
            :aria-describedby="loan.renewalBlockedReason ? `renew-reason-${loan.id}` : undefined"
            @click="renew(loan)"
          >{{ pendingLoanId === loan.id ? 'Đang gia hạn…' : 'Gia hạn khoản mượn' }}</button>
        </article>
      </div>
      <div v-else class="empty-state">Không có khoản mượn trong bộ lọc này.</div>
      <nav v-if="totalPages > 1" class="reader-loans__pagination" aria-label="Phân trang khoản mượn">
        <button type="button" :disabled="loans.page <= 1" @click="changePage(loans.page - 1)">Trang trước</button>
        <span>Trang {{ loans.page }} / {{ totalPages }}</span>
        <button type="button" :disabled="loans.page >= totalPages" @click="changePage(loans.page + 1)">Trang sau</button>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.reader-loans__heading { margin-bottom: 22px; }
.reader-loans__heading h1 { margin: 7px 0 4px; }
.reader-loans__heading > p:last-child { margin: 0; color: var(--muted); }
.reader-loans__filters { display: flex; flex-wrap: wrap; align-items: end; gap: 14px; margin-bottom: 20px; padding: 18px; background: #f8faff; border: 1px solid var(--line); border-radius: 11px; }
.reader-loans__filters label:first-child { flex: 1 1 230px; }
.reader-loans__filters .reader-loans__overdue { min-height: 42px; flex-direction: row; align-items: center; gap: 9px; }
.reader-loans__count { color: var(--muted); font-size: .83rem; }
.reader-loans__list { display: grid; gap: 12px; }
.reader-loan { padding: 20px; border: 1px solid var(--line); border-radius: 12px; }
.reader-loan--overdue { border-color: #e9cdd1; box-shadow: inset 3px 0 #b66b74; }
.reader-loan__top { display: flex; justify-content: space-between; align-items: start; gap: 14px; }
.reader-loan__title h2 { margin: 0 0 5px; font-size: 1rem; }
.reader-loan__title p { margin: 0; color: var(--muted); font-size: .78rem; }
.reader-loan__title strong { color: var(--ink); font-variant-numeric: tabular-nums; }
.reader-loan__facts { display: flex; flex-wrap: wrap; gap: 13px 28px; margin: 18px 0; padding: 14px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.reader-loan__facts div { display: grid; gap: 3px; min-width: 105px; }
.reader-loan__facts dt { color: var(--muted); font-size: .72rem; }
.reader-loan__facts dd { margin: 0; color: var(--ink); font-size: .84rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.reader-loan__renew { min-height: 37px; padding: 7px 12px; font-size: .78rem; }
.reader-loan__history { margin: -4px 0 14px; color: var(--muted); font-size: .79rem; }
.reader-loan__history summary { width: fit-content; cursor: pointer; color: var(--navy); font-weight: 600; }
.reader-loan__history ol { display: grid; gap: 7px; margin: 9px 0 0; padding-left: 22px; }
.reader-loan__history li span { display: block; margin-top: 2px; color: var(--muted); font-size: .74rem; }
.reader-loan__hint { color: #8a404d; font-size: .8rem; }
.reader-loans__notice { padding: 11px 13px; color: #2f6451; background: #e8f5ed; border: 1px solid #c8e4d1; border-radius: 8px; font-size: .83rem; }
.reader-loans__pagination { display: flex; justify-content: center; align-items: center; gap: 15px; margin: 22px 0 0; color: var(--muted); font-size: .82rem; }
@media (max-width: 520px) { .reader-loan { padding: 15px; } .reader-loan__top { flex-direction: column; } .reader-loan__facts { gap: 12px 18px; } }
</style>
