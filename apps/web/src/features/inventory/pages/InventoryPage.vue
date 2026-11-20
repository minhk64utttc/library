<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { INVENTORY_RESULTS, type InventoryItemDto, type InventoryResult, type InventoryRunDto, type LocationDto } from '@thu-vien/shared';
import { useSessionStore } from '@/features/auth/session.store';
import { ApiError } from '@/shared/api/client';
import * as api from '../api';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const canManage = computed(() => session.can('inventory:manage'));
const canDecide = computed(() => session.can('inventory:decide'));
const runId = computed(() => typeof route.params.id === 'string' ? route.params.id : '');
const page = computed(() => Math.max(1, Number.parseInt(String(route.query.page ?? '1'), 10) || 1));
const filter = computed(() => INVENTORY_RESULTS.includes(route.query.result as InventoryResult) ? route.query.result as InventoryResult : undefined);
const labels: Record<InventoryResult, string> = {
  unchecked: 'Chưa quét', matched: 'Đúng vị trí', misplaced: 'Sai vị trí', on_loan: 'Đang mượn',
  unexpected: 'Ngoài danh sách ban đầu',
  moved: 'Đã chuyển vị trí', changed: 'Có biến động', pending_search: 'Chờ tra soát', found: 'Đã tìm thấy', lost: 'Đã xác nhận mất', excluded: 'Đang xử lý khác',
};
const runs = ref<InventoryRunDto[]>([]);
const run = ref<InventoryRunDto | null>(null);
const items = ref<InventoryItemDto[]>([]);
const locations = ref<LocationDto[]>([]);
const total = ref(0);
const loading = ref(false);
const pending = ref(false);
const error = ref('');
const success = ref('');
const selected = ref<InventoryItemDto | null>(null);
const scanInput = ref<HTMLInputElement | null>(null);
const actionPanel = ref<HTMLElement | null>(null);
const createForm = reactive({ name: '', locationId: '' });
const scanForm = reactive({ code: '', locationId: '' });
const resolution = reactive({ locationId: '', note: '', action: 'found' });
let loadVersion = 0;

const blockedCount = computed(() => (run.value?.counts.unchecked ?? 0) + (run.value?.counts.pending_search ?? 0) + (run.value?.counts.misplaced ?? 0));
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 20)));
const locationName = (id: string | null) => locations.value.find((location) => location.id === id)?.name ?? (id ? 'Vị trí không còn trong danh mục' : 'Chưa có');

function failure(value: unknown): string {
  if (value instanceof ApiError && value.status === 403) return 'Tài khoản không có quyền thực hiện thao tác này.';
  if (value instanceof ApiError && value.status === 409) return 'Dữ liệu đã thay đổi, đợt đã đóng hoặc còn bản sao chưa xử lý. Hãy kiểm tra và tải lại.';
  if (value instanceof ApiError && value.status === 404) return 'Không tìm thấy mã cuốn trong đợt kiểm kê hoặc vị trí đã chọn.';
  return 'Không thực hiện được yêu cầu. Kiểm tra dữ liệu và thử lại.';
}

async function load(): Promise<void> {
  const version = ++loadVersion;
  loading.value = true;
  error.value = '';
  selected.value = null;
  try {
    const [locationRows, result, detail] = await Promise.all([
      api.locations(),
      runId.value ? api.listItems(runId.value, page.value, filter.value) : api.listRuns(page.value),
      runId.value ? api.getRun(runId.value) : Promise.resolve(null),
    ]);
    if (version !== loadVersion) return;
    locations.value = locationRows;
    run.value = detail;
    total.value = result.total;
    if (detail) {
      items.value = result.items as InventoryItemDto[];
      if (!scanForm.locationId) scanForm.locationId = detail.locationId;
    } else runs.value = result.items as InventoryRunDto[];
  } catch (cause) {
    if (version === loadVersion) error.value = failure(cause);
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}

async function perform(action: () => Promise<unknown>, message: string): Promise<void> {
  if (pending.value) return;
  pending.value = true;
  error.value = '';
  success.value = '';
  try {
    await action();
    await load();
    success.value = message;
  } catch (cause) { error.value = failure(cause); }
  finally { pending.value = false; }
}

async function create(): Promise<void> {
  await perform(async () => {
    const created = await api.createRun(createForm);
    await router.push({ name: 'inventory-detail', params: { id: created.id } });
  }, 'Đã mở đợt và lưu danh sách bản sao dự kiến.');
}

async function scan(): Promise<void> {
  await perform(async () => {
    await api.scan(runId.value, scanForm);
    scanForm.code = '';
  }, 'Đã ghi nhận mã cuốn và vị trí thực tế.');
  await nextTick();
  scanInput.value?.focus();
}

async function selectItem(item: InventoryItemDto): Promise<void> {
  selected.value = item;
  resolution.locationId = item.expectedLocationId ?? '';
  resolution.note = '';
  resolution.action = canManage.value ? 'found' : 'lost';
  await nextTick();
  actionPanel.value?.focus();
}

async function resolve(): Promise<void> {
  const item = selected.value;
  if (!item) return;
  await perform(() => resolution.action === 'found'
    ? api.found(runId.value, item.id, { locationId: resolution.locationId, note: resolution.note })
    : api.lost(runId.value, item.id, { note: resolution.note }), 'Đã ghi nhận kết quả tra soát.');
}

function changePage(value: number): void { void router.replace({ query: { ...route.query, page: value === 1 ? undefined : String(value) } }); }
function changeFilter(event: Event): void { void router.replace({ query: { result: (event.target as HTMLSelectElement).value || undefined } }); }
watch(() => [runId.value, page.value, filter.value], () => { void load(); }, { immediate: true });
</script>

<template>
  <section class="inventory">
    <RouterLink v-if="runId" to="/inventory">← Danh sách đợt kiểm kê</RouterLink>
    <span v-else class="eyebrow">Kho tài liệu</span>
    <h1>{{ runId ? (run?.name ?? 'Chi tiết kiểm kê') : 'Kiểm kê thư viện' }}</h1>
    <p class="inventory__intro">Quét mã cuốn tại kệ, đối soát biến động và tra soát các bản sao chưa tìm thấy.</p>
    <p v-if="error" role="alert">{{ error }} <button type="button" :disabled="pending || loading" @click="load">Tải lại</button></p>
    <p v-if="success" role="status">{{ success }}</p>
    <p v-if="loading" role="status">Đang tải dữ liệu kiểm kê…</p>

    <template v-if="!runId">
      <fieldset v-if="canManage">
        <legend>Mở đợt kiểm kê</legend>
        <form @submit.prevent="create">
          <label>Tên đợt<input v-model="createForm.name" required minlength="3" maxlength="200" placeholder="Ví dụ: Kiểm kê kho A tháng 10" /></label>
          <label>Vị trí kiểm kê<select v-model="createForm.locationId" required><option value="">Chọn vị trí</option><option v-for="location in locations" :key="location.id" :value="location.id">{{ location.code }} · {{ location.name }}</option></select></label>
          <button type="submit" :disabled="pending || loading">Mở đợt</button>
        </form>
      </fieldset>
      <p v-if="!loading && !error && !runs.length" class="empty-state">Chưa có đợt kiểm kê. Chọn vị trí để bắt đầu.</p>
      <div v-if="runs.length" class="table-scroll">
        <table><thead><tr><th scope="col">Tên đợt</th><th scope="col">Vị trí</th><th scope="col">Số cuốn</th><th scope="col">Trạng thái</th></tr></thead>
          <tbody><tr v-for="entry in runs" :key="entry.id"><td><RouterLink :to="`/inventory/${entry.id}`">{{ entry.name }}</RouterLink></td><td>{{ entry.locationName }}</td><td>{{ entry.total }}</td><td>{{ entry.closedAt ? 'Đã đóng' : 'Đang kiểm kê' }}</td></tr></tbody>
        </table>
      </div>
    </template>

    <template v-else-if="run">
      <p><strong>{{ run.locationName }}</strong> · {{ run.total }} bản sao · {{ run.closedAt ? 'Đã đóng đợt' : 'Đang kiểm kê' }}</p>
      <div class="inventory__summary" aria-label="Tổng hợp kết quả">
        <span v-for="(count, result) in run.counts" :key="result"><strong>{{ count }}</strong> {{ labels[result] }}</span>
      </div>
      <fieldset v-if="canManage && !run.closedAt">
        <legend>Quét mã cuốn</legend>
        <form @submit.prevent="scan">
          <label>Mã cuốn<input ref="scanInput" v-model="scanForm.code" required maxlength="100" autocomplete="off" placeholder="Quét barcode hoặc nhập mã cuốn" /></label>
          <label>Vị trí đang quét<select v-model="scanForm.locationId" required><option v-for="location in locations" :key="location.id" :value="location.id">{{ location.name }}</option></select></label>
          <button type="submit" :disabled="pending || loading">Ghi nhận</button>
        </form>
        <p class="inventory__hint">Nếu phát hiện sai vị trí, đưa sách về kệ đúng rồi quét lại tại vị trí đó.</p>
      </fieldset>
      <div v-if="canManage && !run.closedAt" class="inventory__actions">
        <button type="button" :disabled="pending || loading || !run.counts.unchecked" @click="perform(() => api.reconcile(runId), 'Đã đối soát tối đa 100 bản sao chưa quét.')">Đối soát {{ Math.min(run.counts.unchecked ?? 0, 100) }} cuốn chưa quét</button>
        <button type="button" :disabled="pending || loading || blockedCount > 0" @click="perform(() => api.closeRun(runId), 'Đã đóng đợt kiểm kê.')">Đóng đợt</button>
        <span v-if="blockedCount">Còn {{ blockedCount }} cuốn cần xử lý trước khi đóng.</span>
      </div>
      <label class="inventory__filter">Lọc kết quả<select :value="filter ?? ''" @change="changeFilter"><option value="">Tất cả</option><option v-for="result in INVENTORY_RESULTS" :key="result" :value="result">{{ labels[result] }}</option></select></label>
      <p v-if="!loading && !error && !items.length" class="empty-state">Không có bản sao trong bộ lọc này.</p>
      <div v-if="items.length" class="table-scroll">
        <table><thead><tr><th scope="col">Mã cuốn / tài liệu</th><th scope="col">Vị trí dự kiến</th><th scope="col">Vị trí quét</th><th scope="col">Kết quả</th><th scope="col">Tra soát</th></tr></thead>
          <tbody><tr v-for="item in items" :key="item.id">
            <td><strong>{{ item.code }}</strong><br />{{ item.title }}</td><td>{{ locationName(item.expectedLocationId) }}</td><td>{{ item.scannedAt ? locationName(item.scannedLocationId) : 'Chưa quét thấy' }}</td>
            <td><span class="status-badge" :data-state="item.result">{{ labels[item.result] }}</span><small v-if="item.note" class="inventory__note">{{ item.note }}</small></td>
            <td><button v-if="!run.closedAt && item.result === 'pending_search' && (canManage || canDecide)" type="button" :disabled="pending" @click="selectItem(item)">Xử lý</button><span v-else>—</span></td>
          </tr></tbody>
        </table>
      </div>
      <section v-if="selected" ref="actionPanel" tabindex="-1" class="inventory__resolution" aria-label="Xử lý kết quả tra soát">
        <h2>Tra soát {{ selected.code }}</h2>
        <form @submit.prevent="resolve">
          <label>Kết quả<select v-model="resolution.action"><option v-if="canManage" value="found">Đã tìm thấy</option><option v-if="canDecide" value="lost">Xác nhận thất lạc</option></select></label>
          <label v-if="resolution.action === 'found'">Vị trí lưu sách<select v-model="resolution.locationId" required><option v-for="location in locations" :key="location.id" :value="location.id">{{ location.name }}</option></select></label>
          <label>Ghi chú / căn cứ xử lý<textarea v-model="resolution.note" required :minlength="resolution.action === 'lost' ? 10 : 5" maxlength="1000" rows="3" /></label>
          <p v-if="resolution.action === 'lost'">Xác nhận này sẽ chuyển bản sao sang trạng thái mất và lưu người ra quyết định.</p>
          <div class="inventory__actions"><button type="submit" :disabled="pending">Lưu kết quả</button><button type="button" :disabled="pending" @click="selected = null">Đóng phần xử lý</button></div>
        </form>
      </section>
    </template>
    <nav v-if="total > 20" class="pagination" aria-label="Phân trang kiểm kê"><button :disabled="page <= 1 || loading || pending" @click="changePage(page - 1)">Trang trước</button><span>{{ page }} / {{ pageCount }}</span><button :disabled="page >= pageCount || loading || pending" @click="changePage(page + 1)">Trang sau</button></nav>
  </section>
</template>

<style scoped>
.inventory h1 { margin-top: 12px; }
.inventory__intro, .inventory__hint { color: var(--muted); }
.inventory__hint { margin: 14px 0 0; font-size: .82rem; }
.inventory__summary, .inventory__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 18px 0; }
.inventory__summary span { padding: 12px 16px; border: 1px solid var(--line); border-radius: 10px; background: #f5f8fc; }
.inventory__summary strong { margin-right: 6px; color: var(--navy); }
.inventory__actions span { color: var(--muted); font-size: .82rem; }
.inventory__filter { margin: 10px 0 18px; }
.inventory__note { display: block; max-width: 32ch; margin-top: 8px; color: var(--muted); }
.inventory__resolution { padding: 22px; margin-top: 24px; border: 1px solid var(--line); border-radius: 12px; background: #f8faff; }
.inventory__resolution form { max-width: 650px; }
@media (max-width: 680px) { .inventory__summary span { flex: 1 1 140px; } .inventory__resolution { padding: 15px; } }
</style>
