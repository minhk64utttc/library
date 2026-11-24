<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import type { EditionInput, PublisherDto, RecordInput } from '@thu-vien/shared';

import { ApiError } from '@/shared/api/client';
import * as catalogApi from '../api';
import { statusLabel } from '../status';
import { loadSearchFacets } from '@/features/public/api';
import { languageLabel } from '@/shared/language-label';

interface EditionForm {
  publisherId: string;
  isbn: string;
  language: string;
  publishYear: string;
  editionNo: string;
  callNumber: string;
}

const route = useRoute();
const router = useRouter();

const recordId = computed(() => (typeof route.params.id === 'string' ? route.params.id : null));
const isEdit = computed(() => recordId.value !== null);

const form = reactive({
  title: '',
  author: '',
  subject: '',
  classification: '',
});

const editions = ref<EditionForm[]>([emptyEdition()]);
const publishers = ref<PublisherDto[]>([]);
const loading = ref(false);
const submitting = ref(false);
const errorMessage = ref('');
const authorSuggestions = ref<string[]>([]);
const subjectSuggestions = ref<string[]>([]);
const similarRecords = ref<Array<{ id: string; title: string; author: string | null; status: string }>>([]);
const checkingDuplicates = ref(false);
let duplicateTimer: ReturnType<typeof setTimeout> | undefined;
let duplicateRequest = 0;
const languages = [
  { code: 'vi', label: 'Tiếng Việt' }, { code: 'en', label: 'Tiếng Anh' }, { code: 'fr', label: 'Tiếng Pháp' },
  { code: 'zh', label: 'Tiếng Trung' }, { code: 'ja', label: 'Tiếng Nhật' }, { code: 'ko', label: 'Tiếng Hàn' },
  { code: 'de', label: 'Tiếng Đức' }, { code: 'ru', label: 'Tiếng Nga' },
];

function emptyEdition(): EditionForm {
  return { publisherId: '', isbn: '', language: '', publishYear: '', editionNo: '', callNumber: '' };
}

function addEdition(): void {
  editions.value.push(emptyEdition());
}

function removeEdition(index: number): void {
  if (editions.value.length <= 1) return;
  editions.value.splice(index, 1);
}

function toEditionInput(edition: EditionForm): EditionInput {
  return {
    ...(edition.publisherId ? { publisherId: edition.publisherId } : {}),
    ...(edition.isbn ? { isbn: edition.isbn } : {}),
    ...(edition.language ? { language: edition.language } : {}),
    ...(edition.publishYear ? { publishYear: Number(edition.publishYear) } : {}),
    ...(edition.editionNo ? { editionNo: Number(edition.editionNo) } : {}),
    ...(edition.callNumber.trim() ? { callNumber: edition.callNumber.trim() } : {}),
  };
}

function toRecordInput(): RecordInput {
  return {
    title: form.title.trim(),
    ...(form.author.trim() ? { author: form.author.trim() } : {}),
    ...(form.subject.trim() ? { subject: form.subject.trim() } : {}),
    ...(form.classification.trim() ? { classification: form.classification.trim() } : {}),
    editions: editions.value.map(toEditionInput),
  };
}

async function load(): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  try {
    const publisherResult = await catalogApi.listPublishers({ pageSize: 100 });
    publishers.value = publisherResult.items;
    try {
      const facets = await loadSearchFacets();
      authorSuggestions.value = facets.authors.map((item) => item.value);
      subjectSuggestions.value = facets.subjects.map((item) => item.value);
    } catch { /* Suggestions are optional; manual entry remains available. */ }

    const id = recordId.value;
    if (id) {
      const record = await catalogApi.getRecord(id);
      form.title = record.title;
      form.author = record.author ?? '';
      form.subject = record.subject ?? '';
      form.classification = record.classification ?? '';
      editions.value =
        record.editions.length > 0
          ? record.editions.map((edition) => ({
              publisherId: edition.publisherId ?? '',
              isbn: edition.isbn ?? '',
              language: edition.language ?? '',
              publishYear: edition.publishYear === null ? '' : String(edition.publishYear),
              editionNo: edition.editionNo === null ? '' : String(edition.editionNo),
              callNumber: edition.callNumber ?? '',
            }))
          : [emptyEdition()];
    }
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? `Không tải được dữ liệu (${error.status}).` : 'Không tải được dữ liệu.';
  } finally {
    loading.value = false;
  }
}

watch(() => form.title, (title) => {
  clearTimeout(duplicateTimer);
  const request = ++duplicateRequest;
  const term = title.trim();
  similarRecords.value = [];
  if (term.length < 3) { checkingDuplicates.value = false; return; }
  checkingDuplicates.value = true;
  duplicateTimer = setTimeout(() => {
    void catalogApi.listRecords({ q: term, page: 1, pageSize: 8 }).then((result) => {
      if (request === duplicateRequest) similarRecords.value = result.items.filter((item) => item.id !== recordId.value);
    }).catch(() => { if (request === duplicateRequest) similarRecords.value = []; }).finally(() => {
      if (request === duplicateRequest) checkingDuplicates.value = false;
    });
  }, 350);
});

async function onSubmit(): Promise<void> {
  submitting.value = true;
  errorMessage.value = '';
  try {
    const input = toRecordInput();
    if (recordId.value) {
      await catalogApi.updateRecord(recordId.value, input);
    } else {
      await catalogApi.createRecord(input);
    }
    await router.push({ name: 'catalog-records' });
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? `Lưu thất bại (${error.status}).` : 'Lưu thất bại.';
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void load();
});
onBeforeUnmount(() => { clearTimeout(duplicateTimer); ++duplicateRequest; });
</script>

<template>
  <section class="record-form">
    <h1>{{ isEdit ? 'Sửa bản ghi' : 'Tạo bản ghi' }}</h1>

    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
    <p v-if="loading">Đang tải…</p>

    <form v-else @submit.prevent="onSubmit">
      <label>
        Nhan đề
        <input v-model="form.title" type="text" required maxlength="300" />
      </label>
      <label>
        Tác giả
        <input v-model="form.author" type="text" maxlength="200" list="catalog-author-suggestions" autocomplete="off" />
        <datalist id="catalog-author-suggestions"><option v-for="author in authorSuggestions" :key="author" :value="author" /></datalist>
      </label>
      <label>
        Chủ đề
        <input v-model="form.subject" type="text" maxlength="200" list="catalog-subject-suggestions" autocomplete="off" />
        <datalist id="catalog-subject-suggestions"><option v-for="subject in subjectSuggestions" :key="subject" :value="subject" /></datalist>
      </label>
      <label>
        Phân loại
        <input v-model="form.classification" type="text" maxlength="100" aria-describedby="classification-help" placeholder="Ví dụ: 005.1" />
        <small id="classification-help">Nhập ký hiệu theo bảng phân loại thư viện đang sử dụng. Nếu chưa rõ, để trống và nhờ cán bộ biên mục tra cứu.</small>
      </label>
      <p v-if="checkingDuplicates" class="record-form__hint" role="status">Đang kiểm tra bản ghi tương tự…</p>
      <aside v-else-if="similarRecords.length" class="record-form__duplicates" role="status"><strong>Có thể đã tồn tại bản ghi tương tự:</strong><ul><li v-for="candidate in similarRecords" :key="candidate.id"><RouterLink :to="{ name: 'catalog-record-detail', params: { id: candidate.id } }">{{ candidate.title }}</RouterLink><span>{{ candidate.author || 'Chưa có tác giả' }} · {{ statusLabel(candidate.status) }}</span></li></ul><small>Hãy đối chiếu trước khi lưu để tránh tạo trùng.</small></aside>

      <fieldset>
        <legend>Ấn bản</legend>
        <div v-for="(edition, index) in editions" :key="index" class="record-form__edition">
          <label>
            Nhà xuất bản
            <select v-model="edition.publisherId">
              <option value="">—</option>
              <option v-for="publisher in publishers" :key="publisher.id" :value="publisher.id">
                {{ publisher.name }}
              </option>
            </select>
          </label>
          <label>
            ISBN
            <input v-model="edition.isbn" type="text" maxlength="20" />
          </label>
          <label>
            Ngôn ngữ
            <select v-model="edition.language">
              <option value="">Chọn ngôn ngữ</option>
              <option v-if="edition.language && !languages.some((language) => language.code === edition.language)" :value="edition.language">{{ languageLabel(edition.language) }}</option>
              <option v-for="language in languages" :key="language.code" :value="language.code">{{ language.label }}</option>
            </select>
          </label>
          <label>
            Năm xuất bản
            <input v-model="edition.publishYear" type="number" min="0" max="3000" />
          </label>
          <label>
            Lần xuất bản
            <input v-model="edition.editionNo" type="number" min="1" />
          </label>
          <label>
            Mã xếp giá
            <input v-model="edition.callNumber" type="text" maxlength="100" />
          </label>
          <button type="button" :disabled="editions.length <= 1" :title="editions.length <= 1 ? 'Bản ghi cần ít nhất một ấn bản' : 'Xóa ấn bản này'" :aria-describedby="editions.length <= 1 ? 'edition-required-help' : undefined" @click="removeEdition(index)">Xóa ấn bản</button>
        </div>
        <small v-if="editions.length <= 1" id="edition-required-help" class="record-form__hint">Bản ghi cần ít nhất một ấn bản. Bạn có thể để trống thông tin ấn bản nếu chưa có dữ liệu.</small>
        <button type="button" @click="addEdition">Thêm ấn bản</button>
      </fieldset>

      <button type="submit" :disabled="submitting">
        {{ submitting ? 'Đang lưu…' : 'Lưu' }}
      </button>
    </form>
  </section>
</template>
