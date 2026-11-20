<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import type { Paginated, PublicRecordDto, PublicSearchFacets, PublicSearchQuery } from '@thu-vien/shared';
import { loadSearchFacets, searchRecords } from '../api';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const advanced = ref(true);
const mobile = ref(false);
const filterDialog = ref<HTMLDialogElement | null>(null);
const filterTargetsReady = ref(false);
const firstFilter = ref<HTMLSelectElement[]>([]);
const facetError = ref(false);
const facetsLoading = ref(true);
let mobileQuery: MediaQueryList | null = null;
let filterOpener: HTMLElement | null = null;
let filterSnapshot: typeof form | null = null;
const error = ref('');
const results = ref<Paginated<PublicRecordDto> | null>(null);
const facets = ref<PublicSearchFacets>({ subjects: [], authors: [], languages: [], publishers: [] });
const form = reactive({ q: '', subject: '', author: '', language: '', publisher: '', yearFrom: '', yearTo: '', availableOnly: '', sort: 'relevance' });
let requestVersion = 0;
const totalPages = computed(() => Math.max(1, Math.ceil((results.value?.total ?? 0) / 20)));
const labels: Record<string, string> = { q: 'Từ khóa', subject: 'Chủ đề', author: 'Tác giả', language: 'Ngôn ngữ', publisher: 'Nhà xuất bản', yearFrom: 'Từ năm', yearTo: 'Đến năm', availableOnly: 'Chỉ còn sẵn' };
function languageLabel(value: string): string {
  const languages: Record<string, string> = { vi: 'Tiếng Việt', vie: 'Tiếng Việt', en: 'Tiếng Anh', eng: 'Tiếng Anh', fr: 'Tiếng Pháp', fra: 'Tiếng Pháp', fre: 'Tiếng Pháp', zh: 'Tiếng Trung', zho: 'Tiếng Trung', chi: 'Tiếng Trung', ja: 'Tiếng Nhật', jpn: 'Tiếng Nhật', ko: 'Tiếng Hàn', kor: 'Tiếng Hàn', de: 'Tiếng Đức', deu: 'Tiếng Đức', ger: 'Tiếng Đức', ru: 'Tiếng Nga', rus: 'Tiếng Nga' };
  return languages[value.toLowerCase().split('-')[0] ?? ''] ?? value;
}
const activeFilters = computed(() => Object.entries(route.query).filter(([key, value]) => key in labels && value && value !== 'false').map(([key, value]) => ({ key, label: `${labels[key]}${key === 'availableOnly' ? '' : `: ${key === 'language' ? languageLabel(String(value)) : value}`}` })));
const activeFilterCount = computed(() => activeFilters.value.filter(filter => filter.key !== 'q').length);
const facetFields = [
  { key: 'subject', label: 'Chủ đề', options: 'subjects' },
  { key: 'author', label: 'Tác giả', options: 'authors' },
  { key: 'language', label: 'Ngôn ngữ', options: 'languages' },
  { key: 'publisher', label: 'Nhà xuất bản', options: 'publishers' },
] as const;

async function loadFromUrl(): Promise<void> {
  const version = ++requestVersion;
  for (const key of ['q', 'subject', 'author', 'language', 'publisher', 'yearFrom', 'yearTo'] as const) form[key] = typeof route.query[key] === 'string' ? String(route.query[key]) : '';
  form.availableOnly = route.query.availableOnly === 'true' ? 'true' : '';
  form.sort = ['title', 'year', 'available', 'newest', 'relevance'].includes(String(route.query.sort)) ? String(route.query.sort) : 'relevance';
  loading.value = true;
  error.value = '';
  try {
    const response = await searchRecords({
      q: form.q, subject: form.subject, author: form.author, language: form.language, publisher: form.publisher,
      ...(form.yearFrom ? { yearFrom: Number(form.yearFrom) } : {}),
      ...(form.yearTo ? { yearTo: Number(form.yearTo) } : {}),
      availableOnly: form.availableOnly === 'true', sort: form.sort as PublicSearchQuery['sort'],
      page: Math.max(1, Math.floor(Number(route.query.page) || 1)), pageSize: 20,
    });
    if (version === requestVersion) results.value = response;
  } catch {
    if (version === requestVersion) error.value = 'Không tải được danh mục. Kiểm tra điều kiện tìm kiếm và thử lại.';
  } finally { if (version === requestVersion) loading.value = false; }
}
function submitSearch(): void {
  if ([form.yearFrom, form.yearTo].some(value => value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 3000))) {
    error.value = 'Nhập năm hợp lệ từ 0 đến 3000.'; return;
  }
  if (form.yearFrom && form.yearTo && Number(form.yearFrom) > Number(form.yearTo)) {
    error.value = 'Năm bắt đầu phải nhỏ hơn hoặc bằng năm kết thúc.'; return;
  }
  const query = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value !== ''));
  filterSnapshot = null;
  filterDialog.value?.close();
  void router.push({ name: 'public-search', query: { ...query, page: '1' } });
}
async function openFilters(event: Event): Promise<void> {
  if (!mobile.value) { advanced.value = !advanced.value; return; }
  filterOpener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  filterSnapshot = { ...form };
  filterDialog.value?.showModal();
  await nextTick();
  firstFilter.value.find(select => !select.disabled)?.focus();
}
function closeFilters(): void { filterDialog.value?.close(); }
function restoreFilterFocus(): void {
  if (filterSnapshot) Object.assign(form, filterSnapshot);
  filterSnapshot = null;
  if (filterOpener?.isConnected) filterOpener.focus();
}
function clearDraftFilters(): void {
  for (const key of ['subject', 'author', 'language', 'publisher', 'yearFrom', 'yearTo', 'availableOnly'] as const) form[key] = '';
  form.sort = 'relevance';
}
function updateMobile(): void {
  if (filterDialog.value?.open) filterDialog.value.close();
  mobile.value = mobileQuery?.matches ?? false;
}
function removeFilter(key: string): void {
  const query: LocationQueryRaw = { ...route.query, page: '1' }; delete query[key];
  void router.push({ query });
}
function clearFilters(): void { void router.push({ name: 'public-search' }); }
function changePage(page: number): void { void router.push({ query: { ...route.query, page: String(page) } }); }
function availability(record: PublicRecordDto): number { return record.editions.reduce((sum, edition) => sum + edition.availableCount, 0); }
function totalCopies(record: PublicRecordDto): number { return record.editions.reduce((sum, edition) => sum + edition.totalCount, 0); }
function locations(record: PublicRecordDto): string { return [...new Set(record.editions.flatMap(edition => edition.copies.filter(copy => copy.status === 'available').map(copy => copy.locationName).filter(Boolean)))].join(' · '); }
watch(() => route.fullPath, () => { filterSnapshot = null; filterDialog.value?.close(); void loadFromUrl(); });
onMounted(async () => {
  mobileQuery = window.matchMedia('(max-width: 680px)');
  updateMobile();
  mobileQuery.addEventListener('change', updateMobile);
  await nextTick();
  filterTargetsReady.value = true;
  void loadFromUrl();
  void loadSearchFacets().then(value => { facets.value = value; }).catch(() => { facetError.value = true; }).finally(() => { facetsLoading.value = false; });
});
onBeforeUnmount(() => { mobileQuery?.removeEventListener('change', updateMobile); });
</script>

<template>
  <section class="public-search">
    <header class="public-search__intro">
      <p class="eyebrow">Khám phá tri thức</p><h1>Tra cứu tài liệu thư viện</h1>
      <p>Tìm theo tên sách, tác giả hoặc chủ đề. Có thể nhập tiếng Việt không dấu.</p>
    </header>
    <form class="public-search__filters" role="search" @submit.prevent="submitSearch">
      <div class="public-search__quick">
        <label>Từ khóa<input v-model="form.q" type="search" placeholder="Tên sách, tác giả, chủ đề…" /></label>
        <button type="submit" :disabled="loading">Tìm tài liệu</button>
        <button type="button" class="secondary" :aria-expanded="mobile ? undefined : advanced" :aria-haspopup="mobile ? 'dialog' : undefined" :aria-controls="mobile ? 'search-filter-dialog' : 'search-filter-desktop'" @click="openFilters">{{ mobile ? 'Bộ lọc' : advanced ? 'Thu gọn bộ lọc' : 'Bộ lọc' }}<span v-if="activeFilterCount"> ({{ activeFilterCount }})</span></button>
      </div>
    </form>
    <div v-show="advanced && !mobile" id="search-filter-desktop" class="public-search__desktop-panel"></div>
    <dialog id="search-filter-dialog" ref="filterDialog" class="public-search__dialog" aria-labelledby="search-filter-heading" @close="restoreFilterFocus" @click="$event.target === $event.currentTarget && closeFilters()">
      <header><h2 id="search-filter-heading">Lọc tài liệu</h2><button type="button" aria-label="Đóng bộ lọc" @click="closeFilters">×</button></header>
      <div id="search-filter-dialog-body"></div>
    </dialog>
    <Teleport v-if="filterTargetsReady" :to="mobile ? '#search-filter-dialog-body' : '#search-filter-desktop'">
      <form class="public-search__filter-panel" @submit.prevent="submitSearch">
      <div class="public-search__advanced">
        <label v-for="field in facetFields" :key="field.key">{{ field.label }}
          <select ref="firstFilter" v-model="form[field.key]" :disabled="facetsLoading || (!facets[field.options].length && !form[field.key])" :aria-describedby="field.key === 'publisher' && !facets.publishers.length ? 'publisher-filter-help' : undefined">
            <option value="">Tất cả</option>
            <option v-if="form[field.key] && !facets[field.options].some(item => item.value === form[field.key])" :value="form[field.key]">{{ field.key === 'language' ? languageLabel(form[field.key]) : form[field.key] }}</option>
            <option v-for="item in facets[field.options]" :key="item.value" :value="item.value">{{ field.key === 'language' ? languageLabel(item.value) : item.value }} ({{ item.count }})</option>
          </select>
          <small v-if="field.key === 'publisher' && !facets.publishers.length" id="publisher-filter-help">{{ facetsLoading ? 'Đang tải nhà xuất bản…' : facetError ? 'Chưa tải được danh sách nhà xuất bản. Hãy thử tải lại trang.' : 'Chưa có thông tin nhà xuất bản trong tài liệu đã công bố.' }}</small>
        </label>
        <label>Từ năm<input v-model="form.yearFrom" type="number" min="0" max="3000" /></label>
        <label>Đến năm<input v-model="form.yearTo" type="number" min="0" max="3000" /></label>
      </div>
      <div class="public-search__options">
        <label>Sắp xếp<select v-model="form.sort"><option value="relevance">Liên quan nhất</option><option value="newest">Mới cập nhật</option><option value="title">Tên A–Z</option><option value="year">Năm xuất bản mới nhất</option><option value="available">Nhiều bản sẵn sàng trước</option></select></label>
        <label class="public-search__available"><input v-model="form.availableOnly" type="checkbox" true-value="true" false-value="" /> Chỉ tài liệu còn sẵn</label>
      </div>
      <p v-if="form.yearFrom && form.yearTo && Number(form.yearFrom) > Number(form.yearTo)" role="alert">Năm bắt đầu phải nhỏ hơn hoặc bằng năm kết thúc.</p>
      <div class="public-search__filter-actions"><button type="button" class="secondary" @click="clearDraftFilters">Xóa bộ lọc</button><button type="submit" :disabled="loading">Áp dụng bộ lọc</button></div>
      </form>
    </Teleport>
    <div v-if="activeFilters.length" class="public-search__chips" aria-label="Bộ lọc đang áp dụng">
      <span>{{ activeFilters.length }} điều kiện đang áp dụng</span>
      <button v-for="filter in activeFilters" :key="filter.key" type="button" :aria-label="`Bỏ bộ lọc ${filter.label}`" @click="removeFilter(filter.key)">{{ filter.label }} ×</button>
      <button type="button" @click="clearFilters">Xóa tất cả</button>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <div v-if="loading" class="empty-state" role="status">Đang tải danh mục…</div>
    <template v-else-if="results && !error">
      <p class="public-search__count" aria-live="polite">{{ results.total }} tài liệu phù hợp</p>
      <div v-if="results.items.length" class="public-search__grid">
        <article v-for="record in results.items" :key="record.id" class="public-book-card">
          <span class="public-book-card__mark" aria-hidden="true">{{ record.classification || 'SÁCH' }}</span>
          <div class="public-book-card__body">
            <h2><RouterLink :to="{ path: `/books/${record.id}`, query: { from: route.fullPath } }">{{ record.title }}</RouterLink></h2>
            <p>{{ record.author || 'Chưa cập nhật tác giả' }}</p>
            <p>{{ [record.editions[0]?.publisherName, record.editions[0]?.publishYear, record.editions[0]?.language ? languageLabel(record.editions[0].language) : null].filter(Boolean).join(' · ') || 'Chưa cập nhật thông tin xuất bản' }}</p>
            <dl><div v-if="record.subject"><dt>Chủ đề</dt><dd>{{ record.subject }}</dd></div><div v-if="record.editions[0]?.isbn"><dt>ISBN</dt><dd>{{ record.editions[0]?.isbn }}</dd></div></dl>
            <span class="status-badge" :data-state="availability(record) ? 'available' : 'reserved'">{{ availability(record) }}/{{ totalCopies(record) }} bản sẵn sàng</span>
            <p v-if="locations(record)" class="public-book-card__shelf">Vị trí: {{ locations(record) }}</p>
          </div>
        </article>
      </div>
      <div v-else class="empty-state"><p>Không tìm thấy tài liệu phù hợp.</p><p v-if="activeFilters.length">Thử bỏ từng điều kiện bằng các nhãn bộ lọc phía trên.</p><p v-else>Thử từ khóa ngắn hơn hoặc tên tác giả.</p><button v-if="activeFilters.length" type="button" @click="clearFilters">Xóa bộ lọc và tìm lại</button></div>
      <nav v-if="totalPages > 1" class="public-search__pagination" aria-label="Phân trang kết quả"><button type="button" :disabled="results.page <= 1" @click="changePage(results.page - 1)">Trang trước</button><span>Trang {{ results.page }} / {{ totalPages }}</span><button type="button" :disabled="results.page >= totalPages" @click="changePage(results.page + 1)">Trang sau</button></nav>
    </template>
  </section>
</template>

<style scoped>
.public-search__intro { padding: 24px 28px; background: #edf3fc; border-left: 4px solid var(--gold); border-radius: 12px; }
.public-search__intro h1 { margin: 8px 0; }.public-search__intro p:last-child { margin-bottom: 0; color: var(--muted); }
.public-search__filters { display: block; margin: 22px 0 0; padding: 20px; border: 1px solid var(--line); border-radius: 12px; }
.public-search__filter-panel { display: grid; grid-template-columns: 1fr; gap: 18px; padding: 20px; }
.public-search__desktop-panel { margin-top: 12px; border: 1px solid var(--line); border-radius: 12px; background: #f8faff; }
.public-search__quick { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 12px; align-items: end; }.public-search__quick button { min-height: 42px; }
.public-search__advanced { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; gap: 18px 14px; }.public-search__advanced small { color: var(--muted); font-size: .75rem; font-weight: 400; line-height: 1.5; }.public-search__advanced label { min-width: 0; align-content: start; }.public-search__advanced select,.public-search__advanced input { min-height: 44px; width: 100%; }
.public-search__options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; align-items: center; }.public-search__available { display: flex; gap: 8px; align-items: center; }.public-search__available input { width: 18px; height: 18px; }
.public-search__filter-actions { display: flex; gap: 12px; justify-content: flex-end; padding-top: 16px; border-top: 1px solid var(--line); }
.public-search__chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-block: 18px; }.public-search__chips>span { color: var(--muted); font-size: .8rem; }.public-search__chips button { background: #edf2fa; color: var(--navy); font-size: .8rem; border-radius: 999px; }
.public-search__dialog { width: min(540px, calc(100% - 24px)); max-height: calc(100dvh - 32px); padding: 0; overflow-y: auto; border: 1px solid var(--line); border-radius: 14px; color: var(--ink); background: white; }
.public-search__dialog::backdrop { background: #10233f99; }.public-search__dialog>header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 20px; border-bottom: 1px solid var(--line); }.public-search__dialog h2 { margin: 0; font-size: 1.15rem; }.public-search__dialog>header button { min-width: 42px; min-height: 42px; background: transparent; color: var(--navy); font-size: 1.4rem; border: 1px solid var(--line); }
.public-search__count { color: var(--muted); font-size: .86rem; }.public-search__grid { display: grid; gap: 12px; }
.public-book-card { display: flex; gap: 17px; padding: 20px; border: 1px solid var(--line); border-radius: 12px; }.public-book-card__mark { display: grid; place-items: center; width: 64px; min-height: 90px; flex: 0 0 auto; padding: 6px; text-align: center; overflow-wrap: anywhere; color: var(--navy); background: #edf2fa; border: 1px solid #d8e1ef; border-left: 5px solid var(--gold); border-radius: 4px 8px 8px 4px; font-size: .72rem; font-weight: 700; }
.public-book-card__body { min-width: 0; }.public-book-card h2 { margin: 0 0 5px; font-size: 1.05rem; }.public-book-card p { margin: 0 0 10px; color: var(--muted); font-size: .86rem; }.public-book-card dl { display: flex; flex-wrap: wrap; gap: 8px 22px; margin: 0 0 12px; font-size: .78rem; }.public-book-card dl div { display: flex; gap: 6px; }.public-book-card dt { color: var(--muted); }.public-book-card dd { margin: 0; }.public-book-card__shelf { margin-top: 10px !important; }
.public-search__pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin: 24px 0; }
@media (max-width: 680px) { .public-search__quick { grid-template-columns: 1fr 1fr; }.public-search__quick label { grid-column: 1 / -1; }.public-search__advanced { grid-template-columns: 1fr 1fr; }.public-search__options { grid-template-columns: 1fr; }.public-search__filter-actions { position: sticky; bottom: -20px; margin: 0 -20px -20px; padding: 16px 20px; background: white; }.public-search__filter-actions button { flex: 1; min-height: 44px; } }
@media (max-width: 440px) { .public-search__advanced { grid-template-columns: 1fr; }.public-book-card { padding: 12px; gap: 10px; }.public-book-card__mark { width: 44px; } }
</style>
