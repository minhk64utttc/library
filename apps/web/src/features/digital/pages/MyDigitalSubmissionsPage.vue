<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { DigitalSubmissionCreate, DigitalSubmissionDto, Paginated } from '@thu-vien/shared';
import { ApiError } from '@/shared/api/client';
import { createDigitalSubmission, downloadDigitalFile, listMySubmissions, updateDigitalSubmission, uploadDigitalFile } from '../api';

const items = ref<Paginated<DigitalSubmissionDto> | null>(null);
const selectedFile = ref<File | null>(null);
const editingId = ref<string | null>(null);
const loading = ref(true);
const saving = ref(false);
const downloading = ref('');
const error = ref('');
const notice = ref('');
const form = reactive({ title: '', abstract: '', author: '', department: '', publishedYear: '', license: 'Giấy phép do người nộp xác nhận', rightsConfirmed: false });
const statusLabels: Record<string, string> = {
  new_submission: 'Mới nộp', under_review: 'Đang thẩm định', need_more_info: 'Cần bổ sung', accepted: 'Đã tiếp nhận', published: 'Đã công bố',
};
const query = ref('');
const currentPage = ref(1);
const totalPages = computed(() => Math.max(1, Math.ceil((items.value?.total ?? 0) / (items.value?.pageSize ?? 10))));

async function load(page = currentPage.value): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    items.value = await listMySubmissions({ page, pageSize: 10, q: query.value.trim() || undefined });
    currentPage.value = page;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không tải được hồ sơ học liệu số.';
  } finally {
    loading.value = false;
  }
}

function resetForm(): void {
  editingId.value = null;
  selectedFile.value = null;
  Object.assign(form, { title: '', abstract: '', author: '', department: '', publishedYear: '', license: 'Giấy phép do người nộp xác nhận', rightsConfirmed: false });
}

function beginSupplement(item: DigitalSubmissionDto): void {
  editingId.value = item.id;
  selectedFile.value = null;
  Object.assign(form, {
    title: item.title, abstract: item.abstract, author: item.author,
    department: item.department ?? '', publishedYear: item.publishedYear?.toString() ?? '',
    license: item.license, rightsConfirmed: item.rightsConfirmed,
  });
  error.value = '';
  notice.value = `Đang bổ sung hồ sơ ${item.submissionCode}. Chọn tệp phiên bản mới để gửi lại thẩm định.`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submit(): Promise<void> {
  if (saving.value) return;
  if (!selectedFile.value) { error.value = 'Hãy chọn tệp PDF hoặc DOCX để nộp.'; return; }
  if (!form.rightsConfirmed) { error.value = 'Bạn cần xác nhận quyền sử dụng tài liệu trước khi nộp.'; return; }
  saving.value = true;
  error.value = '';
  notice.value = '';
  try {
    const input: DigitalSubmissionCreate = {
      title: form.title, abstract: form.abstract, author: form.author,
      department: form.department || undefined, publishedYear: form.publishedYear ? Number(form.publishedYear) : undefined,
      license: form.license, rightsConfirmed: true,
    };
    const submission = editingId.value
      ? await updateDigitalSubmission(editingId.value, input)
      : await createDigitalSubmission(input);
    editingId.value = submission.id;
    await uploadDigitalFile(submission.id, selectedFile.value);
    notice.value = `Đã nộp tệp cho hồ sơ ${submission.submissionCode}.`;
    resetForm();
    await load(1);
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Không hoàn tất được hồ sơ. Thông tin đã nhập vẫn còn trên biểu mẫu.';
  } finally {
    saving.value = false;
  }
}

async function download(item: DigitalSubmissionDto): Promise<void> {
  if (!item.file || downloading.value) return;
  downloading.value = item.id;
  error.value = '';
  try {
    const blob = await downloadDigitalFile(item.file.id);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = item.file.originalName; anchor.click();
    URL.revokeObjectURL(url);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không tải được tệp.';
  } finally { downloading.value = ''; }
}

onMounted(() => void load(1));
</script>

<template>
  <section class="my-digital" aria-labelledby="my-digital-title">
    <header class="my-digital__heading"><p class="eyebrow">Học liệu số</p><h1 id="my-digital-title">Hồ sơ tài liệu của tôi</h1><p>Nộp thông tin và tệp để thư viện thẩm định. Tệp được lưu riêng tư cho đến khi được duyệt công bố.</p></header>
    <p v-if="error" class="my-digital__message my-digital__message--error" role="alert">{{ error }}</p>
    <p v-if="notice" class="my-digital__message" role="status">{{ notice }}</p>

    <section class="my-digital__panel" aria-labelledby="submission-form-title">
      <div class="my-digital__panel-heading"><h2 id="submission-form-title">{{ editingId ? 'Bổ sung hồ sơ' : 'Nộp tài liệu mới' }}</h2><button v-if="editingId" type="button" class="my-digital__link-button" @click="resetForm">Hủy bổ sung</button></div>
      <form class="my-digital__form" @submit.prevent="submit">
        <label class="my-digital__wide">Tên tài liệu<input v-model="form.title" required minlength="2" maxlength="300" /></label>
        <label>Tác giả<input v-model="form.author" required minlength="2" maxlength="300" /></label>
        <label>Khoa / đơn vị<input v-model="form.department" maxlength="200" /></label>
        <label>Năm xuất bản<input v-model="form.publishedYear" type="number" min="1000" max="2100" /></label>
        <label>Giấy phép / quyền sử dụng<input v-model="form.license" required minlength="2" maxlength="300" /></label>
        <label class="my-digital__wide">Tóm tắt<textarea v-model="form.abstract" required minlength="20" maxlength="10000" rows="4"></textarea></label>
        <label class="my-digital__wide">Tệp tài liệu (PDF hoặc DOCX, tối đa 25 MB)<input type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" required @change="selectedFile = ($event.target as HTMLInputElement).files?.[0] ?? null" /></label>
        <label class="my-digital__rights"><input v-model="form.rightsConfirmed" type="checkbox" required /> Tôi xác nhận có quyền nộp tài liệu này và thông tin bản quyền đã khai báo là chính xác.</label>
        <div class="my-digital__actions"><button type="submit" :disabled="saving">{{ saving ? 'Đang tải tệp…' : editingId ? 'Gửi bổ sung' : 'Nộp hồ sơ' }}</button></div>
      </form>
    </section>

    <section class="my-digital__panel" aria-labelledby="my-submissions-title">
      <div class="my-digital__panel-heading"><h2 id="my-submissions-title">Hồ sơ đã nộp</h2><form class="my-digital__search" @submit.prevent="load(1)"><input v-model="query" aria-label="Tìm hồ sơ" placeholder="Tìm tên, tác giả, mã hồ sơ" /><button type="submit">Tìm</button></form></div>
      <p v-if="loading" class="my-digital__empty" role="status">Đang tải hồ sơ…</p>
      <div v-else-if="items?.items.length" class="my-digital__list">
        <article v-for="item in items.items" :key="item.id" class="my-digital__item">
          <div class="my-digital__item-heading"><div><span class="my-digital__code">{{ item.submissionCode }}</span><h3>{{ item.title }}</h3></div><span class="my-digital__status">{{ statusLabels[item.status] }}</span></div>
          <p>{{ item.author }}<span v-if="item.publishedYear"> · {{ item.publishedYear }}</span></p>
          <p v-if="item.reviewNote" class="my-digital__review-note"><strong>Ý kiến thư viện:</strong> {{ item.reviewNote }}</p>
          <div class="my-digital__item-actions">
            <button v-if="item.file" type="button" class="my-digital__link-button" :disabled="downloading === item.id" @click="download(item)">{{ downloading === item.id ? 'Đang tải…' : `Tải tệp v${item.file.versionNumber}` }}</button>
            <button v-if="item.status === 'need_more_info'" type="button" class="my-digital__link-button" @click="beginSupplement(item)">Bổ sung hồ sơ</button>
            <span v-if="item.status === 'published'">Mức truy cập: {{ item.accessLevel }}</span>
          </div>
        </article>
      </div>
      <p v-else-if="!loading" class="my-digital__empty">Bạn chưa nộp tài liệu số nào.</p>
      <nav v-if="items && totalPages > 1" class="my-digital__pagination" aria-label="Phân trang hồ sơ"><button type="button" :disabled="currentPage <= 1" @click="load(currentPage - 1)">Trước</button><span>Trang {{ currentPage }} / {{ totalPages }}</span><button type="button" :disabled="currentPage >= totalPages" @click="load(currentPage + 1)">Sau</button></nav>
    </section>
  </section>
</template>

<style scoped>
.my-digital { --accent: var(--navy); }
.my-digital__heading { margin-bottom: 22px; }
.my-digital__heading h1 { margin: 6px 0; color: var(--navy-deep); font-size: clamp(1.5rem, 3vw, 2rem); }
.my-digital__heading > p:last-child { color: var(--muted); }
.my-digital__panel { margin: 18px 0; padding: clamp(16px, 2.5vw, 24px); border: 1px solid var(--line); border-radius: 12px; }
.my-digital__panel-heading, .my-digital__item-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.my-digital__panel-heading h2 { margin: 0; font-size: 1.08rem; }
.my-digital__form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
.my-digital__form label { display: grid; gap: 6px; font-size: .83rem; font-weight: 600; }
.my-digital__form input:not([type=checkbox]), .my-digital__form textarea, .my-digital__search input { width: 100%; min-height: 40px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 7px; font: inherit; }
.my-digital__form input[type=file] { padding: 7px; }
.my-digital__wide, .my-digital__rights { grid-column: 1 / -1; }
.my-digital__form .my-digital__rights { display: flex; align-items: flex-start; gap: 9px; font-weight: 500; }
.my-digital__rights input { margin-top: 3px; accent-color: var(--navy); }
.my-digital__actions { grid-column: 1 / -1; }
.my-digital__actions button, .my-digital__search button { min-height: 39px; padding: 0 15px; color: #fff; background: var(--navy); border: 0; border-radius: 7px; font: inherit; font-weight: 650; cursor: pointer; }
.my-digital__actions button:disabled { opacity: .6; cursor: wait; }
.my-digital__search { display: flex; gap: 8px; }
.my-digital__search input { min-width: min(300px, 42vw); }
.my-digital__search button { min-height: 40px; }
.my-digital__list { display: grid; gap: 12px; margin-top: 18px; }
.my-digital__item { padding: 16px; background: #fbfcfe; border: 1px solid var(--line); border-radius: 10px; }
.my-digital__item h3 { margin: 4px 0; color: var(--navy-deep); font-size: 1rem; }
.my-digital__item > p { margin: 5px 0; color: var(--muted); font-size: .84rem; }
.my-digital__code { color: var(--muted); font-size: .72rem; letter-spacing: .04em; }
.my-digital__status { padding: 5px 9px; color: #344a64; background: #edf2fa; border-radius: 99px; font-size: .73rem; white-space: nowrap; }
.my-digital__review-note { padding: 10px; color: #6b4c12 !important; background: #fff7df; border-radius: 7px; }
.my-digital__item-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; color: var(--muted); font-size: .82rem; }
.my-digital__link-button { padding: 0; color: var(--navy); background: transparent; border: 0; font: inherit; font-weight: 650; text-decoration: underline; cursor: pointer; }
.my-digital__link-button:disabled { opacity: .6; }
.my-digital__empty { padding: 20px; color: var(--muted); text-align: center; }
.my-digital__message { padding: 11px 13px; color: #2f6451; background: #e8f5ed; border-radius: 8px; }
.my-digital__message--error { color: #873535; background: #fff1ef; }
.my-digital__pagination { display: flex; justify-content: center; align-items: center; gap: 14px; margin-top: 18px; color: var(--muted); font-size: .82rem; }
.my-digital__pagination button { min-height: 35px; padding: 5px 10px; }
@media (max-width: 640px) { .my-digital__form { grid-template-columns: 1fr; } .my-digital__wide, .my-digital__rights, .my-digital__actions { grid-column: auto; } .my-digital__panel-heading { align-items: stretch; flex-direction: column; } .my-digital__search input { min-width: 0; } .my-digital__item-heading { align-items: flex-start; flex-direction: column; gap: 6px; } }
</style>
