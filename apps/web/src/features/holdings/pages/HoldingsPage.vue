<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { CatalogRecordDto, CopyDto, CopyStatus, LocationDto, Paginated } from '@thu-vien/shared';
import { useSessionStore } from '@/features/auth/session.store';
import { ApiError } from '@/shared/api/client';
import * as catalogApi from '@/features/catalog/api';
import * as api from '../api';
import { COPY_STATUS_OPTIONS, copyStatusLabel } from '../status';

const session = useSessionStore();
const route = useRoute();
const router = useRouter();
const canManage = computed(() => session.can('holdings:manage'));
const canEditCatalog = computed(() => session.can('catalog:write'));
const result = ref<Paginated<CopyDto> | null>(null);
const locations = ref<LocationDto[]>([]);
const locationTotal = ref(0);
const locationPage = ref(0);
const loadingLocations = ref(false);
const records = ref<Paginated<CatalogRecordDto> | null>(null);
const loadingEditions = ref(false);
const editionSearch = ref('');
const editionQuery = ref('');
const loading = ref(true);
const error = ref('');
const notice = ref('');
const statusFilter = ref<CopyStatus | ''>('');
const codeFilter = ref('');
const totalPages = computed(() => Math.max(1, Math.ceil((result.value?.total ?? 0) / 20)));
const dialog = ref<HTMLDialogElement | null>(null);
const dialogMode = ref<'copies' | 'locations' | 'callNumber' | 'edit'>('copies');
const dialogError = ref('');
const dialogNotice = ref('');
const submitting = ref(false);
const selectedCopy = ref<CopyDto | null>(null);
const locationForm = reactive({ code: '', name: '' });
const copyForm = reactive({ editionId: '', count: 1, locationId: '' });
const callNumberForm = reactive({ editionId: '', callNumber: '' });
const editForm = reactive({ locationId: '', activate: false });
let listRequest = 0;
let editionRequest = 0;
const titles = { copies: 'Thêm bản sao', locations: 'Quản lý vị trí kệ', callNumber: 'Mã xếp giá cho ấn bản', edit: 'Cập nhật bản sao' };
const editionOptions = computed(() => (records.value?.items ?? []).flatMap(record => record.editions.map(edition => ({
  id: edition.id, recordId: record.id, callNumber: edition.callNumber,
  label: `${record.title} — ${edition.publishYear ?? 'Chưa rõ năm'}${edition.isbn ? ` · ISBN ${edition.isbn}` : ''}`,
}))));
const editChanged = computed(() => selectedCopy.value && ((selectedCopy.value.locationId ?? '') !== editForm.locationId || editForm.activate));
function errorText(cause: unknown, fallback: string): string {
  if (!(cause instanceof ApiError)) return fallback;
  if (cause.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  const errors: Record<string, string> = {
    DUPLICATE: dialogMode.value === 'locations' ? 'Mã vị trí đã tồn tại. Chọn mã khác.' : 'Mã cuốn bị trùng. Kiểm tra mã xếp giá của ấn bản.',
    RECORD_NOT_PUBLISHED: 'Bản ghi phải được công bố trước khi thêm bản sao hoặc đưa vào phục vụ.',
    CALL_NUMBER_REQUIRED: 'Ấn bản chưa có mã xếp giá. Cập nhật mã xếp giá trước.',
    LOCATION_REQUIRED: 'Chọn vị trí kệ trước khi đưa bản sao vào phục vụ.',
    OPEN_INCIDENT: 'Bản sao đang được tra soát sự cố, chưa thể đưa vào phục vụ.',
    COPY_CHANGED: 'Bản sao vừa được thay đổi. Đóng hộp thoại và tải lại danh sách.',
    INVALID_STATE: 'Trạng thái bản sao đã thay đổi. Tải lại danh sách để tiếp tục.',
  };
  return errors[cause.code] ?? (cause.status >= 500 ? fallback : cause.message);
}
function applyFilters(page = 1): void {
  void router.push({ path: route.path, query: { ...(codeFilter.value.trim() ? { code: codeFilter.value.trim() } : {}), ...(statusFilter.value ? { status: statusFilter.value } : {}), page: String(page) } });
}
function clearFilters(): void { codeFilter.value = ''; statusFilter.value = ''; applyFilters(); }
async function load(): Promise<void> {
  const request = ++listRequest;
  statusFilter.value = COPY_STATUS_OPTIONS.includes(route.query.status as CopyStatus) ? route.query.status as CopyStatus : '';
  codeFilter.value = typeof route.query.code === 'string' ? route.query.code : '';
  loading.value = true; error.value = '';
  try {
    const response = await api.listCopies({ page: Math.max(1, Math.floor(Number(route.query.page) || 1)), pageSize: 20, status: statusFilter.value || undefined, code: codeFilter.value.trim() || undefined });
    if (request === listRequest) result.value = response;
  } catch (cause) { if (request === listRequest) error.value = errorText(cause, 'Không tải được danh sách bản sao. Vui lòng thử lại.'); }
  finally { if (request === listRequest) loading.value = false; }
}
async function loadLocations(reset = false): Promise<void> {
  if (loadingLocations.value) return;
  loadingLocations.value = true;
  try {
    const page = reset ? 1 : locationPage.value + 1;
    const response = await api.listLocations({ page, pageSize: 100 });
    locations.value = reset ? response.items : [...locations.value, ...response.items];
    locationTotal.value = response.total; locationPage.value = page;
  } catch (cause) { dialogError.value = errorText(cause, 'Không tải được vị trí kệ. Vui lòng thử lại.'); }
  finally { loadingLocations.value = false; }
}
async function loadEditions(page = 1): Promise<void> {
  const request = ++editionRequest;
  loadingEditions.value = true;
  copyForm.editionId = ''; callNumberForm.editionId = ''; callNumberForm.callNumber = '';
  if (page === 1) editionQuery.value = editionSearch.value.trim();
  try {
    const response = await catalogApi.listRecords({ status: 'published', q: editionQuery.value || undefined, page, pageSize: 10 });
    if (request === editionRequest) records.value = response;
  } catch (cause) { if (request === editionRequest) dialogError.value = errorText(cause, 'Không tải được ấn bản. Vui lòng thử lại.'); }
  finally { if (request === editionRequest) loadingEditions.value = false; }
}
async function openDialog(mode: typeof dialogMode.value, copy?: CopyDto): Promise<void> {
  dialogMode.value = mode; dialogError.value = ''; dialogNotice.value = '';
  selectedCopy.value = copy ?? null;
  editForm.locationId = copy?.locationId ?? ''; editForm.activate = false;
  copyForm.editionId = ''; copyForm.count = 1; copyForm.locationId = '';
  callNumberForm.editionId = ''; callNumberForm.callNumber = '';
  locationForm.code = ''; locationForm.name = '';
  await nextTick(); dialog.value?.showModal();
  if (mode !== 'callNumber' && !locations.value.length) void loadLocations(true);
  if (mode === 'copies' || mode === 'callNumber') { editionSearch.value = ''; records.value = null; void loadEditions(); }
}
function closeDialog(): void { if (!submitting.value) dialog.value?.close(); }
async function submit(): Promise<void> {
  if (submitting.value) return;
  submitting.value = true; dialogError.value = ''; dialogNotice.value = '';
  try {
    if (dialogMode.value === 'locations') {
      const location = await api.createLocation({ code: locationForm.code.trim(), name: locationForm.name.trim() });
      locationForm.code = ''; locationForm.name = '';
      await loadLocations(true);
      dialogNotice.value = `Đã thêm vị trí ${location.code} · ${location.name}.`;
      notice.value = dialogNotice.value;
      return;
    }
    if (dialogMode.value === 'copies') {
      const created = await api.createCopies({ editionId: copyForm.editionId, count: copyForm.count, ...(copyForm.locationId ? { locationId: copyForm.locationId } : {}) });
      notice.value = `Đã thêm ${created.length} bản sao ở trạng thái đang xử lý.`;
    } else if (dialogMode.value === 'callNumber') {
      const edition = editionOptions.value.find(option => option.id === callNumberForm.editionId);
      if (!edition) { dialogError.value = 'Chọn ấn bản trước khi lưu mã xếp giá.'; return; }
      await catalogApi.setCallNumber(edition.recordId, edition.id, { callNumber: callNumberForm.callNumber.trim() });
      notice.value = 'Đã lưu mã xếp giá của ấn bản.';
    } else {
      const copy = selectedCopy.value;
      if (!copy || !editChanged.value) return;
      await api.updateCopy(copy.id, { locationId: editForm.locationId || null, ...(editForm.activate ? { status: 'available' } : {}) });
      notice.value = `Đã cập nhật bản sao ${copy.code}.`;
    }
    dialog.value?.close(); await load();
  } catch (cause) { dialogError.value = errorText(cause, 'Không lưu được thay đổi. Dữ liệu đã nhập vẫn được giữ để thử lại.'); }
  finally { submitting.value = false; }
}
watch(() => route.fullPath, () => void load());
watch(() => editForm.locationId, value => { if (!value) editForm.activate = false; });
onMounted(() => void load());
onBeforeUnmount(() => { ++listRequest; ++editionRequest; });
</script>

<template>
  <section class="holdings" aria-labelledby="holdings-title">
    <header class="holdings__heading"><div><p class="eyebrow">Kho tài liệu</p><h1 id="holdings-title">Bản sao &amp; vị trí kệ</h1><p>Tra mã cuốn, kiểm tra trạng thái và vị trí trước khi cập nhật.</p></div><div class="holdings__tools"><button v-if="canManage" type="button" @click="openDialog('copies')">Thêm bản sao</button><button v-if="canManage" class="holdings__secondary" type="button" @click="openDialog('locations')">Vị trí kệ</button><button v-if="canEditCatalog" class="holdings__secondary" type="button" @click="openDialog('callNumber')">Mã xếp giá</button></div></header>
    <p v-if="notice" class="holdings__notice" role="status">{{ notice }}</p>
    <form class="holdings__filters" @submit.prevent="applyFilters()"><label>Mã cuốn<input v-model="codeFilter" type="search" maxlength="100" placeholder="Nhập hoặc quét mã cuốn" /></label><label>Trạng thái<select v-model="statusFilter"><option value="">Tất cả trạng thái</option><option v-for="status in COPY_STATUS_OPTIONS" :key="status" :value="status">{{ copyStatusLabel(status) }}</option></select></label><button type="submit" :disabled="loading">Áp dụng</button><button class="holdings__secondary" type="button" :disabled="loading" @click="clearFilters">Xóa bộ lọc</button></form>
    <div v-if="route.query.code || route.query.status" class="holdings__chips" aria-label="Bộ lọc đang áp dụng"><button v-if="route.query.code" type="button" @click="codeFilter = ''; applyFilters()">Mã: {{ route.query.code }} ×</button><button v-if="route.query.status" type="button" @click="statusFilter = ''; applyFilters()">{{ copyStatusLabel(String(route.query.status)) }} ×</button></div>
    <div v-if="error" role="alert"><p>{{ error }}</p><button type="button" @click="load">Thử lại</button></div>
    <div v-if="loading" class="holdings__skeleton" role="status" aria-label="Đang tải bản sao"><span v-for="n in 4" :key="n"></span></div>
    <template v-else-if="result && !error"><div class="holdings__count"><h2>Danh sách bản sao</h2><span>{{ result.total }} bản sao · Trang {{ result.page }} / {{ totalPages }}</span></div>
      <div v-if="!result.items.length" class="empty-state"><p>Không có bản sao trong bộ lọc này.</p><button v-if="route.query.code || route.query.status" type="button" @click="clearFilters">Xem tất cả bản sao</button><button v-else-if="canManage" type="button" @click="openDialog('copies')">Thêm bản sao đầu tiên</button></div>
      <div v-else class="holdings__table"><table><thead><tr><th scope="col">Mã cuốn</th><th scope="col">Tài liệu</th><th scope="col">Trạng thái</th><th scope="col">Vị trí kệ</th><th v-if="canManage" scope="col">Thao tác</th></tr></thead><tbody><tr v-for="copy in result.items" :key="copy.id"><td data-label="Mã cuốn"><strong>{{ copy.code }}</strong></td><td data-label="Tài liệu">{{ copy.workTitle || 'Chưa có nhan đề' }}</td><td data-label="Trạng thái"><span class="status-badge" :data-state="copy.status">{{ copyStatusLabel(copy.status) }}</span></td><td data-label="Vị trí kệ">{{ copy.locationName || 'Chưa xếp kệ' }}</td><td v-if="canManage" data-label="Thao tác"><button type="button" class="holdings__secondary" :aria-label="`Cập nhật bản sao ${copy.code}`" @click="openDialog('edit', copy)">Cập nhật</button></td></tr></tbody></table></div>
      <nav class="holdings__pagination" aria-label="Phân trang bản sao"><button type="button" :disabled="result.page <= 1" @click="applyFilters(result.page - 1)">Trang trước</button><span>Trang {{ result.page }} / {{ totalPages }}</span><button type="button" :disabled="result.page >= totalPages" @click="applyFilters(result.page + 1)">Trang sau</button></nav>
    </template>
    <dialog ref="dialog" class="holdings__dialog" aria-labelledby="holdings-dialog-title" @cancel="submitting && $event.preventDefault()">
      <header><div><p class="eyebrow">Kho tài liệu</p><h2 id="holdings-dialog-title">{{ titles[dialogMode] }}</h2></div><button type="button" class="holdings__secondary" aria-label="Đóng hộp thoại" :disabled="submitting" @click="closeDialog">Đóng ×</button></header>
      <p v-if="dialogError" role="alert">{{ dialogError }}</p><p v-if="dialogNotice" class="holdings__notice" role="status">{{ dialogNotice }}</p><p v-if="loadingLocations && dialogMode !== 'locations'" role="status">Đang tải vị trí kệ…</p>
      <template v-if="dialogMode === 'copies' || dialogMode === 'callNumber'">
        <form class="holdings__picker-search" @submit.prevent="loadEditions()"><label>Tìm tài liệu đã công bố<input v-model="editionSearch" type="search" maxlength="200" placeholder="Nhan đề, tác giả hoặc ISBN" :disabled="submitting" /></label><button type="submit" :disabled="loadingEditions || submitting">Tìm ấn bản</button></form>
        <p v-if="loadingEditions" role="status">Đang tải ấn bản…</p><p v-else-if="records && !editionOptions.length" class="empty-state">Chưa có ấn bản đã công bố phù hợp. Thử từ khóa khác hoặc công bố bản ghi trong danh mục tài liệu.</p>
        <div v-if="records && records.total > records.pageSize" class="holdings__pagination"><button type="button" :disabled="records.page <= 1 || loadingEditions || submitting" @click="loadEditions(records.page - 1)">Ấn bản trước</button><span>Trang {{ records.page }} / {{ Math.ceil(records.total / records.pageSize) }}</span><button type="button" :disabled="records.page * records.pageSize >= records.total || loadingEditions || submitting" @click="loadEditions(records.page + 1)">Ấn bản sau</button></div>
      </template>
      <form class="holdings__editor" @submit.prevent="submit">
        <fieldset :disabled="submitting"><legend class="holdings__sr-only">{{ titles[dialogMode] }}</legend>
          <template v-if="dialogMode === 'locations'"><p>Thêm vị trí để xếp các bản sao lên đúng kệ.</p><label>Mã vị trí<input v-model="locationForm.code" required maxlength="50" /></label><label>Tên vị trí<input v-model="locationForm.name" required maxlength="200" /></label></template>
          <template v-else-if="dialogMode === 'copies'"><label>Ấn bản<select v-model="copyForm.editionId" required :disabled="loadingEditions"><option value="">Chọn ấn bản</option><option v-for="option in editionOptions" :key="option.id" :value="option.id">{{ option.label }}</option></select></label><label>Số bản sao<input v-model.number="copyForm.count" type="number" min="1" max="50" required /></label><label>Vị trí kệ<select v-model="copyForm.locationId"><option value="">Chưa xếp kệ</option><option v-for="location in locations" :key="location.id" :value="location.id">{{ location.code }} · {{ location.name }}</option></select></label><p class="holdings__hint">Bản sao mới ở trạng thái đang xử lý. Chỉ đưa vào phục vụ sau khi có mã xếp giá và vị trí kệ.</p></template>
          <template v-else-if="dialogMode === 'callNumber'"><label>Ấn bản<select v-model="callNumberForm.editionId" required :disabled="loadingEditions" @change="callNumberForm.callNumber = editionOptions.find(option => option.id === callNumberForm.editionId)?.callNumber || ''"><option value="">Chọn ấn bản</option><option v-for="option in editionOptions" :key="option.id" :value="option.id">{{ option.label }}{{ option.callNumber ? ` · ${option.callNumber}` : '' }}</option></select></label><label>Mã xếp giá<input v-model="callNumberForm.callNumber" required maxlength="100" autocomplete="off" /></label></template>
          <template v-else-if="selectedCopy"><div class="holdings__summary"><strong>{{ selectedCopy.code }} · {{ selectedCopy.workTitle }}</strong><span>{{ copyStatusLabel(selectedCopy.status) }} · {{ selectedCopy.locationName || 'Chưa xếp kệ' }}</span></div><label>Vị trí kệ mới<select v-model="editForm.locationId"><option value="">Chưa xếp kệ</option><option v-if="selectedCopy.locationId && !locations.some(location => location.id === selectedCopy?.locationId)" :value="selectedCopy.locationId">{{ selectedCopy.locationName || 'Vị trí hiện tại' }}</option><option v-for="location in locations" :key="location.id" :value="location.id">{{ location.code }} · {{ location.name }}</option></select></label><label v-if="selectedCopy.status === 'processing'" class="holdings__check"><input v-model="editForm.activate" type="checkbox" :disabled="!editForm.locationId" /> Đưa vào phục vụ sau khi lưu</label><p class="holdings__hint">Chọn vị trí chỉ thay đổi biểu mẫu. Bấm Lưu thay đổi để cập nhật bản sao.</p></template>
        </fieldset>
        <button v-if="dialogMode === 'copies' || dialogMode === 'locations' || dialogMode === 'edit'" v-show="locations.length < locationTotal" class="holdings__secondary" type="button" :disabled="loadingLocations || submitting" @click="loadLocations()">{{ loadingLocations ? 'Đang tải vị trí…' : `Tải thêm vị trí (${locations.length}/${locationTotal})` }}</button>
        <footer><button class="holdings__secondary" type="button" :disabled="submitting" @click="closeDialog">{{ dialogMode === 'locations' ? 'Đóng' : 'Hủy' }}</button><button type="submit" :disabled="submitting || loadingEditions || (dialogMode === 'edit' && !editChanged)">{{ submitting ? 'Đang lưu…' : dialogMode === 'copies' ? 'Tạo bản sao' : dialogMode === 'locations' ? 'Thêm vị trí' : 'Lưu thay đổi' }}</button></footer>
      </form>
      <template v-if="dialogMode === 'locations'"><h3>Vị trí hiện có ({{ locationTotal }})</h3><p v-if="loadingLocations" role="status">Đang tải vị trí…</p><ul class="holdings__locations"><li v-for="location in locations" :key="location.id"><strong>{{ location.code }}</strong><span>{{ location.name }}</span></li></ul><p v-if="!loadingLocations && !locations.length" class="empty-state">Chưa có vị trí kệ. Thêm vị trí đầu tiên ở biểu mẫu phía trên.</p></template>
    </dialog>
  </section>
</template>
<style scoped>
.holdings__heading,.holdings__tools,.holdings__count,.holdings__dialog header,.holdings__dialog footer { display:flex;justify-content:space-between;align-items:center;gap:14px; }
.holdings__heading { align-items:flex-start;flex-wrap:wrap;margin-bottom:25px; }.holdings__heading h1 { margin:6px 0 8px; }.holdings__heading p:last-child,.holdings__count > span,.holdings__hint { color:var(--muted);font-size:.86rem; }.holdings__tools { flex-wrap:wrap;justify-content:flex-start;gap:8px; }
.holdings__secondary { background:white;color:var(--navy);border:1px solid var(--line); }.holdings__filters { display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;padding:18px;border:1px solid var(--line);border-radius:10px;background:#f8faff; }.holdings__filters label:first-child { flex:1 1 230px; }.holdings__filters label:nth-child(2) { flex:0 1 230px; }
.holdings__chips { display:flex;gap:8px;margin-top:12px; }.holdings__chips button { padding:5px 10px;background:#edf2fb;color:var(--navy);border-radius:999px;font-size:.8rem; }.holdings__notice { padding:12px 15px;background:#e8f5ed;color:#246248;border-radius:8px; }.holdings__count { flex-wrap:wrap;margin:24px 0 10px; }.holdings__count h2 { margin:0;font-size:1.1rem; }
.holdings__table { overflow:auto; }.holdings__table button { font-size:.8rem;white-space:nowrap; }.holdings__pagination { display:flex;justify-content:center;align-items:center;gap:12px;margin:20px 0 0;font-size:.84rem; }
.holdings__skeleton { display:grid;gap:12px;margin-top:24px; }.holdings__skeleton span { height:55px;background:#edf1f6;border-radius:5px; }
.holdings__dialog { width:min(740px,calc(100vw - 32px));max-height:85vh;padding:26px;border:1px solid var(--line);border-radius:14px;color:var(--ink); }.holdings__dialog::backdrop { background:#12213b8c; }.holdings__dialog h2 { margin:5px 0 0; }.holdings__dialog header { align-items:flex-start;margin-bottom:20px; }.holdings__editor { display:grid;gap:14px; }.holdings__editor fieldset { display:grid;gap:15px;margin:0;padding:0;border:0;min-width:0; }.holdings__editor footer { justify-content:flex-end;padding-top:17px;border-top:1px solid var(--line); }.holdings__picker-search { display:flex;align-items:flex-end;gap:10px;margin:16px 0; }.holdings__picker-search label { flex:1; }.holdings__summary { display:grid;gap:8px;padding:14px;background:#f3f6fb;border-radius:8px; }.holdings__summary span { color:var(--muted);font-size:.85rem; }.holdings__check { display:flex;align-items:center;gap:8px; }.holdings__check input { width:18px;height:18px; }.holdings__locations { display:grid;gap:0;list-style:none;padding:0;max-height:240px;overflow:auto; }.holdings__locations li { display:grid;grid-template-columns:100px 1fr;gap:12px;padding:10px 0;border-bottom:1px solid var(--line); }.holdings__sr-only { position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%); }
@media(max-width:600px) { .holdings__dialog { padding:18px; }.holdings__picker-search { flex-direction:column;align-items:stretch; }.holdings__tools { width:100%; }.holdings__table table,.holdings__table tbody,.holdings__table tr,.holdings__table td { display:block; }.holdings__table thead { display:none; }.holdings__table tr { padding:12px 0;border-bottom:1px solid var(--line); }.holdings__table td { padding:7px;border:0; }.holdings__table td::before { content:attr(data-label);display:block;font-size:.7rem;color:var(--muted);margin-bottom:3px; } }
</style>
