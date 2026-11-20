<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import type { Paginated, ReservationDto, ReservationStatus } from '@thu-vien/shared';
import { ApiError } from '@/shared/api/client';
import { cancelMyReservation, listMyReservations } from '../api';

const route = useRoute();
const router = useRouter();
const reservations = ref<Paginated<ReservationDto> | null>(null);
const loading = ref(false);
const pendingId = ref('');
const error = ref('');
const notice = ref('');
const statusFilter = ref<ReservationStatus | ''>('');
const totalPages = computed(() => Math.max(1, Math.ceil((reservations.value?.total ?? 0) / (reservations.value?.pageSize ?? 10))));

const labels: Record<string, string> = {
  waiting: 'Đang chờ', ready_for_pickup: 'Sẵn sàng nhận', fulfilled: 'Đã nhận tài liệu',
  cancelled: 'Đã hủy', expired: 'Quá hạn nhận',
};

function queryFor(page: number) {
  return { ...(statusFilter.value ? { status: statusFilter.value } : {}), page: String(page) };
}

async function load(): Promise<void> {
  const query = route.query;
  const statuses: ReservationStatus[] = ['waiting', 'ready_for_pickup', 'fulfilled', 'cancelled', 'expired'];
  statusFilter.value = typeof query.status === 'string' && statuses.includes(query.status as ReservationStatus)
    ? query.status as ReservationStatus
    : '';
  const page = Math.max(1, Number(query.page) || 1);
  loading.value = true;
  error.value = '';
  try {
    reservations.value = await listMyReservations({
      page,
      ...(statusFilter.value ? { status: statusFilter.value } : {}),
    });
  } catch {
    error.value = 'Không tải được yêu cầu đặt trước của bạn. Vui lòng thử lại.';
  } finally {
    loading.value = false;
  }
}

function applyFilters(): void {
  void router.push({ name: 'my-reservations', query: queryFor(1) });
}

function changePage(page: number): void {
  void router.push({ name: 'my-reservations', query: queryFor(page) });
}

async function cancel(reservation: ReservationDto): Promise<void> {
  if (pendingId.value) return;
  pendingId.value = reservation.id;
  error.value = '';
  notice.value = '';
  try {
    await cancelMyReservation(reservation.id);
    notice.value = 'Đã hủy yêu cầu đặt trước.';
    await load();
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.code === 'INVALID_STATE'
      ? 'Yêu cầu này không còn ở trạng thái có thể hủy.'
      : 'Không hủy được yêu cầu đặt trước. Hãy tải lại danh sách và thử lại.';
  } finally {
    pendingId.value = '';
  }
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
}

watch(() => route.fullPath, () => void load());
onMounted(() => void load());
</script>

<template>
  <section class="reader-reservations" aria-labelledby="reader-reservations-title">
    <header class="reader-reservations__heading">
      <p class="eyebrow">Khu vực bạn đọc</p>
      <h1 id="reader-reservations-title">Yêu cầu đặt trước</h1>
      <p>Theo dõi tài liệu đang chờ, sẵn sàng nhận và thời hạn nhận tại thư viện.</p>
      <RouterLink class="reader-reservations__search" to="/search">Tra cứu tài liệu</RouterLink>
    </header>

    <form class="reader-reservations__filters" @submit.prevent="applyFilters">
      <label>Trạng thái
        <select v-model="statusFilter">
          <option value="">Tất cả yêu cầu</option>
          <option value="waiting">Đang chờ</option>
          <option value="ready_for_pickup">Sẵn sàng nhận</option>
          <option value="fulfilled">Đã nhận tài liệu</option>
          <option value="cancelled">Đã hủy</option>
          <option value="expired">Quá hạn nhận</option>
        </select>
      </label>
      <button type="submit">Lọc danh sách</button>
    </form>

    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="reader-reservations__notice" role="status">{{ notice }}</p>
    <div v-if="loading" class="empty-state" role="status">Đang tải yêu cầu…</div>
    <template v-else-if="reservations">
      <p class="reader-reservations__count">{{ reservations.total }} yêu cầu</p>
      <div v-if="reservations.items.length" class="reader-reservations__list">
        <article v-for="reservation in reservations.items" :key="reservation.id" class="reader-reservation">
          <div class="reader-reservation__top">
            <div>
              <h2>{{ reservation.workTitle || 'Tài liệu chưa có nhan đề' }}</h2>
              <p>Ngày đặt: {{ formatDate(reservation.createdAt) }}</p>
            </div>
            <span class="status-badge" :data-state="reservation.status">{{ labels[reservation.status] || reservation.status }}</span>
          </div>
          <p v-if="reservation.status === 'ready_for_pickup'" class="reader-reservation__pickup">
            Nhận tài liệu trước {{ formatDate(reservation.expiresAt) }} tại thư viện.
          </p>
          <p v-else-if="reservation.status === 'waiting'" class="reader-reservation__hint">Thư viện sẽ thông báo khi có bản sao sẵn sàng. Thời gian chờ phụ thuộc tình trạng tài liệu.</p>
          <button
            v-if="reservation.status === 'waiting' || reservation.status === 'ready_for_pickup'"
            type="button"
            :disabled="Boolean(pendingId)"
            @click="cancel(reservation)"
          >{{ pendingId === reservation.id ? 'Đang hủy…' : 'Hủy yêu cầu' }}</button>
        </article>
      </div>
      <div v-else class="empty-state">Chưa có yêu cầu đặt trước trong bộ lọc này. Bạn có thể tìm tài liệu trong danh mục.</div>
      <nav v-if="totalPages > 1" class="reader-reservations__pagination" aria-label="Phân trang yêu cầu đặt trước">
        <button type="button" :disabled="reservations.page <= 1" @click="changePage(reservations.page - 1)">Trang trước</button>
        <span>Trang {{ reservations.page }} / {{ totalPages }}</span>
        <button type="button" :disabled="reservations.page >= totalPages" @click="changePage(reservations.page + 1)">Trang sau</button>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.reader-reservations__heading { position: relative; margin-bottom: 22px; padding-right: 180px; }
.reader-reservations__heading h1 { margin: 7px 0 4px; }
.reader-reservations__heading > p:not(.eyebrow) { margin: 0; color: var(--muted); }
.reader-reservations__search { position: absolute; top: 20px; right: 0; padding: 9px 12px; color: #fff; background: var(--navy); border-radius: 8px; font-size: .8rem; font-weight: 600; text-decoration: none; }
.reader-reservations__search:hover { background: var(--navy-hover); }
.reader-reservations__filters { display: flex; flex-wrap: wrap; align-items: end; gap: 14px; margin-bottom: 20px; padding: 18px; background: #f8faff; border: 1px solid var(--line); border-radius: 11px; }
.reader-reservations__filters label { flex: 1 1 230px; }
.reader-reservations__count { color: var(--muted); font-size: .83rem; }
.reader-reservations__list { display: grid; gap: 12px; }
.reader-reservation { padding: 20px; border: 1px solid var(--line); border-radius: 12px; }
.reader-reservation__top { display: flex; justify-content: space-between; align-items: start; gap: 14px; }
.reader-reservation h2 { margin: 0 0 5px; font-size: 1rem; }
.reader-reservation__top p, .reader-reservation__hint { margin: 0; color: var(--muted); font-size: .78rem; }
.reader-reservation__pickup { padding: 11px 13px; color: #725220; background: #fbf4df; border-radius: 8px; font-size: .8rem; }
.reader-reservation > button { min-height: 36px; padding: 7px 11px; font-size: .78rem; }
.reader-reservations__notice { padding: 11px 13px; color: #2f6451; background: #e8f5ed; border: 1px solid #c8e4d1; border-radius: 8px; font-size: .83rem; }
.reader-reservations__pagination { display: flex; justify-content: center; align-items: center; gap: 15px; margin: 22px 0 0; color: var(--muted); font-size: .82rem; }
@media (max-width: 540px) { .reader-reservations__heading { padding-right: 0; } .reader-reservations__search { position: static; display: inline-block; margin-top: 14px; } .reader-reservation { padding: 15px; } .reader-reservation__top { flex-direction: column; } }
</style>
