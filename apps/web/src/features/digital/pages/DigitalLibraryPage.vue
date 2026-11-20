<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Paginated } from '@thu-vien/shared';
import { downloadDigitalFile, downloadPublicDigitalFile, listMemberDigitalRecords, listPublicDigitalRecords, type DigitalMemberRecord, type DigitalPublicRecord } from '../api';

const result = ref<Paginated<DigitalPublicRecord> | null>(null);
const memberItems = ref<DigitalMemberRecord[]>([]);
const memberPage = ref(1);
const memberTotal = ref(0);
const query = ref('');
const activeQuery = ref('');
const page = ref(1);
const loading = ref(false);
const downloading = ref('');
const error = ref('');
const pages = computed(() => Math.max(1, Math.ceil((result.value?.total ?? 0) / (result.value?.pageSize ?? 12))));

async function load(nextPage = 1): Promise<void> {
  loading.value = true; error.value = '';
  try {
    result.value = await listPublicDigitalRecords({ page: nextPage, pageSize: 12, q: activeQuery.value || undefined });
    try {
      const members = await listMemberDigitalRecords({ page: memberPage.value, pageSize: 12, q: activeQuery.value || undefined });
      memberItems.value = members.items.filter((item) => item.accessLevel === 'members_only');
      memberTotal.value = members.total;
    } catch {
      memberItems.value = [];
      memberTotal.value = 0;
    }
    page.value = nextPage;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không tải được danh mục học liệu số.';
  } finally { loading.value = false; }
}

async function loadMembers(nextPage: number): Promise<void> {
  memberPage.value = nextPage;
  await load(page.value);
}

function search(): void { activeQuery.value = query.value.trim(); memberPage.value = 1; void load(1); }

async function download(record: DigitalPublicRecord): Promise<void> {
  if (downloading.value) return;
  downloading.value = record.submissionCode; error.value = '';
  try {
    const blob = await downloadPublicDigitalFile(record.submissionCode);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = record.fileName || `${record.submissionCode}.pdf`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không tải được tài liệu.';
  } finally { downloading.value = ''; }
}

async function downloadMember(record: DigitalMemberRecord): Promise<void> {
  if (!record.fileId || downloading.value) return;
  downloading.value = record.submissionCode; error.value = '';
  try {
    const blob = await downloadDigitalFile(record.fileId);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = record.fileName || `${record.submissionCode}.pdf`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không tải được tài liệu thành viên.';
  } finally { downloading.value = ''; }
}

onMounted(() => void load());
</script>

<template>
  <section class="digital-library" aria-labelledby="digital-library-title">
    <header class="digital-library__heading"><p class="eyebrow">Kho tài nguyên mở</p><h1 id="digital-library-title">Học liệu số</h1><p>Tra cứu và tải tài liệu đã được thư viện công bố ở mức truy cập công khai.</p></header>
    <form class="digital-library__search" role="search" @submit.prevent="search"><label for="digital-search">Tìm theo tên tài liệu hoặc tác giả</label><div><input id="digital-search" v-model="query" type="search" placeholder="Nhập từ khóa…" /><button type="submit" :disabled="loading">Tìm tài liệu</button></div></form>
    <p v-if="error" class="digital-library__error" role="alert">{{ error }}</p>
    <p v-if="loading" class="digital-library__empty" role="status">Đang tìm trong kho học liệu…</p>
    <template v-else-if="result">
      <p class="digital-library__count">{{ result.total }} tài liệu công khai</p>
      <div v-if="result.items.length" class="digital-library__grid">
        <article v-for="record in result.items" :key="record.submissionCode" class="digital-record">
          <span class="digital-record__eyebrow">{{ record.submissionCode }}<span v-if="record.publishedYear"> · {{ record.publishedYear }}</span></span>
          <h2>{{ record.title }}</h2>
          <p class="digital-record__author">{{ record.author }}<span v-if="record.department"> · {{ record.department }}</span></p>
          <p class="digital-record__abstract">{{ record.abstract }}</p>
          <div class="digital-record__footer"><span>{{ record.license }}</span><button type="button" :disabled="downloading === record.submissionCode" @click="download(record)">{{ downloading === record.submissionCode ? 'Đang tải…' : 'Tải tài liệu' }}</button></div>
        </article>
      </div>
      <p v-else class="digital-library__empty">Không tìm thấy tài liệu công khai phù hợp.</p>
      <nav v-if="pages > 1" class="digital-library__pagination" aria-label="Phân trang học liệu số"><button type="button" :disabled="page <= 1" @click="load(page - 1)">Trước</button><span>Trang {{ page }} / {{ pages }}</span><button type="button" :disabled="page >= pages" @click="load(page + 1)">Sau</button></nav>
    </template>
    <section v-if="memberItems.length || memberTotal" class="digital-members" aria-labelledby="digital-members-title">
      <h2 id="digital-members-title">Học liệu dành cho bạn đọc</h2>
      <p class="digital-members__hint">Đăng nhập để xem tài liệu được giới hạn cho thành viên thư viện.</p>
      <div class="digital-library__grid">
        <article v-for="record in memberItems" :key="record.submissionId" class="digital-record">
          <span class="digital-record__eyebrow">{{ record.submissionCode }}<span v-if="record.publishedYear"> · {{ record.publishedYear }}</span></span>
          <h2>{{ record.title }}</h2>
          <p class="digital-record__author">{{ record.author }}<span v-if="record.department"> · {{ record.department }}</span></p>
          <p class="digital-record__abstract">{{ record.abstract }}</p>
          <div class="digital-record__footer"><span>{{ record.license }} · Thành viên</span><button type="button" :disabled="!record.fileId || downloading === record.submissionCode" @click="downloadMember(record)">{{ downloading === record.submissionCode ? 'Đang tải…' : 'Tải tài liệu' }}</button></div>
        </article>
      </div>
      <nav v-if="Math.ceil(memberTotal / 12) > 1" class="digital-library__pagination" aria-label="Phân trang học liệu thành viên">
        <button type="button" :disabled="memberPage <= 1" @click="loadMembers(memberPage - 1)">Trước</button><span>Trang {{ memberPage }} / {{ Math.ceil(memberTotal / 12) }}</span><button type="button" :disabled="memberPage >= Math.ceil(memberTotal / 12)" @click="loadMembers(memberPage + 1)">Sau</button>
      </nav>
    </section>
  </section>
</template>

<style scoped>
.digital-library__heading { margin-bottom: 22px; }
.digital-members { margin-top: 30px; }
.digital-members > h2 { color: var(--navy-deep); }
.digital-members__hint { color: var(--muted); }
.digital-library__heading h1 { margin: 6px 0; color: var(--navy-deep); font-size: clamp(1.6rem, 3vw, 2.2rem); }
.digital-library__heading > p:last-child, .digital-library__count { color: var(--muted); }
.digital-library__search { display: grid; gap: 8px; margin: 20px 0; padding: 17px; background: #f8faff; border: 1px solid var(--line); border-radius: 10px; }
.digital-library__search label { font-size: .82rem; font-weight: 650; }
.digital-library__search > div { display: flex; gap: 9px; }
.digital-library__search input { flex: 1; min-width: 0; min-height: 42px; padding: 9px 11px; border: 1px solid var(--line); border-radius: 7px; font: inherit; }
.digital-library__search button, .digital-record__footer button { min-height: 40px; padding: 8px 14px; color: white; background: var(--navy); border: 0; border-radius: 7px; font: inherit; font-weight: 650; cursor: pointer; }
.digital-library__search button:disabled, .digital-record__footer button:disabled { opacity: .6; cursor: wait; }
.digital-library__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
.digital-record { display: flex; flex-direction: column; min-height: 245px; padding: 18px; border: 1px solid var(--line); border-radius: 11px; }
.digital-record__eyebrow { color: var(--muted); font-size: .7rem; letter-spacing: .05em; }
.digital-record h2 { margin: 8px 0 5px; color: var(--navy-deep); font-size: 1.03rem; }
.digital-record__author { margin: 0; color: var(--muted); font-size: .79rem; }
.digital-record__abstract { display: -webkit-box; overflow: hidden; margin: 12px 0; color: #40516a; font-size: .84rem; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 4; }
.digital-record__footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: auto; padding-top: 14px; border-top: 1px solid var(--line); }
.digital-record__footer span { color: var(--muted); font-size: .72rem; }
.digital-library__empty { padding: 22px; color: var(--muted); text-align: center; background: #f8faff; border-radius: 9px; }
.digital-library__error { padding: 12px; color: #873535; background: #fff1ef; border-radius: 8px; }
.digital-library__pagination { display: flex; justify-content: center; align-items: center; gap: 14px; margin: 20px 0; color: var(--muted); font-size: .82rem; }
.digital-library__pagination button { min-height: 35px; padding: 5px 11px; }
@media (max-width: 700px) { .digital-library__grid { grid-template-columns: 1fr; } }
@media (max-width: 450px) { .digital-library__search > div, .digital-record__footer { align-items: stretch; flex-direction: column; } }
</style>
