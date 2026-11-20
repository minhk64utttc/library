<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import type { PublicRecordDto } from '@thu-vien/shared';
import { useSessionStore } from '@/features/auth/session.store';
import { ApiError } from '@/shared/api/client';
import { createReservation, getRecord } from '../api';

const route = useRoute();
const session = useSessionStore();
const record = ref<PublicRecordDto | null>(null);
const loading = ref(true);
const reserving = ref('');
const error = ref('');
const notice = ref('');
const isReader = computed(() => session.account?.roles.includes('reader') ?? false);
const backToSearch = computed(() => typeof route.query.from === 'string' && /^\/search(?:\?|$)/.test(route.query.from) ? route.query.from : '/search');

function copyStatus(status: string): string {
  return ({ available: 'Sẵn sàng', on_loan: 'Đang được mượn', reserved: 'Đang giữ chỗ', other: 'Đang xử lý' })[status] ?? 'Đang xử lý';
}

async function reserve(editionId: string): Promise<void> {
  reserving.value = editionId;
  error.value = '';
  notice.value = '';
  try {
    await createReservation(editionId);
    notice.value = 'Đã ghi nhận yêu cầu đặt trước. Bạn có thể theo dõi trong khu vực bạn đọc.';
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.code === 'CARD_MISSING'
      ? 'Bạn chưa có thẻ thư viện. Vui lòng liên hệ quầy để được cấp thẻ trước khi đặt trước.'
      : cause instanceof ApiError && cause.code === 'CARD_LOCKED'
        ? 'Thẻ thư viện đang bị khóa. Vui lòng liên hệ quầy thư viện.'
        : cause instanceof ApiError && cause.code === 'CARD_EXPIRED'
          ? 'Thẻ thư viện đã hết hạn. Vui lòng gia hạn tại quầy thư viện.'
          : cause instanceof ApiError && cause.status === 400
            ? 'Không thể đặt trước ấn bản này. Có thể bạn đã có yêu cầu đang hoạt động hoặc tài liệu vừa có bản sẵn sàng.'
      : cause instanceof ApiError && cause.status === 401
        ? 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.'
        : 'Không gửi được yêu cầu đặt trước. Vui lòng thử lại.';
  } finally {
    reserving.value = '';
  }
}

onMounted(async () => {
  try {
    record.value = await getRecord(String(route.params.id));
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.status === 404
      ? 'Không tìm thấy tài liệu hoặc tài liệu chưa được công bố.'
      : 'Không tải được thông tin tài liệu. Vui lòng thử lại.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="book-detail">
    <RouterLink class="book-detail__back" :to="backToSearch">← Quay lại tra cứu</RouterLink>
    <div v-if="loading" class="empty-state" role="status">Đang tải thông tin tài liệu…</div>
    <p v-else-if="error && !record" role="alert">{{ error }}</p>
    <template v-else-if="record">
      <header class="book-detail__hero">
        <span class="book-detail__cover" aria-hidden="true">{{ record.classification || 'SÁCH' }}</span>
        <div>
          <p class="eyebrow">Thông tin tài liệu</p>
          <h1>{{ record.title }}</h1>
          <p class="book-detail__author">{{ record.author || 'Chưa cập nhật tác giả' }}</p>
          <dl class="book-detail__metadata">
            <div v-if="record.subject"><dt>Chủ đề</dt><dd>{{ record.subject }}</dd></div>
            <div v-if="record.classification"><dt>Ký hiệu phân loại</dt><dd>{{ record.classification }}</dd></div>
          </dl>
        </div>
      </header>
      <p v-if="notice" class="book-detail__notice" role="status">{{ notice }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <section class="book-detail__editions" aria-labelledby="edition-heading">
        <h2 id="edition-heading">Ấn bản và tình trạng phục vụ</h2>
        <div v-if="!record.editions.length" class="empty-state">Tài liệu chưa có thông tin ấn bản.</div>
        <article v-for="edition in record.editions" :key="edition.id" class="book-detail__edition">
          <div class="book-detail__edition-head">
            <div>
              <h3>{{ edition.editionNo ? `Ấn bản ${edition.editionNo}` : 'Ấn bản' }}</h3>
              <p>{{ [edition.publisherName, edition.publishYear, edition.language].filter(Boolean).join(' · ') || 'Chưa có thông tin xuất bản' }}</p>
            </div>
            <span class="status-badge" :data-state="edition.availableCount ? 'available' : 'reserved'">
              {{ edition.availableCount }} / {{ edition.totalCount }} bản sẵn sàng
            </span>
          </div>
          <p v-if="edition.isbn" class="book-detail__isbn">ISBN: {{ edition.isbn }}</p>
          <p v-if="edition.callNumber" class="book-detail__isbn">Ký hiệu xếp giá: {{ edition.callNumber }}</p>
          <p v-if="edition.availableCount" class="book-detail__isbn">Đến vị trí kệ bên dưới, tìm theo ký hiệu xếp giá và mã cuốn. Mang sách cùng thẻ thư viện đến quầy để làm thủ tục mượn.</p>
          <ul v-if="edition.copies.length" class="book-detail__locations">
            <li v-for="(copy, index) in edition.copies" :key="`${copy.locationName}-${copy.status}-${index}`">
              <span><strong>{{ copy.code }}</strong> · {{ copy.locationName || 'Liên hệ quầy để biết vị trí' }}</span>
              <span>{{ copyStatus(copy.status) }}</span>
            </li>
          </ul>
          <p v-else class="book-detail__isbn">Chưa có bản sao trong kho.</p>
          <button
            v-if="edition.availableCount === 0 && session.isAuthenticated && isReader"
            type="button"
            :disabled="Boolean(reserving)"
            @click="reserve(edition.id)"
          >{{ reserving === edition.id ? 'Đang gửi…' : 'Đặt trước ấn bản' }}</button>
          <RouterLink v-else-if="edition.availableCount === 0 && !session.isAuthenticated" class="book-detail__login" :to="{ name: 'login', query: { redirect: route.fullPath } }">Đăng nhập để đặt trước</RouterLink>
        </article>
      </section>
    </template>
  </section>
</template>

<style scoped>
.book-detail__back { display: inline-block; margin-bottom: 20px; font-size: .86rem; font-weight: 600; text-decoration: none; }
.book-detail__back:hover, .book-detail__login:hover { text-decoration: underline; text-underline-offset: 3px; }
.book-detail__hero { display: grid; grid-template-columns: 116px minmax(0, 1fr); gap: 24px; padding: 27px; background: linear-gradient(110deg, #f7f9fd, #edf3fc); border: 1px solid #e3eaf5; border-left: 4px solid var(--gold); border-radius: 13px; }
.book-detail__cover { display: grid; place-items: center; min-height: 150px; padding: 12px; text-align: center; overflow-wrap: anywhere; color: var(--navy); background: linear-gradient(145deg, #fefefe, #e6edf8); border: 1px solid #d4deec; border-radius: 5px 12px 12px 5px; box-shadow: 5px 5px 0 #dce4f0; font-size: 1rem; font-weight: 700; }
.book-detail__hero h1 { margin: 8px 0; }
.book-detail__author { color: var(--muted); }
.book-detail__metadata { display: flex; flex-wrap: wrap; gap: 10px 26px; margin: 0; font-size: .82rem; }
.book-detail__metadata div { display: flex; gap: 7px; }
.book-detail__metadata dt { color: var(--muted); }
.book-detail__metadata dd { margin: 0; }
.book-detail__editions { margin-top: 28px; }
.book-detail__editions > h2 { margin-bottom: 15px; }
.book-detail__edition { margin: 12px 0; padding: 20px; border: 1px solid var(--line); border-radius: 12px; }
.book-detail__edition-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: start; gap: 12px; }
.book-detail__edition h3 { margin: 0 0 5px; font-size: .98rem; }
.book-detail__edition-head p, .book-detail__isbn { margin: 0 0 12px; color: var(--muted); font-size: .82rem; }
.book-detail__locations { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin: 14px 0; padding: 0; list-style: none; }
.book-detail__locations li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; color: var(--ink); background: #f7f9fd; border-radius: 8px; font-size: .78rem; }
.book-detail__locations li span:last-child { color: var(--muted); white-space: nowrap; }
.book-detail__login { display: inline-block; padding: 9px 13px; color: var(--navy); background: #f4f7fd; border: 1px solid #cbd8eb; border-radius: 8px; font-size: .84rem; font-weight: 600; text-decoration: none; }
.book-detail__notice { padding: 12px 15px; color: #2f6451; background: #e8f5ed; border: 1px solid #c8e4d1; border-radius: 9px; }
@media (max-width: 520px) { .book-detail__hero { grid-template-columns: 1fr; padding: 20px; } .book-detail__cover { min-height: 80px; max-width: 80px; } .book-detail__edition { padding: 15px; } }
</style>
