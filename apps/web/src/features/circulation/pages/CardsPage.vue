<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { LibraryCardBorrowerDto, LibraryCardDto, LibraryCardStatus, Paginated } from '@thu-vien/shared';
import { ApiError } from '@/shared/api/client';
import * as cardsApi from '../cards-api';

const route = useRoute();
const router = useRouter();
const result = ref<Paginated<LibraryCardDto> | null>(null);
const borrowers = ref<LibraryCardBorrowerDto[]>([]);
const borrowerSearch = ref('');
const loadingBorrowers = ref(false);
const loading = ref(false);
const issuing = ref(false);
const pendingId = ref('');
const error = ref('');
const notice = ref('');
const search = reactive({ q: '', status: '' as LibraryCardStatus | '' });
const issueForm = reactive({ accountId: '', cardNumber: '', expiresOn: '' });
const renewForms = reactive<Record<string, { expiresOn: string; reason: string }>>({});
const actionReasons = reactive<Record<string, string>>({});

const statusLabels: Record<LibraryCardStatus, string> = { active: 'Đang hiệu lực', locked: 'Đang khóa', expired: 'Đã hết hạn' };
const eventLabels: Record<string, string> = { issued: 'Cấp thẻ', renewed: 'Gia hạn', locked: 'Khóa thẻ', active: 'Mở khóa' };

function listQuery(page: number) {
  return {
    ...(search.q.trim() ? { q: search.q.trim() } : {}),
    ...(search.status ? { status: search.status } : {}),
    page: String(page),
  };
}

async function load(): Promise<void> {
  search.q = typeof route.query.q === 'string' ? route.query.q : '';
  const value = route.query.status;
  search.status = value === 'active' || value === 'locked' || value === 'expired' ? value : '';
  const page = Math.max(1, Number(route.query.page) || 1);
  loading.value = true;
  error.value = '';
  try {
    result.value = await cardsApi.listCards({
      page,
      pageSize: 10,
      ...(search.q ? { q: search.q } : {}),
      ...(search.status ? { status: search.status } : {}),
    });
    for (const card of result.value.items) {
      renewForms[card.id] ??= { expiresOn: '', reason: '' };
      actionReasons[card.id] ??= '';
    }
  } catch {
    error.value = 'Không tải được danh sách thẻ. Hãy kiểm tra quyền truy cập rồi thử lại.';
  } finally {
    loading.value = false;
  }
}

function applyFilters(): void {
  void router.push({ name: 'circulation-cards', query: listQuery(1) });
}

async function searchBorrowers(): Promise<void> {
  loadingBorrowers.value = true;
  error.value = '';
  try {
    borrowers.value = await cardsApi.findCardBorrowers(borrowerSearch.value);
    issueForm.accountId = borrowers.value[0]?.id ?? '';
  } catch {
    error.value = 'Không tìm được bạn đọc chưa có thẻ.';
  } finally {
    loadingBorrowers.value = false;
  }
}

async function issue(): Promise<void> {
  if (issuing.value || !issueForm.accountId) return;
  issuing.value = true;
  error.value = '';
  notice.value = '';
  try {
    await cardsApi.issueCard(issueForm);
    notice.value = 'Đã cấp thẻ và ghi lịch sử.';
    issueForm.cardNumber = '';
    issueForm.expiresOn = '';
    await Promise.all([load(), searchBorrowers()]);
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.code === 'CARD_NUMBER_IN_USE'
      ? 'Mã thẻ đã được sử dụng. Hãy nhập mã khác.'
      : 'Không cấp được thẻ. Kiểm tra thông tin bạn đọc, mã thẻ và ngày hết hạn.';
  } finally {
    issuing.value = false;
  }
}

async function renew(card: LibraryCardDto): Promise<void> {
  if (pendingId.value) return;
  pendingId.value = card.id;
  error.value = '';
  notice.value = '';
  try {
    await cardsApi.renewCard(card.id, renewForms[card.id] ?? { expiresOn: '', reason: '' });
    notice.value = `Đã gia hạn thẻ ${card.cardNumber}.`;
    const renewForm = renewForms[card.id];
    if (renewForm) renewForm.expiresOn = '';
    await load();
  } catch {
    error.value = 'Không gia hạn được thẻ. Ngày mới phải sau hạn hiện tại và trong tương lai.';
  } finally {
    pendingId.value = '';
  }
}

async function setLocked(card: LibraryCardDto, action: 'lock' | 'unlock'): Promise<void> {
  if (pendingId.value) return;
  pendingId.value = card.id;
  error.value = '';
  notice.value = '';
  try {
    await cardsApi.changeCardStatus(card.id, action, { reason: actionReasons[card.id] ?? '' });
    notice.value = action === 'lock' ? `Đã khóa thẻ ${card.cardNumber}.` : `Đã mở khóa thẻ ${card.cardNumber}.`;
    actionReasons[card.id] = '';
    await load();
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.code === 'CARD_EXPIRED'
      ? 'Thẻ đã hết hạn. Gia hạn thẻ trước khi mở khóa.'
      : 'Không cập nhật được trạng thái thẻ. Nhập lý do và tải lại danh sách để kiểm tra.';
  } finally {
    pendingId.value = '';
  }
}

function changePage(page: number): void {
  void router.push({ name: 'circulation-cards', query: listQuery(page) });
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

watch(() => route.fullPath, () => void load());
onMounted(() => void load());
</script>

<template>
  <section class="cards" aria-labelledby="cards-title">
    <header class="cards__heading">
      <p class="eyebrow">Lưu thông</p>
      <h1 id="cards-title">Thẻ bạn đọc</h1>
      <p>Cấp và gia hạn theo ngày cán bộ nhập; khóa hoặc mở khóa đều cần ghi lý do.</p>
    </header>

    <fieldset class="cards__issue">
      <legend>Cấp thẻ mới</legend>
      <form class="cards__borrower-search" @submit.prevent="searchBorrowers">
        <label>Tìm bạn đọc chưa có thẻ
          <input v-model="borrowerSearch" type="search" placeholder="Tên hoặc email" />
        </label>
        <button type="submit" :disabled="loadingBorrowers">{{ loadingBorrowers ? 'Đang tìm…' : 'Tìm bạn đọc' }}</button>
      </form>
      <p v-if="!loadingBorrowers && borrowerSearch && borrowers.length === 0" class="cards__hint">Không tìm thấy bạn đọc đang hoạt động chưa có thẻ.</p>
      <form class="cards__issue-form" @submit.prevent="issue">
        <label>Chọn bạn đọc
          <select v-model="issueForm.accountId" required>
            <option value="">Chọn bạn đọc</option>
            <option v-for="borrower in borrowers" :key="borrower.id" :value="borrower.id">{{ borrower.fullName }} · {{ borrower.email }}</option>
          </select>
        </label>
        <label>Mã thẻ
          <input v-model="issueForm.cardNumber" required minlength="3" maxlength="40" pattern="[A-Za-z0-9][A-Za-z0-9-]*" placeholder="Ví dụ: UTC-2026-001" />
        </label>
        <label>Ngày hết hạn
          <input v-model="issueForm.expiresOn" type="date" required />
        </label>
        <button type="submit" :disabled="issuing || !issueForm.accountId">{{ issuing ? 'Đang cấp…' : 'Cấp thẻ' }}</button>
      </form>
    </fieldset>

    <form class="cards__filters" @submit.prevent="applyFilters">
      <label>Tìm thẻ / bạn đọc<input v-model="search.q" type="search" /></label>
      <label>Trạng thái
        <select v-model="search.status">
          <option value="">Tất cả</option><option value="active">Đang hiệu lực</option><option value="locked">Đang khóa</option><option value="expired">Đã hết hạn</option>
        </select>
      </label>
      <button type="submit">Lọc danh sách</button>
    </form>

    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="cards__notice" role="status">{{ notice }}</p>
    <div v-if="loading" class="empty-state" role="status">Đang tải danh sách thẻ…</div>
    <template v-else-if="result">
      <p class="cards__count">{{ result.total }} thẻ</p>
      <div v-if="result.items.length" class="cards__list">
        <article v-for="card in result.items" :key="card.id" class="library-card" :class="{ 'library-card--locked': card.status !== 'active' }">
          <div class="library-card__top">
            <div>
              <p class="library-card__number">{{ card.cardNumber }}</p>
              <h2>{{ card.borrowerName }}</h2>
              <p class="library-card__email">{{ card.borrowerEmail }}</p>
            </div>
            <span class="status-badge" :data-state="card.status">{{ statusLabels[card.status] }}</span>
          </div>
          <p class="library-card__expiry">Có hiệu lực đến <strong>{{ formatDate(card.expiresOn) }}</strong></p>
          <p v-if="card.lockReason" class="library-card__reason">Lý do khóa: {{ card.lockReason }}</p>
          <div class="library-card__actions">
            <details>
              <summary>Gia hạn</summary>
              <form @submit.prevent="renew(card)">
                <label>Ngày hết hạn mới<input v-model="renewForms[card.id]!.expiresOn" type="date" required /></label>
                <label>Lý do (không bắt buộc)<input v-model="renewForms[card.id]!.reason" maxlength="500" /></label>
                <button type="submit" :disabled="Boolean(pendingId)">{{ pendingId === card.id ? 'Đang lưu…' : 'Lưu gia hạn' }}</button>
              </form>
            </details>
            <details>
              <summary>{{ card.status === 'locked' ? 'Mở khóa' : 'Khóa thẻ' }}</summary>
              <form @submit.prevent="setLocked(card, card.status === 'locked' ? 'unlock' : 'lock')">
                <label>Lý do
                  <textarea v-model="actionReasons[card.id]!" required minlength="5" maxlength="500" placeholder="Ghi lý do thao tác"></textarea>
                </label>
                <button type="submit" :disabled="Boolean(pendingId)">{{ pendingId === card.id ? 'Đang lưu…' : card.status === 'locked' ? 'Mở khóa thẻ' : 'Khóa thẻ' }}</button>
              </form>
            </details>
          </div>
          <details class="library-card__history">
            <summary>Lịch sử thao tác ({{ card.events.length }})</summary>
            <ol>
              <li v-for="event in card.events" :key="event.id">
                <strong>{{ eventLabels[event.action] || event.action }}</strong>
                <span>{{ event.actorName }} · {{ new Date(event.createdAt).toLocaleString('vi-VN') }}</span>
                <span v-if="event.previousExpiresOn || event.newExpiresOn">Hạn: {{ event.previousExpiresOn ? formatDate(event.previousExpiresOn) : '—' }} → {{ event.newExpiresOn ? formatDate(event.newExpiresOn) : '—' }}</span>
                <span v-if="event.reason">{{ event.reason }}</span>
              </li>
            </ol>
          </details>
        </article>
      </div>
      <p v-else class="empty-state">Chưa có thẻ nào trong bộ lọc hiện tại.</p>
      <nav v-if="Math.ceil(result.total / result.pageSize) > 1" class="cards__pagination" aria-label="Phân trang thẻ bạn đọc">
        <button type="button" :disabled="result.page <= 1" @click="changePage(result.page - 1)">Trang trước</button>
        <span>Trang {{ result.page }} / {{ Math.ceil(result.total / result.pageSize) }}</span>
        <button type="button" :disabled="result.page >= Math.ceil(result.total / result.pageSize)" @click="changePage(result.page + 1)">Trang sau</button>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.cards__heading { margin-bottom: 22px; }
.cards__heading h1 { margin: 7px 0 4px; }
.cards__heading > p:last-child { margin: 0; color: var(--muted); }
.cards__issue { margin: 0 0 22px; }
.cards__borrower-search, .cards__issue-form, .cards__filters { display: flex; flex-wrap: wrap; align-items: end; gap: 13px; }
.cards__borrower-search { margin-bottom: 14px; }
.cards__borrower-search label { flex: 1 1 260px; }
.cards__issue-form label { flex: 1 1 190px; }
.cards__filters { margin-bottom: 18px; padding: 17px; background: #f8faff; border: 1px solid var(--line); border-radius: 11px; }
.cards__filters label { flex: 1 1 190px; }
.cards__hint, .cards__count { color: var(--muted); font-size: .82rem; }
.cards__list { display: grid; gap: 12px; }
.library-card { padding: 20px; border: 1px solid var(--line); border-left: 4px solid var(--sage); border-radius: 12px; }
.library-card--locked { border-left-color: var(--rose); }
.library-card__top { display: flex; justify-content: space-between; align-items: start; gap: 14px; }
.library-card__number { margin: 0 0 5px; color: #7b652b; font-size: .72rem; font-weight: 700; letter-spacing: .08em; }
.library-card h2 { margin: 0 0 4px; font-size: 1rem; }
.library-card__email { margin: 0; color: var(--muted); font-size: .78rem; }
.library-card__expiry { margin: 16px 0 8px; font-size: .82rem; }
.library-card__reason { color: #8a404d; font-size: .79rem; }
.library-card__actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0; }
.library-card__actions details, .library-card__history { min-width: 140px; }
.library-card summary { width: fit-content; padding: 8px 11px; color: var(--navy); background: #f4f7fd; border: 1px solid #cbd8eb; border-radius: 8px; cursor: pointer; font-size: .78rem; font-weight: 600; }
.library-card details form { min-width: min(380px, calc(100vw - 80px)); margin-top: 10px; padding: 14px; background: #f8faff; border: 1px solid var(--line); border-radius: 10px; }
.library-card details form label { min-width: 100%; }
.library-card details textarea { min-height: 65px; }
.library-card__history { margin-top: 12px; }
.library-card__history ol { display: grid; gap: 10px; margin: 12px 0 0; padding-left: 22px; }
.library-card__history li { display: grid; gap: 3px; color: var(--muted); font-size: .76rem; }
.library-card__history li strong { color: var(--ink); }
.cards__notice { padding: 11px 13px; color: #2f6451; background: #e8f5ed; border: 1px solid #c8e4d1; border-radius: 8px; font-size: .83rem; }
.cards__pagination { display: flex; justify-content: center; align-items: center; gap: 15px; margin: 22px 0 0; color: var(--muted); font-size: .82rem; }
@media (max-width: 540px) { .library-card { padding: 15px; } .library-card__top { flex-direction: column; } }
</style>
