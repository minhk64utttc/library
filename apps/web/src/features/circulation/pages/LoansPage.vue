<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { BorrowerDto, LoanCopyOption, LoanDto, LoanStatus, Paginated } from '@thu-vien/shared';
import { useSessionStore } from '@/features/auth/session.store';
import { ApiError } from '@/shared/api/client';
import * as api from '../api';
const session = useSessionStore();
const route = useRoute();
const router = useRouter();
const canManage = computed(() => session.can('circulation:manage'));
const result = ref<Paginated<LoanDto> | null>(null);
const loading = ref(false);
const error = ref('');
const notice = ref('');
const pending = ref('');
const keyword = ref('');
const status = ref<LoanStatus | ''>('');
const overdue = ref(false);
const sort = ref('newest');
const totalPages = computed(() => Math.max(1, Math.ceil((result.value?.total ?? 0) / 20)));
const borrowerTerm = ref('');
const borrowerOptions = ref<BorrowerDto[]>([]);
const borrower = ref<BorrowerDto | null>(null);
const copyTerm = ref('');
const copyOptions = ref<LoanCopyOption[]>([]);
const copy = ref<LoanCopyOption | null>(null);
const returnCode = ref('');
const returnPreview = ref<LoanDto | null>(null);
const lastBorrowedLoan = ref<LoanDto | null>(null);
const searching = ref('');
let borrowerRequest = 0;
let copyRequest = 0;
let listRequest = 0;
let borrowerTimer: ReturnType<typeof setTimeout> | undefined;
let copyTimer: ReturnType<typeof setTimeout> | undefined;
const labels: Record<string, string> = { active: 'Đang mượn', returned: 'Đã trả', lost: 'Mất' };
const cardLabels = { active: 'Thẻ còn hiệu lực', locked: 'Thẻ đang khóa', expired: 'Thẻ đã hết hạn', missing: 'Chưa cấp thẻ' };
function message(cause: unknown): string {
  if (!(cause instanceof ApiError)) return 'Không kết nối được máy chủ. Vui lòng thử lại.';
  const errors: Record<string, string> = {
    LOAN_LIMIT: 'Bạn đọc đã đạt hạn mức mượn. Trả bớt tài liệu trước khi mượn thêm.',
    CARD_MISSING: 'Bạn đọc chưa được cấp thẻ.', CARD_LOCKED: 'Thẻ bạn đọc đang bị khóa.', CARD_EXPIRED: 'Thẻ bạn đọc đã hết hạn.',
    INVALID_BORROWER: 'Tài khoản bạn đọc không hoạt động.', COPY_UNAVAILABLE: 'Cuốn sách không còn sẵn sàng. Hãy quét lại mã cuốn.',
    COPY_RESERVED: 'Cuốn sách đang giữ cho bạn đọc khác.', OPEN_INCIDENT: 'Cuốn sách đang được tra soát sự cố.',
    LOAN_CLOSED: 'Khoản mượn đã được xử lý. Hãy tải lại danh sách.', LOAN_OVERDUE: 'Khoản mượn đã quá hạn.',
    RENEW_LIMIT: 'Đã hết số lần gia hạn.', HAS_WAITING: 'Có bạn đọc đang chờ ấn bản này.',
  };
  return errors[cause.code] ?? (cause.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.' : cause.status >= 500 ? 'Máy chủ chưa xử lý được yêu cầu. Vui lòng thử lại.' : cause.message);
}
function date(value: string | null): string { return value ? new Date(value).toLocaleDateString('vi-VN') : '—'; }
function apply(page = 1): void {
  void router.push({ name: 'circulation-loans', query: {
    ...(keyword.value.trim() ? { q: keyword.value.trim() } : {}), ...(status.value ? { status: status.value } : {}),
    ...(overdue.value ? { overdue: 'true' } : {}), ...(sort.value !== 'newest' ? { sort: sort.value } : {}), page: String(page),
  } });
}
function clearFilters(): void { keyword.value = ''; status.value = ''; overdue.value = false; sort.value = 'newest'; apply(); }
async function load(): Promise<void> {
  const request = ++listRequest;
  keyword.value = typeof route.query.q === 'string' ? route.query.q : '';
  status.value = ['active', 'returned', 'lost'].includes(String(route.query.status)) ? route.query.status as LoanStatus : '';
  overdue.value = route.query.overdue === 'true';
  sort.value = ['due_asc', 'due_desc'].includes(String(route.query.sort)) ? String(route.query.sort) : 'newest';
  const page = Math.max(1, Math.floor(Number(route.query.page) || 1));
  loading.value = true; error.value = '';
  try {
    const data = await api.listLoans({ page, pageSize: 20, q: keyword.value || undefined, status: status.value || undefined, overdue: overdue.value, sort: sort.value });
    if (request === listRequest) result.value = data;
  } catch (cause) { if (request === listRequest) error.value = message(cause); }
  finally { if (request === listRequest) loading.value = false; }
}
async function findBorrower(exact = false): Promise<void> {
  clearTimeout(borrowerTimer);
  const request = ++borrowerRequest;
  const term = borrowerTerm.value.trim();
  if (!term) { borrowerOptions.value = []; return; }
  searching.value = 'borrower';
  try {
    const options = await api.searchBorrowers(term);
    if (request !== borrowerRequest) return;
    borrowerOptions.value = options;
    const match = options.find((item) => item.cardNumber?.toLowerCase() === term.toLowerCase() || item.email.toLowerCase() === term.toLowerCase());
    if (exact && match) selectBorrower(match);
    else if (exact && !options.length) error.value = 'Không tìm thấy bạn đọc. Kiểm tra mã thẻ, tên hoặc email.';
  } catch (cause) { if (request === borrowerRequest) error.value = message(cause); }
  finally { if (request === borrowerRequest) searching.value = ''; }
}
function borrowerInput(): void { borrower.value = null; borrowerOptions.value = []; ++borrowerRequest; clearTimeout(borrowerTimer); borrowerTimer = setTimeout(() => void findBorrower(), 250); }
function selectBorrower(value: BorrowerDto): void { borrower.value = value; borrowerTerm.value = value.fullName ?? value.email; borrowerOptions.value = []; }
async function findCopy(exact = false): Promise<void> {
  clearTimeout(copyTimer);
  const request = ++copyRequest;
  const term = copyTerm.value.trim();
  if (!term) { copyOptions.value = []; return; }
  searching.value = 'copy';
  try {
    const options = await api.searchLoanCopies(term);
    if (request !== copyRequest) return;
    copyOptions.value = options;
    const match = options.find((item) => item.code.toLowerCase() === term.toLowerCase());
    if (exact && match) {
      selectCopy(match);
      if (borrower.value) void borrow();
    }
    else if (exact && !options.length) error.value = 'Không tìm thấy cuốn có thể cho mượn với mã này.';
  } catch (cause) { if (request === copyRequest) error.value = message(cause); }
  finally { if (request === copyRequest) searching.value = ''; }
}
function copyInput(): void { copy.value = null; copyOptions.value = []; ++copyRequest; clearTimeout(copyTimer); copyTimer = setTimeout(() => void findCopy(), 250); }
function selectCopy(value: LoanCopyOption): void { copy.value = value; copyTerm.value = value.code; copyOptions.value = []; }
async function run(id: string, action: () => Promise<unknown>, success: string): Promise<void> {
  if (pending.value) return;
  pending.value = id; error.value = ''; notice.value = '';
  try { await action(); notice.value = success; await load(); }
  catch (cause) { error.value = message(cause); }
  finally { pending.value = ''; }
}
async function borrow(): Promise<void> {
  const selectedBorrower = borrower.value;
  const selectedCopy = copy.value;
  if (!selectedBorrower || !selectedCopy || pending.value) return;
  await run('borrow', async () => {
    lastBorrowedLoan.value = await api.borrow({ borrowerId: selectedBorrower.id, copyId: selectedCopy.id });
    selectedBorrower.activeLoanCount += 1; copy.value = null; copyTerm.value = ''; copyOptions.value = [];
  }, 'Đã cho mượn tài liệu. Có thể quét cuốn tiếp theo.');
}
function printBorrowSlip(): void { window.print(); }
async function lookupReturn(): Promise<void> {
  if (!returnCode.value.trim() || pending.value) return;
  returnPreview.value = null; error.value = ''; pending.value = 'lookup-return';
  try {
    const data = await api.listLoans({ copyCode: returnCode.value.trim(), status: 'active', pageSize: 1 });
    returnPreview.value = data.items[0] ?? null;
    if (!returnPreview.value) error.value = 'Không tìm thấy khoản đang mượn với mã cuốn này.';
  } catch (cause) { error.value = message(cause); }
  finally { pending.value = ''; }
}
async function receive(loan: LoanDto): Promise<void> {
  await run(loan.id, async () => { await api.returnLoan(loan.id); if (borrower.value?.id === loan.borrowerId) borrower.value.activeLoanCount = Math.max(0, borrower.value.activeLoanCount - 1); returnPreview.value = null; returnCode.value = ''; }, `Đã nhận trả ${loan.copyCode}.`);
}
async function exportOverdue(): Promise<void> {
  error.value = ''; notice.value = '';
  try {
    const rows: LoanDto[] = [];
    let currentPage = 1;
    let pages = 1;
    do {
      const data = await api.listLoans({ page: currentPage, pageSize: 100, status: 'active', overdue: true, sort: 'due_asc' });
      rows.push(...data.items); pages = Math.ceil(data.total / 100); currentPage += 1;
    } while (currentPage <= pages && rows.length < 20_000);
    const cell = (value: unknown): string => {
      let text = value == null ? '' : String(value);
      if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const csvRows: unknown[][] = [
      ['Mã bạn đọc', 'Bạn đọc', 'Mã cuốn', 'Tài liệu', 'Ngày mượn', 'Hạn trả', 'Quá hạn (ngày)', 'Tiền phạt (VND)'],
      ...rows.map((loan) => [loan.borrowerId, loan.borrowerName, loan.copyCode, loan.workTitle, loan.borrowedAt, loan.dueAt, loan.overdueDays, loan.fineAmount]),
    ];
    const blob = new Blob([`\uFEFF${csvRows.map((row) => row.map(cell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ban-doc-qua-han.csv'; anchor.click(); URL.revokeObjectURL(url);
    notice.value = `Đã xuất ${rows.length.toLocaleString('vi-VN')} khoản mượn quá hạn${rows.length >= 20_000 ? ' (đã chạm giới hạn 20.000 dòng)' : ''}.`;
  } catch (cause) { error.value = message(cause); }
}
watch(() => route.fullPath, () => void load());
onMounted(() => void load());
onBeforeUnmount(() => { clearTimeout(borrowerTimer); clearTimeout(copyTimer); ++borrowerRequest; ++copyRequest; ++listRequest; });
</script>

<template>
  <section class="loans">
    <header><p class="eyebrow">Mượn – Trả</p><h1>Cho mượn / Nhận trả</h1><p>Quét mã thẻ, sau đó quét mã cuốn và nhấn Enter để ghi nhận nhanh.</p><button v-if="canManage" type="button" @click="exportOverdue">Xuất bạn đọc quá hạn / tiền phạt CSV</button></header>
    <p v-if="error" role="alert">{{ error }}</p><p v-if="notice" class="loan-notice" role="status">{{ notice }}</p>
    <button v-if="lastBorrowedLoan" type="button" class="loan-print-button" @click="printBorrowSlip">In phiếu hẹn trả / Lưu PDF</button>
    <article v-if="lastBorrowedLoan" class="loan-print-slip"><h1>PHIẾU MƯỢN TÀI LIỆU</h1><p><strong>Bạn đọc:</strong> {{ lastBorrowedLoan.borrowerName || '—' }}</p><p><strong>Mã cuốn:</strong> {{ lastBorrowedLoan.copyCode }}</p><p><strong>Tài liệu:</strong> {{ lastBorrowedLoan.workTitle || '—' }}</p><p><strong>Ngày mượn:</strong> {{ date(lastBorrowedLoan.borrowedAt) }}</p><p><strong>Hạn trả:</strong> {{ date(lastBorrowedLoan.dueAt) }}</p><p>Vui lòng trả tài liệu đúng hạn tại quầy thư viện.</p></article>
    <div v-if="canManage" class="loan-counter">
      <fieldset><legend>Cho mượn tài liệu</legend>
        <form @submit.prevent="findBorrower(true)"><label for="borrower-search">1. Quét mã thẻ hoặc tìm tên, email</label><div class="loan-search"><input id="borrower-search" v-model="borrowerTerm" autocomplete="off" @input="borrowerInput" @keydown.esc="borrowerOptions = []" /><button :disabled="searching === 'borrower'" type="submit">Tìm bạn đọc</button></div></form>
        <p v-if="searching === 'borrower'" role="status">Đang tìm bạn đọc…</p>
        <ul v-if="borrowerOptions.length" class="loan-options" aria-label="Bạn đọc phù hợp"><li v-for="option in borrowerOptions" :key="option.id"><button type="button" @click="selectBorrower(option)"><strong>{{ option.fullName || option.email }}</strong><small>{{ option.cardNumber || 'Chưa có thẻ' }} · {{ option.email }}</small></button></li></ul>
        <div v-if="borrower" class="loan-selection"><strong>{{ borrower.fullName || borrower.email }}</strong><span>{{ cardLabels[borrower.cardStatus] }}<template v-if="borrower.cardExpiresAt"> · Hết hạn {{ date(borrower.cardExpiresAt) }}</template></span><span>Đang mượn {{ borrower.activeLoanCount }} cuốn · {{ borrower.unpaidFineCount }} khoản phạt chưa thanh toán</span></div>
        <form @submit.prevent="findCopy(true)"><label for="copy-search">2. Quét mã cuốn hoặc tìm tên tài liệu</label><div class="loan-search"><input id="copy-search" v-model="copyTerm" autocomplete="off" @input="copyInput" @keydown.esc="copyOptions = []" /><button :disabled="searching === 'copy'" type="submit">Tìm cuốn</button></div></form>
        <p v-if="searching === 'copy'" role="status">Đang tìm tài liệu…</p>
        <ul v-if="copyOptions.length" class="loan-options" aria-label="Cuốn có thể cho mượn"><li v-for="option in copyOptions" :key="option.id"><button type="button" @click="selectCopy(option)"><strong>{{ option.code }} · {{ option.title }}</strong><small>{{ option.location || 'Chưa có vị trí kệ' }} · {{ option.status === 'reserved' ? 'Đang giữ chỗ, kiểm tra người nhận khi xác nhận' : 'Sẵn sàng' }}</small></button></li></ul>
        <p v-if="copy" class="loan-selection"><strong>{{ copy.code }} · {{ copy.title }}</strong><span>{{ copy.location || 'Chưa có vị trí kệ' }}</span></p>
        <button type="button" :disabled="Boolean(pending) || !borrower || !copy || borrower.cardStatus !== 'active'" @click="borrow">{{ pending === 'borrow' ? 'Đang cho mượn…' : 'Xác nhận cho mượn' }}</button><small>Hạn mức và điều kiện cuốn sách được kiểm tra lại khi xác nhận.</small>
      </fieldset>
      <fieldset><legend>Nhận trả tài liệu</legend><form @submit.prevent="lookupReturn"><label for="return-code">Quét mã cuốn rồi nhấn Enter</label><div class="loan-search"><input id="return-code" v-model="returnCode" autocomplete="off" :disabled="Boolean(pending)" @input="returnPreview = null" /><button type="submit" :disabled="Boolean(pending) || !returnCode.trim()">Tra khoản mượn</button></div></form>
        <article v-if="returnPreview" class="loan-selection"><strong>{{ returnPreview.workTitle }} · {{ returnPreview.copyCode }}</strong><span>{{ returnPreview.borrowerName }} · Hạn trả {{ date(returnPreview.dueAt) }}</span><span>{{ returnPreview.overdueDays ? `Quá hạn ${returnPreview.overdueDays} ngày · Phí được tính khi nhận trả` : 'Trong hạn trả' }}</span><button type="button" :disabled="Boolean(pending)" @click="receive(returnPreview)">Xác nhận nhận trả</button></article><p v-else class="loan-help">Kiểm tra người mượn và hạn trả trước khi nhận sách. Không cần tìm cuốn trong bảng.</p>
      </fieldset>
    </div>
    <h2>Danh sách khoản mượn</h2>
    <form class="loan-filters" @submit.prevent="apply()"><label>Tìm mã cuốn, nhan đề, bạn đọc<input v-model="keyword" type="search" /></label><label>Trạng thái<select v-model="status"><option value="">Tất cả</option><option value="active">Đang mượn</option><option value="returned">Đã trả</option><option value="lost">Mất</option></select></label><label>Sắp xếp<select v-model="sort"><option value="newest">Mới mượn nhất</option><option value="due_asc">Hạn trả gần nhất</option><option value="due_desc">Hạn trả xa nhất</option></select></label><label class="loan-check"><input v-model="overdue" type="checkbox" /> Chỉ quá hạn</label><button type="submit">Áp dụng</button></form>
    <div v-if="route.query.q || route.query.status || route.query.overdue" class="loan-chips" aria-label="Bộ lọc đang áp dụng"><button v-if="route.query.q" type="button" @click="keyword = ''; apply()">Tìm: {{ route.query.q }} ×</button><button v-if="route.query.status" type="button" @click="status = ''; apply()">{{ labels[String(route.query.status)] }} ×</button><button v-if="route.query.overdue" type="button" @click="overdue = false; apply()">Quá hạn ×</button><button type="button" @click="clearFilters">Xóa tất cả</button></div>
    <div v-if="loading" class="loan-skeleton" role="status" aria-label="Đang tải khoản mượn"><span v-for="n in 4" :key="n"></span></div>
    <template v-else-if="result"><p>{{ result.total }} khoản mượn</p><div v-if="!result.items.length" class="empty-state">Không có khoản mượn phù hợp. <button type="button" @click="clearFilters">Xóa bộ lọc</button></div>
      <div v-else class="loan-table"><table><thead><tr><th scope="col">Cuốn / Tài liệu</th><th scope="col">Bạn đọc</th><th scope="col" :aria-sort="sort === 'due_asc' ? 'ascending' : sort === 'due_desc' ? 'descending' : 'none'"><button type="button" @click="sort = sort === 'due_asc' ? 'due_desc' : 'due_asc'; apply()">Hạn trả ↕</button></th><th scope="col">Trạng thái</th><th scope="col">Gia hạn</th><th scope="col">Thao tác</th></tr></thead><tbody><tr v-for="loan in result.items" :key="loan.id"><td data-label="Cuốn / Tài liệu"><strong>{{ loan.copyCode }}</strong><br />{{ loan.workTitle }}</td><td data-label="Bạn đọc">{{ loan.borrowerName }}</td><td data-label="Hạn trả">{{ date(loan.dueAt) }}<small v-if="loan.overdueDays">Quá hạn {{ loan.overdueDays }} ngày</small><small v-if="loan.fineAmount !== null">Phạt {{ loan.fineAmount.toLocaleString('vi-VN') }} ₫</small></td><td data-label="Trạng thái"><span class="status-badge" :data-state="loan.status">{{ labels[loan.status] }}</span></td><td data-label="Gia hạn">{{ loan.renewCount }} / {{ loan.renewLimit }}<small v-if="loan.status === 'active' && loan.renewalBlockedReason" :id="`reason-${loan.id}`">{{ loan.renewalBlockedReason }}</small></td><td data-label="Thao tác"><div v-if="canManage && loan.status === 'active'" class="loan-actions"><button type="button" :disabled="Boolean(pending)" @click="receive(loan)">Nhận trả</button><button type="button" :disabled="Boolean(pending) || Boolean(loan.renewalBlockedReason)" :title="loan.renewalBlockedReason || 'Gia hạn'" :aria-describedby="loan.renewalBlockedReason ? `reason-${loan.id}` : undefined" @click="run(loan.id, () => api.renewLoan(loan.id), 'Đã gia hạn khoản mượn.')">Gia hạn</button></div></td></tr></tbody></table></div>
      <nav class="loan-pagination" aria-label="Phân trang khoản mượn"><button type="button" :disabled="result.page <= 1" @click="apply(result.page - 1)">Trang trước</button><span>Trang {{ result.page }} / {{ totalPages }}</span><button type="button" :disabled="result.page >= totalPages" @click="apply(result.page + 1)">Trang sau</button></nav>
    </template>
  </section>
</template>
<style scoped>
.loans header > p:last-child,.loan-help { color:var(--muted); }
.loan-counter { display:grid;grid-template-columns:1.35fr 1fr;gap:20px;margin:24px 0 32px; }
.loan-counter fieldset { min-width:0;display:flex;flex-direction:column;gap:14px;margin:0;padding:20px;border:1px solid var(--line);border-radius:12px;background:#f8faff; }
.loan-counter legend { padding:0 8px;font-weight:700;color:var(--navy); }.loan-counter form { display:grid;gap:6px; }
.loan-search { display:flex;gap:8px; }.loan-search input { min-width:0;flex:1; }.loan-search button { flex-shrink:0; }
.loan-counter > fieldset > button { align-self:flex-start; }.loan-counter small { color:var(--muted); }
.loan-options { display:grid;gap:4px;padding:0;margin:0;list-style:none;max-height:240px;overflow:auto; }.loan-options button { width:100%;display:grid;gap:4px;text-align:left;background:white;color:var(--ink);border:1px solid var(--line); }
.loan-selection { overflow-wrap:anywhere;display:grid;gap:7px;padding:14px;background:white;border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:6px;font-size:.86rem; }.loan-selection button { justify-self:start; }
.loan-notice { padding:12px 16px;color:#246248;background:#e8f5ed;border-radius:8px; }.loan-filters { display:flex;flex-wrap:wrap;align-items:end;gap:12px; }.loan-filters label:first-child { flex:1 1 240px; }.loan-check { display:flex;align-items:center;gap:6px;min-height:42px; }.loan-check input { width:18px;height:18px; }
.loan-chips { display:flex;flex-wrap:wrap;gap:7px;margin:16px 0; }.loan-chips button { border-radius:999px;font-size:.8rem;background:#edf2fb;color:var(--navy); }
.loan-table { overflow:auto; }.loan-table small { display:block;max-width:230px;margin-top:4px;color:var(--muted); }.loan-table th button { padding:0;background:transparent;color:inherit;border:0; }.loan-actions { display:flex;gap:6px;flex-wrap:wrap; }.loan-actions button { font-size:.8rem; }
.loan-pagination { display:flex;justify-content:center;align-items:center;gap:16px;margin-top:20px; }.loan-skeleton { display:grid;gap:12px;margin:20px 0; }.loan-skeleton span { height:55px;background:#edf1f6;border-radius:6px; }
.loan-print-slip { display:none; }
@media print { :global(body *) { visibility:hidden !important; } .loan-print-slip,.loan-print-slip * { visibility:visible !important; } .loan-print-slip { display:block;position:absolute;inset:0 auto auto 0;width:100%;padding:24px;color:#111;background:#fff;font:14pt/1.5 Arial,sans-serif; } .loan-print-slip h1 { text-align:center;font-size:20pt; }.loan-print-button { display:none; } }
@media(max-width:900px) { .loan-counter { grid-template-columns:1fr; } }
@media(max-width:600px) { .loan-table table { min-width:0;width:100%; } .loan-search { flex-direction:column; }.loan-table table,.loan-table tbody,.loan-table tr,.loan-table td { display:block; }.loan-table thead { display:none; }.loan-table tr { padding:14px 0;border-bottom:1px solid var(--line); }.loan-table td { padding:7px;border:0; }.loan-table td::before { content:attr(data-label);display:block;color:var(--muted);font-size:.7rem;margin-bottom:3px; }.loan-pagination { gap:8px;font-size:.8rem; } }
</style>
