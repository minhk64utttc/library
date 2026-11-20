<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { PublisherDto } from '@thu-vien/shared';

import { useSessionStore } from '@/features/auth/session.store';
import { ApiError } from '@/shared/api/client';
import * as catalogApi from '../api';

const session = useSessionStore();
const canWrite = computed(() => session.can('catalog:write'));

const publishers = ref<PublisherDto[]>([]);
const loading = ref(false);
const errorMessage = ref('');
const submitting = ref(false);
const editingId = ref<string | null>(null);

const createForm = reactive({ code: '', name: '', address: '' });
const editForm = reactive({ code: '', name: '', address: '' });

async function load(): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await catalogApi.listPublishers({ pageSize: 100 });
    publishers.value = result.items;
  } catch {
    errorMessage.value = 'Không tải được danh sách nhà xuất bản.';
  } finally {
    loading.value = false;
  }
}

async function onCreate(): Promise<void> {
  submitting.value = true;
  errorMessage.value = '';
  try {
    await catalogApi.createPublisher({
      code: createForm.code.trim(),
      name: createForm.name.trim(),
      ...(createForm.address.trim() ? { address: createForm.address.trim() } : {}),
    });
    createForm.code = '';
    createForm.name = '';
    createForm.address = '';
    await load();
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError && error.status === 409
        ? 'Mã nhà xuất bản đã tồn tại.'
        : 'Không tạo được nhà xuất bản.';
  } finally {
    submitting.value = false;
  }
}

function startEdit(publisher: PublisherDto): void {
  editingId.value = publisher.id;
  editForm.code = publisher.code;
  editForm.name = publisher.name;
  editForm.address = publisher.address ?? '';
}

function cancelEdit(): void {
  editingId.value = null;
}

async function onSaveEdit(id: string): Promise<void> {
  submitting.value = true;
  errorMessage.value = '';
  try {
    await catalogApi.updatePublisher(id, {
      code: editForm.code.trim(),
      name: editForm.name.trim(),
      address: editForm.address.trim(),
    });
    editingId.value = null;
    await load();
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError && error.status === 409
        ? 'Mã nhà xuất bản đã tồn tại.'
        : 'Không lưu được nhà xuất bản.';
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="publishers">
    <h1>Nhà xuất bản</h1>

    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>

    <form v-if="canWrite" class="publishers__create" @submit.prevent="onCreate">
      <label>
        Mã
        <input v-model="createForm.code" type="text" required maxlength="50" />
      </label>
      <label>
        Tên
        <input v-model="createForm.name" type="text" required maxlength="200" />
      </label>
      <label>
        Địa chỉ liên hệ
        <input v-model="createForm.address" type="text" maxlength="300" />
      </label>
      <button type="submit" :disabled="submitting">Thêm</button>
    </form>

    <p v-if="loading">Đang tải…</p>
    <p v-else-if="publishers.length === 0">Chưa có nhà xuất bản nào.</p>

    <table v-else>
      <thead>
        <tr>
          <th scope="col">Mã</th>
          <th scope="col">Tên</th>
          <th scope="col">Địa chỉ</th>
          <th v-if="canWrite" scope="col">Thao tác</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="publisher in publishers" :key="publisher.id">
          <template v-if="editingId === publisher.id">
            <td><input v-model="editForm.code" type="text" maxlength="50" /></td>
            <td><input v-model="editForm.name" type="text" maxlength="200" /></td>
            <td><input v-model="editForm.address" type="text" maxlength="300" /></td>
            <td>
              <button type="button" :disabled="submitting" @click="onSaveEdit(publisher.id)">
                Lưu
              </button>
              <button type="button" @click="cancelEdit">Hủy</button>
            </td>
          </template>
          <template v-else>
            <td>{{ publisher.code }}</td>
            <td>{{ publisher.name }}</td>
            <td>{{ publisher.address ?? '' }}</td>
            <td v-if="canWrite">
              <button type="button" @click="startEdit(publisher)">Sửa</button>
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </section>
</template>
