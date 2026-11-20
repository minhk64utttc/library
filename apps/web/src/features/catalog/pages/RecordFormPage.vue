<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { EditionInput, PublisherDto, RecordInput } from '@thu-vien/shared';

import { ApiError } from '@/shared/api/client';
import * as catalogApi from '../api';

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

function emptyEdition(): EditionForm {
  return { publisherId: '', isbn: '', language: '', publishYear: '', editionNo: '', callNumber: '' };
}

function addEdition(): void {
  editions.value.push(emptyEdition());
}

function removeEdition(index: number): void {
  editions.value.splice(index, 1);
  if (editions.value.length === 0) {
    editions.value.push(emptyEdition());
  }
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
        <input v-model="form.author" type="text" maxlength="200" />
      </label>
      <label>
        Chủ đề
        <input v-model="form.subject" type="text" maxlength="200" />
      </label>
      <label>
        Phân loại
        <input v-model="form.classification" type="text" maxlength="100" />
      </label>

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
            <input v-model="edition.language" type="text" maxlength="50" />
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
          <button type="button" @click="removeEdition(index)">Xoá ấn bản</button>
        </div>
        <button type="button" @click="addEdition">Thêm ấn bản</button>
      </fieldset>

      <button type="submit" :disabled="submitting">
        {{ submitting ? 'Đang lưu…' : 'Lưu' }}
      </button>
    </form>
  </section>
</template>
