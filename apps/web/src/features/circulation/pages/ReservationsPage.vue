<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { BorrowerDto, ReservationDto, ReservationStatus } from '@thu-vien/shared';

import { useSessionStore } from '@/features/auth/session.store';
import { ApiError } from '@/shared/api/client';
import * as circApi from '../api';

const session = useSessionStore();
const route = useRoute();
const router = useRouter();
const total = ref(0);
const page = computed(() => { const value = Number(route.query.page); return Number.isInteger(value) && value > 0 ? value : 1; });
const pages = computed(() => Math.max(1, Math.ceil(total.value / 20)));
function navigate(nextPage = 1): void { void router.push({ query: { ...(statusFilter.value ? { status: statusFilter.value } : {}), page: String(nextPage) } }); }
const canManage = computed(() => session.can('circulation:manage'));

const reservations = ref<ReservationDto[]>([]);
const borrowers = ref<BorrowerDto[]>([]);
const editionOptions = ref<{ id: string; label: string }[]>([]);
const loading = ref(false);
const errorMessage = ref('');
const noticeMessage = ref('');
const statusFilter = ref<ReservationStatus | ''>('');
const pendingId = ref<string | null>(null);
const submitting = ref(false);

const form = reactive({ borrowerId: '', editionId: '', search: '', editionSearch: '' });
const selectedBorrower = computed(() => borrowers.value.find((borrower) => borrower.id === form.borrowerId) ?? null);
const cardStatusLabels: Record<BorrowerDto['cardStatus'], string> = { active: 'Thẻ còn hiệu lực', locked: 'Thẻ đang khóa', expired: 'Thẻ hết hạn', missing: 'Chưa có thẻ thư viện' };

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Đang chờ',
  ready_for_pickup: 'Chờ nhận',
  fulfilled: 'Đã nhận',
  cancelled: 'Đã hủy',
  expired: 'Hết hạn',
};

async function load(): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  try {
    const reservationResult = await circApi.listReservations({
        page: page.value,
        pageSize: 20,
        ...(statusFilter.value ? { status: statusFilter.value } : {}),
      });
    reservations.value = reservationResult.items;
    total.value = reservationResult.total;
    editionOptions.value = [];
  } catch {
    errorMessage.value = 'Không tải được dữ liệu đặt trước.';
  } finally {
    loading.value = false;
  }
}

async function onSearchBorrowers(): Promise<void> {
  try {
    borrowers.value = await circApi.searchBorrowers(form.search.trim());
    form.borrowerId = '';
  } catch {
    errorMessage.value = 'Không tìm được bạn đọc.';
  }
}

async function onSearchEditions(): Promise<void> {
  try {
    const result = await circApi.listEditionsForPicker(form.editionSearch.trim());
    editionOptions.value = result.items.flatMap((record) => record.editions.map((edition) => ({
      id: edition.id,
      label: [record.title, edition.editionNo ? `Lần ${edition.editionNo}` : '', edition.publishYear ? String(edition.publishYear) : '', edition.isbn ? `ISBN ${edition.isbn}` : '', edition.publisherName ?? ''].filter(Boolean).join(' · '),
    })));
  } catch {
    errorMessage.value = 'Không tìm được ấn bản phù hợp.';
  }
}

async function run(id: string, action: () => Promise<unknown>): Promise<void> {
  pendingId.value = id;
  errorMessage.value = '';
  try {
    await action();
    await load();
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : 'Không thực hiện được thao tác. Vui lòng thử lại.';
  } finally {
    pendingId.value = null;
  }
}

function onCancel(reservation: ReservationDto): void {
  void run(reservation.id, () => circApi.cancelReservation(reservation.id));
}

async function onExpireDue(): Promise<void> {
  errorMessage.value = '';
  noticeMessage.value = '';
  try {
    const result = await circApi.expireReservations();
    noticeMessage.value = `Đã giải phóng ${result.released} giữ chỗ hết hạn.`;
    await load();
  } catch {
    errorMessage.value = 'Không xử lý được giữ chỗ hết hạn.';
  }
}

async function onCreate(): Promise<void> {
  if (!form.borrowerId || !form.editionId) {
    errorMessage.value = 'Chọn bạn đọc và ấn bản trước khi đặt trước.';
    return;
  }
  submitting.value = true;
  errorMessage.value = '';
  try {
    await circApi.createReservation({ borrowerId: form.borrowerId, editionId: form.editionId });
    await load();
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError && error.status === 400
        ? 'Không đặt trước được (trùng hoặc không hợp lệ).'
        : 'Không đặt trước được.';
  } finally {
    submitting.value = false;
  }
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('vi-VN') : '';
}

watch(() => route.fullPath, () => {
  const status = route.query.status;
  statusFilter.value = typeof status === 'string' && Object.hasOwn(STATUS_LABELS, status) ? status as ReservationStatus : '';
  void load();
}, { immediate: true });
</script>

<template>
  <section class="reservations">
    <h1>Đặt trước</h1>

    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
    <p v-if="noticeMessage" role="status" aria-live="polite">{{ noticeMessage }}</p>

    <fieldset v-if="canManage">
      <legend>Đặt trước cho bạn đọc</legend>
      <form class="row" @submit.prevent="onSearchBorrowers">
        <label>
          Tìm bạn đọc
          <input v-model="form.search" type="text" />
        </label>
        <button type="submit">Tìm</button>
      </form>
      <form class="row" @submit.prevent="onSearchEditions">
        <label>Tìm ấn bản theo nhan đề, ISBN, tác giả
          <input v-model="form.editionSearch" type="search" maxlength="200" />
        </label>
        <button type="submit">Tìm ấn bản</button>
      </form>
      <form class="row" @submit.prevent="onCreate">
        <label>
          Bạn đọc
          <select v-model="form.borrowerId" required>
            <option value="">—</option>
            <option v-for="borrower in borrowers" :key="borrower.id" :value="borrower.id">
              {{ borrower.fullName ?? borrower.email }} · {{ borrower.cardNumber ?? 'Chưa có mã thẻ' }} · {{ cardStatusLabels[borrower.cardStatus] }}
            </option>
          </select>
        </label>
        <p v-if="borrowers.length" class="reservations__hint">Hiển thị tối đa 20 kết quả. Thu hẹp theo tên, email hoặc mã thẻ.</p>
        <p v-if="selectedBorrower" class="reservations__borrower" aria-live="polite">
          {{ selectedBorrower.email }} · {{ cardStatusLabels[selectedBorrower.cardStatus] }} · Đang mượn {{ selectedBorrower.activeLoanCount }} cuốn · {{ selectedBorrower.unpaidFineCount }} khoản phạt chưa thu
        </p>
        <label>
          Ấn bản
          <select v-model="form.editionId" required>
            <option value="">—</option>
            <option v-for="option in editionOptions" :key="option.id" :value="option.id">
              {{ option.label }}
            </option>
          </select>
        </label>
        <button type="submit" :disabled="submitting || selectedBorrower?.cardStatus !== 'active'">Đặt trước</button>
      </form>
      <button type="button" @click="onExpireDue">Xử lý giữ chỗ hết hạn</button>
    </fieldset>

    <label>
      Trạng thái
      <select v-model="statusFilter" @change="navigate()">
        <option value="">Tất cả</option>
        <option v-for="(label, value) in STATUS_LABELS" :key="value" :value="value">
          {{ label }}
        </option>
      </select>
    </label>

    <p v-if="loading">Đang tải…</p>
    <p v-else-if="reservations.length === 0" class="empty-state">Chưa có yêu cầu đặt trước nào trong bộ lọc hiện tại.</p>

    <table v-else>
      <thead>
        <tr>
          <th scope="col">Tác phẩm</th>
          <th scope="col">Bạn đọc</th>
          <th scope="col">Trạng thái</th>
          <th scope="col">Hạn nhận</th>
          <th scope="col">Thao tác</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="reservation in reservations" :key="reservation.id">
          <td>{{ reservation.workTitle ?? '' }}</td>
          <td>{{ reservation.borrowerName ?? '' }}</td>
          <td><span class="status-badge" :data-state="reservation.status">{{ STATUS_LABELS[reservation.status] ?? reservation.status }}</span></td>
          <td>{{ formatDate(reservation.expiresAt) }}</td>
          <td>
            <button
              v-if="canManage && (reservation.status === 'waiting' || reservation.status === 'ready_for_pickup')"
              type="button"
              :disabled="pendingId === reservation.id"
              @click="onCancel(reservation)"
            >
              Hủy
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <nav v-if="pages > 1" class="row" aria-label="Phân trang đặt trước"><button type="button" :disabled="page <= 1 || loading" @click="navigate(page - 1)">Trang trước</button><span>Trang {{ page }} / {{ pages }} · {{ total }} yêu cầu</span><button type="button" :disabled="page >= pages || loading" @click="navigate(page + 1)">Trang sau</button></nav>
  </section>
</template>
