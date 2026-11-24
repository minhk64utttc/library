<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { recordInputSchema, recordListQuerySchema, type CatalogRecordDto, type RecordInput } from '@thu-vien/shared';
import { useSessionStore } from '@/features/auth/session.store';
import { ApiError } from '@/shared/api/client';
import * as catalogApi from '../api';
import { RECORD_STATUS_OPTIONS, statusLabel } from '../status';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const records = ref<CatalogRecordDto[]>([]);
const total = ref(0);
const loading = ref(false);
const errorMessage = ref('');
const notice = ref('');
const query = computed(() => {
  const parsed = recordListQuerySchema.safeParse(route.query);
  return parsed.success ? parsed.data : recordListQuerySchema.parse({});
});
const searchText = ref(query.value.q ?? '');
const pendingId = ref<string | null>(null);
const rejecting = ref<CatalogRecordDto | null>(null);
const rejectReason = ref('');
const rejectDialog = ref<HTMLDialogElement | null>(null);
const rejectInput = ref<HTMLTextAreaElement | null>(null);
const heading = ref<HTMLElement | null>(null);
const dialogError = ref('');
const importPreview = ref<Array<{ line: number; input: RecordInput | null; title: string; error: string }>>([]);
const importing = ref(false);
const importMessage = ref('');
let returnFocus: HTMLElement | null = null;
let loadSequence = 0;
const canWrite = computed(() => session.can('catalog:write'));
const canApprove = computed(() => session.can('catalog:approve'));
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / query.value.pageSize)));
function changeQuery(changes: Record<string, string | number | undefined>): void {
  const next = { ...route.query, ...changes };
  for (const key of Object.keys(next)) if (next[key] === '' || next[key] === undefined) delete next[key];
  void router.push({ query: next });
}
function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Không kết nối được thư viện. Kiểm tra mạng rồi thử lại.';
  if (error.status === 403) return 'Tài khoản của bạn chưa có quyền thực hiện thao tác này.';
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
  return error.code === 'ERROR' ? 'Không thực hiện được thao tác. Hãy tải lại và thử lại.' : error.message;
}
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted && character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (!quoted && character === ',') { row.push(cell); cell = ''; }
    else if (!quoted && (character === '\n' || character === '\r')) {
      row.push(cell); cell = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      if (character === '\r' && text[index + 1] === '\n') index += 1;
    } else cell += character;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}
function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
function downloadCsv(filename: string, rows: unknown[][]): void {
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}
function downloadTemplate(): void {
  downloadCsv('mau-nhap-sach.csv', [
    ['group_key', 'title', 'author', 'subject', 'classification', 'publisher_id', 'isbn', 'language', 'publish_year', 'edition_no', 'call_number'],
    ['', 'Toán rời rạc', 'Nguyễn Văn A', 'Toán học', 'book', '', '9780000000000', 'vi', '2024', '1', '510-TOA'],
  ]);
}
async function exportRecords(): Promise<void> {
  importing.value = true; importMessage.value = '';
  try {
    const exported: CatalogRecordDto[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const result = await catalogApi.listRecords({ ...query.value, page, pageSize: 100 });
      exported.push(...result.items); totalPages = Math.ceil(result.total / 100); page += 1;
    } while (page <= totalPages && exported.length < 20_000);
    const rows: unknown[][] = [['group_key', 'title', 'author', 'subject', 'classification', 'publisher_id', 'isbn', 'language', 'publish_year', 'edition_no', 'call_number', 'status']];
    for (const record of exported) {
      const editions = record.editions.length ? record.editions : [null];
      for (const edition of editions) rows.push([record.id, record.title, record.author, record.subject, record.classification, edition?.publisherId, edition?.isbn, edition?.language, edition?.publishYear, edition?.editionNo, edition?.callNumber, record.status]);
    }
    downloadCsv('danh-muc-sach.csv', rows);
    importMessage.value = `Đã xuất ${exported.length.toLocaleString('vi-VN')} bản ghi${exported.length >= 20_000 ? ' (đã chạm giới hạn 20.000 dòng)' : ''}.`;
  } catch (cause) { importMessage.value = errorText(cause); }
  finally { importing.value = false; }
}
async function previewImport(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0]; input.value = '';
  importPreview.value = []; importMessage.value = '';
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { importMessage.value = 'Tệp CSV không được vượt quá 5 MB.'; return; }
  try {
    const rows = csvRows((await file.text()).replace(/^\uFEFF/, ''));
    if (!rows.length) { importMessage.value = 'Tệp CSV chưa có dữ liệu.'; return; }
    const headers = rows[0]!.map((header) => header.trim().toLowerCase());
    const required = ['title'];
    if (required.some((header) => !headers.includes(header))) { importMessage.value = 'Thiếu cột bắt buộc title. Tải file mẫu để xem các cột hỗ trợ.'; return; }
    if (rows.length > 101) { importMessage.value = 'Mỗi lần nhập tối đa 100 bản ghi.'; return; }
    const column = (row: string[], name: string): string => row[headers.indexOf(name)]?.trim() ?? '';
    const grouped = new Map<string, { line: number; rows: string[][] }>();
    rows.slice(1).forEach((row, index) => {
      const key = column(row, 'group_key') || `row-${index + 2}`;
      const existing = grouped.get(key) ?? { line: index + 2, rows: [] };
      existing.rows.push(row); grouped.set(key, existing);
    });
    importPreview.value = Array.from(grouped.values()).map(({ line, rows: group }) => {
      const first = group[0]!;
      const title = column(first, 'title');
      const sameMetadata = group.every((row) => ['title', 'author', 'subject', 'classification'].every((key) => column(row, key) === column(first, key)));
      if (!sameMetadata) return { line, title, input: null, error: 'Các dòng cùng group_key phải có chung thông tin tài liệu.' };
      const editions = group.flatMap((row) => {
        const editionFields = ['publisher_id', 'isbn', 'language', 'publish_year', 'edition_no', 'call_number'];
        if (!editionFields.some((key) => column(row, key))) return [];
        const publishYear = column(row, 'publish_year'); const editionNo = column(row, 'edition_no');
        return [{ ...(column(row, 'publisher_id') ? { publisherId: column(row, 'publisher_id') } : {}), ...(column(row, 'isbn') ? { isbn: column(row, 'isbn') } : {}), ...(column(row, 'language') ? { language: column(row, 'language') } : {}), ...(publishYear ? { publishYear } : {}), ...(editionNo ? { editionNo } : {}), ...(column(row, 'call_number') ? { callNumber: column(row, 'call_number') } : {}) }];
      });
      const candidate = { title, ...(column(first, 'author') ? { author: column(first, 'author') } : {}), ...(column(first, 'subject') ? { subject: column(first, 'subject') } : {}), ...(column(first, 'classification') ? { classification: column(first, 'classification') } : {}), editions };
      const parsed = recordInputSchema.safeParse(candidate);
      return parsed.success ? { line, title: parsed.data.title, input: parsed.data, error: '' } : { line, title, input: null, error: parsed.error.issues.map((issue) => issue.message).join('; ') };
    });
    if (!importPreview.value.length) importMessage.value = 'Không có dòng dữ liệu để nhập.';
  } catch { importMessage.value = 'Không đọc được tệp. Hãy lưu thành CSV UTF-8 rồi thử lại.'; }
}
async function importRecords(): Promise<void> {
  if (importing.value) return;
  const valid = importPreview.value.filter((row) => row.input);
  if (!valid.length) return;
  importing.value = true; importMessage.value = '';
  let succeeded = 0;
  for (const row of valid) {
    try { await catalogApi.createRecord(row.input!); succeeded += 1; }
    catch (cause) { row.error = errorText(cause); row.input = null; }
  }
  importMessage.value = `Đã nhập ${succeeded}/${valid.length} bản ghi. Các bản ghi mới ở trạng thái nháp; hãy rà soát rồi gửi duyệt.`;
  if (succeeded) await load();
  importing.value = false;
}
async function load(): Promise<void> {
  const sequence = ++loadSequence;
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await catalogApi.listRecords(query.value);
    if (sequence !== loadSequence) return;
    records.value = result.items;
    total.value = result.total;
    if (query.value.page > Math.max(1, Math.ceil(result.total / query.value.pageSize))) changeQuery({ page: 1 });
  } catch (error) {
    if (sequence === loadSequence) errorMessage.value = errorText(error);
  } finally {
    if (sequence === loadSequence) loading.value = false;
  }
}
async function run(record: CatalogRecordDto, action: () => Promise<unknown>, message: string): Promise<boolean> {
  if (pendingId.value) return false;
  pendingId.value = record.id;
  errorMessage.value = '';
  notice.value = '';
  try {
    await action();
    notice.value = message;
    await load();
    return true;
  } catch (error) {
    errorMessage.value = errorText(error);
    return false;
  } finally { pendingId.value = null; }
}
async function startReject(record: CatalogRecordDto): Promise<void> {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  rejecting.value = record;
  rejectReason.value = '';
  dialogError.value = '';
  rejectDialog.value?.showModal();
  await nextTick();
  rejectInput.value?.focus();
}
function closeReject(): void { rejectDialog.value?.close(); }
function restoreFocus(): void { rejecting.value = null; if (returnFocus?.isConnected) returnFocus.focus(); else heading.value?.focus(); }
async function reject(): Promise<void> {
  const record = rejecting.value;
  if (!record || !rejectReason.value.trim() || pendingId.value) return;
  const success = await run(record, () => catalogApi.rejectRecord(record.id, rejectReason.value.trim()), 'Đã trả bản ghi về nháp kèm lý do từ chối.');
  if (success) closeReject();
  else dialogError.value = errorMessage.value;
}
watch(() => route.fullPath, () => { searchText.value = query.value.q ?? ''; void load(); }, { immediate: true });
</script>

<template>
  <section class="records">
    <div class="records__head"><div><p class="eyebrow">Danh mục tài liệu</p><h1 ref="heading" tabindex="-1">Sách &amp; tài liệu</h1><p>Soạn bản ghi, gửi duyệt rồi công bố để bạn đọc tra cứu.</p></div><RouterLink v-if="canWrite" :to="{ name: 'catalog-record-new' }">Tạo bản ghi</RouterLink></div>
    <form class="records__filters" role="search" @submit.prevent="changeQuery({ q: searchText.trim(), page: 1 })">
      <label>Tìm nhan đề, tác giả hoặc ISBN<input v-model="searchText" type="search" maxlength="200" placeholder="Nhập từ khóa…" /></label>
      <label>Trạng thái<select :value="query.status ?? ''" @change="changeQuery({ status: ($event.target as HTMLSelectElement).value, page: 1 })"><option value="">Tất cả</option><option v-for="status in RECORD_STATUS_OPTIONS" :key="status" :value="status">{{ statusLabel(status) }}</option></select></label>
      <label>Sắp xếp<select :value="query.sort" @change="changeQuery({ sort: ($event.target as HTMLSelectElement).value, page: 1 })"><option value="updated">Mới cập nhật</option><option value="title">Nhan đề A–Z</option><option value="oldest">Tạo lâu nhất</option></select></label>
      <button type="submit">Tìm kiếm</button>
    </form>
    <details v-if="canWrite" class="records__import"><summary>Nhập / Xuất CSV</summary><div class="records__import-tools"><div><strong>Nhập danh mục</strong><p>Tải mẫu CSV UTF-8. Một dòng là một ấn bản; có thể dùng chung group_key để gom nhiều ấn bản của cùng đầu sách.</p><button type="button" @click="downloadTemplate">Tải file mẫu</button><label>Chọn file CSV<input type="file" accept=".csv,text/csv" @change="previewImport" /></label><button type="button" :disabled="importing || !importPreview.some((row) => row.input)" @click="importRecords">{{ importing ? 'Đang nhập…' : `Nhập ${importPreview.filter((row) => row.input).length} đầu sách` }}</button></div><div><strong>Xuất danh mục</strong><p>Xuất toàn bộ kết quả đang lọc, bao gồm thông tin các ấn bản.</p><button type="button" :disabled="importing" @click="exportRecords">{{ importing ? 'Đang xử lý…' : 'Xuất CSV' }}</button></div></div><p v-if="importMessage" role="status">{{ importMessage }}</p><ul v-if="importPreview.length" class="records__import-preview"><li v-for="row in importPreview" :key="row.line"><span>Dòng {{ row.line }} · {{ row.title || '(chưa có nhan đề)' }}</span><small :class="row.error ? 'is-error' : 'is-valid'">{{ row.error || 'Hợp lệ · sẽ tạo nháp' }}</small></li></ul></details>
    <div v-if="query.q || query.status || query.rejected === 'true'" class="records__chips" aria-label="Bộ lọc đang áp dụng"><button v-if="query.q" type="button" @click="changeQuery({ q: undefined, page: 1 })">Từ khóa: {{ query.q }} ×</button><button v-if="query.status" type="button" @click="changeQuery({ status: undefined, page: 1 })">{{ statusLabel(query.status) }} ×</button><button v-if="query.rejected === 'true'" type="button" @click="changeQuery({ rejected: undefined, page: 1 })">Bị từ chối ×</button><button type="button" @click="changeQuery({ q: undefined, status: undefined, rejected: undefined, page: 1 })">Xóa tất cả</button></div>
    <p v-if="notice" role="status" class="records__notice">{{ notice }}</p>
    <p v-if="errorMessage" role="alert">{{ errorMessage }} <button type="button" @click="load">Thử lại</button></p>
    <div v-if="loading" class="records__skeleton" role="status" aria-label="Đang tải danh mục"><div v-for="n in 5" :key="n"></div></div>
    <div v-else-if="!errorMessage && !records.length" class="empty-state"><h2>{{ query.q || query.status ? 'Không có bản ghi khớp bộ lọc' : 'Chưa có bản ghi' }}</h2><p>Thử bỏ từ khóa hoặc trạng thái đang lọc.</p><RouterLink v-if="canWrite" :to="{ name: 'catalog-record-new' }">Tạo bản ghi mới</RouterLink></div>
    <div v-else-if="!errorMessage" class="records__table">
      <table><caption>{{ total }} bản ghi · Trang {{ query.page }}/{{ pageCount }}</caption><thead><tr><th scope="col" :aria-sort="query.sort === 'title' ? 'ascending' : 'none'"><button class="records__sort" @click="changeQuery({ sort: 'title', page: 1 })">Nhan đề ↕</button></th><th scope="col">Ấn bản</th><th scope="col">Tiến trình</th><th scope="col" :aria-sort="query.sort === 'updated' ? 'descending' : 'none'"><button class="records__sort" @click="changeQuery({ sort: 'updated', page: 1 })">Cập nhật ↕</button></th><th scope="col">Thao tác</th></tr></thead>
      <tbody><tr v-for="record in records" :key="record.id"><td><RouterLink :to="{ name: 'catalog-record-detail', params: { id: record.id } }"><strong>{{ record.title }}</strong></RouterLink><small>{{ record.author || 'Chưa có tác giả' }}</small><p v-if="record.rejectReason" class="records__reason">Lý do trả lại: {{ record.rejectReason }}</p></td><td>{{ record.editions.length }} ấn bản<small v-for="edition in record.editions.slice(0, 2)" :key="edition.id">{{ edition.publishYear || 'Chưa rõ năm' }} · {{ edition.isbn || 'Chưa có ISBN' }}</small></td><td><span class="status-badge" :data-state="record.status">{{ statusLabel(record.status) }}</span></td><td>{{ new Date(record.updatedAt).toLocaleDateString('vi-VN') }}</td><td><div class="records__actions">
      <button v-if="canWrite && record.status === 'draft'" :disabled="!!pendingId" @click="run(record, () => catalogApi.submitRecord(record.id), 'Đã gửi bản ghi chờ duyệt.')">Gửi duyệt</button>
      <button v-else-if="canApprove && record.status === 'pending'" :disabled="!!pendingId" @click="run(record, () => catalogApi.approveRecord(record.id), 'Đã duyệt bản ghi. Bạn có thể công bố.')">Duyệt</button>
      <button v-else-if="canApprove && record.status === 'approved'" :disabled="!!pendingId" @click="run(record, () => catalogApi.publishRecord(record.id), 'Đã công bố bản ghi trên tra cứu.')">Công bố</button>
      <RouterLink v-else :to="{ name: 'catalog-record-detail', params: { id: record.id } }">Xem chi tiết</RouterLink>
      <details v-if="(canWrite && ['draft', 'withdrawn'].includes(record.status)) || (canApprove && record.status === 'pending')" class="records__more" @keydown.esc="($event.currentTarget as HTMLDetailsElement).open = false"><summary :aria-label="`Thao tác khác: ${record.title}`">⋯</summary><div><RouterLink v-if="canWrite && ['draft', 'withdrawn'].includes(record.status)" :to="{ name: 'catalog-record-edit', params: { id: record.id } }">Sửa bản ghi</RouterLink><button v-if="canApprove && record.status === 'pending'" :disabled="!!pendingId" @click="startReject(record)">Từ chối và ghi lý do</button></div></details>
      </div></td></tr></tbody></table>
    </div>
    <nav v-if="!loading && total" class="records__pagination" aria-label="Phân trang danh mục"><label>Số dòng<select :value="query.pageSize" @change="changeQuery({ pageSize: Number(($event.target as HTMLSelectElement).value), page: 1 })"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option></select></label><button :disabled="query.page <= 1" @click="changeQuery({ page: query.page - 1 })">← Trang trước</button><span>{{ query.page }} / {{ pageCount }}</span><button :disabled="query.page >= pageCount" @click="changeQuery({ page: query.page + 1 })">Trang sau →</button></nav>
    <dialog ref="rejectDialog" aria-labelledby="reject-title" @close="restoreFocus" @cancel="pendingId ? $event.preventDefault() : undefined"><form @submit.prevent="reject"><h2 id="reject-title">Từ chối bản ghi</h2><p>{{ rejecting?.title }}</p><label>Lý do bắt buộc<textarea ref="rejectInput" v-model="rejectReason" required maxlength="500" rows="4" placeholder="Nêu rõ nội dung cần bổ sung hoặc sửa…"></textarea></label><p v-if="dialogError" role="alert">{{ dialogError }}</p><div class="records__actions"><button type="submit" :disabled="!!pendingId || !rejectReason.trim()">{{ pendingId ? 'Đang xử lý…' : 'Xác nhận từ chối' }}</button><button type="button" :disabled="!!pendingId" @click="closeReject">Hủy</button></div></form></dialog>
  </section>
</template>
<style scoped>
.records__head,.records__actions,.records__pagination,.records__chips{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.records__head{justify-content:space-between;margin-bottom:24px}.records__head h1{margin:4px 0}.records__head p{color:var(--muted)}.records__filters{display:grid;grid-template-columns:minmax(220px,2fr) 1fr 1fr auto;align-items:end;gap:14px;margin-bottom:14px}.records__chips{margin:14px 0}.records__chips button{font-size:.8rem;border-radius:20px}.records__table{overflow-x:auto}td{vertical-align:top}td small{display:block;margin-top:6px;color:var(--muted);font-size:.75rem}.records__reason{max-width:350px;font-size:.8rem;color:#994224}.records__sort{background:transparent;color:inherit;border:0;padding:0;font-weight:700}.records__more{position:relative}.records__more summary{cursor:pointer;padding:6px 12px;border:1px solid var(--line);border-radius:6px;list-style:none}.records__more>div{position:relative;width:210px;padding:12px;background:white;border:1px solid var(--line);box-shadow:0 6px 20px #0002;display:grid;gap:10px}.records__pagination{justify-content:flex-end;margin-top:20px}.records__pagination label{display:flex;align-items:center;gap:8px}.records__pagination select{width:auto}.records__notice{padding:12px;background:#e8f5ed;color:#24543b;border-radius:8px}dialog{width:min(520px,calc(100% - 32px));border:1px solid var(--line);border-radius:12px;padding:26px}dialog::backdrop{background:#10233f88}dialog form{display:grid;gap:16px}dialog textarea{width:100%;font:inherit;border:1px solid var(--line);border-radius:6px;padding:10px}.records__skeleton{display:grid;gap:12px}.records__skeleton div{height:64px;background:#e6ebf2;border-radius:6px}@media(max-width:800px){.records__filters{grid-template-columns:1fr 1fr}.records__head{align-items:flex-start}}@media(max-width:480px){.records__filters{grid-template-columns:1fr}.records__pagination{justify-content:flex-start}}
.records__import{margin:16px 0;padding:14px 16px;border:1px solid var(--line);border-radius:9px;background:#fbfcff}.records__import>summary{cursor:pointer;font-weight:700;color:var(--navy)}.records__import-tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}.records__import-tools>div{display:grid;justify-items:start;align-content:start;gap:9px;padding:14px;background:white;border:1px solid var(--line);border-radius:8px}.records__import-tools p{margin:0;color:var(--muted);font-size:.82rem}.records__import-tools label{display:grid;gap:6px;font-size:.82rem}.records__import-preview{max-height:220px;overflow:auto;padding:0;list-style:none}.records__import-preview li{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-bottom:1px solid var(--line);font-size:.8rem}.records__import-preview small{flex:0 1 45%;text-align:right}.records__import-preview .is-error{color:#a33}.records__import-preview .is-valid{color:#286448}@media(max-width:600px){.records__import-tools{grid-template-columns:1fr}.records__import-preview li{display:grid}.records__import-preview small{text-align:left}}
</style>
