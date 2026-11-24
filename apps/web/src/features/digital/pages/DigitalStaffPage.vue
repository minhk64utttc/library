<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { DigitalAccessLevel, DigitalSubmissionDto, Paginated } from '@thu-vien/shared';
import { useSessionStore } from '@/features/auth/session.store';
import { ApiError } from '@/shared/api/client';
import {
  acceptDigitalSubmission, downloadDigitalFile, getDigitalSubmission,
  listDigitalSubmissions, publishDigitalSubmission, requestDigitalInfo, startDigitalReview,
} from '../api';

const session = useSessionStore();
const isReviewer = computed(() => session.can('digital:manage'));
const canPublish = computed(() => session.can('digital:publish'));
const result = ref<Paginated<DigitalSubmissionDto> | null>(null);
const loading = ref(true);
const busyId = ref('');
const downloadingId = ref('');
const error = ref('');
const notice = ref('');
const query = ref('');
const statusFilter = ref('');
const page = ref(1);
const expandedId = ref('');
const expandedCardId = ref('');
const events = ref<Record<string, Array<{ id: string; action: string; note: string | null; actorName: string; createdAt: string }>>>({});
const notes = reactive<Record<string, string>>({});
const accessLevels = reactive<Record<string, DigitalAccessLevel>>({});
const statusLabels: Record<string, string> = {
  new_submission: 'Mới nộp', under_review: 'Đang thẩm định', need_more_info: 'Cần bổ sung', accepted: 'Đã tiếp nhận', published: 'Đã công bố',
};
const actionLabels: Record<string, string> = {
  created: 'Tạo hồ sơ', file_uploaded: 'Tải tệp', metadata_updated: 'Cập nhật thông tin',
  review_started: 'Bắt đầu thẩm định', more_info_requested: 'Yêu cầu bổ sung',
  more_info_added: 'Bổ sung thông tin', accepted: 'Tiếp nhận', published: 'Công bố',
  rejected: 'Từ chối', publication_withdrawn: 'Thu hồi công bố',
};
function actionLabel(action: string): string { return actionLabels[action] ?? `Cập nhật hồ sơ (${action.replaceAll('_', ' ')})`; }
const totalPages = computed(() => Math.max(1, Math.ceil((result.value?.total ?? 0) / (result.value?.pageSize ?? 10))));

async function load(nextPage = 1): Promise<void> {
  loading.value = true; error.value = '';
  try {
    result.value = await listDigitalSubmissions({ page: nextPage, pageSize: 10, q: query.value.trim() || undefined, status: (statusFilter.value || undefined) as DigitalSubmissionDto['status'] | undefined });
    page.value = nextPage;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không tải được hàng đợi hồ sơ.';
  } finally { loading.value = false; }
}

async function act(item: DigitalSubmissionDto, action: 'start' | 'request' | 'accept' | 'publish'): Promise<void> {
  if (busyId.value) return;
  busyId.value = item.id; error.value = ''; notice.value = '';
  try {
    const note = notes[item.id]?.trim() ?? '';
    if (action === 'start') await startDigitalReview(item.id);
    if (action === 'request') await requestDigitalInfo(item.id, { note });
    if (action === 'accept') await acceptDigitalSubmission(item.id, { note });
    if (action === 'publish') await publishDigitalSubmission(item.id, { accessLevel: accessLevels[item.id] ?? 'public', note: note || undefined });
    notice.value = `Đã cập nhật hồ sơ ${item.submissionCode}.`;
    await load(page.value);
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Không cập nhật được trạng thái hồ sơ.';
  } finally { busyId.value = ''; }
}

async function toggleEvents(id: string): Promise<void> {
  if (expandedId.value === id) { expandedId.value = ''; return; }
  expandedId.value = id;
  if (events.value[id]) return;
  try { events.value[id] = (await getDigitalSubmission(id)).events; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không tải được lịch sử hồ sơ.'; }
}

async function download(item: DigitalSubmissionDto): Promise<void> {
  if (!item.file || downloadingId.value) return;
  downloadingId.value = item.id; error.value = '';
  try {
    const blob = await downloadDigitalFile(item.file.id);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = item.file.originalName; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không tải được tệp.'; }
  finally { downloadingId.value = ''; }
}

onMounted(() => void load());
</script>

<template>
  <section class="digital-staff" aria-labelledby="digital-staff-title">
    <header class="digital-staff__heading"><p class="eyebrow">Quản lý học liệu số</p><h1 id="digital-staff-title">Thẩm định và công bố</h1><p>Tiếp nhận hồ sơ, yêu cầu bổ sung, kiểm tra quyền sử dụng và chọn mức truy cập khi công bố.</p></header>
    <p v-if="error" class="digital-staff__message digital-staff__message--error" role="alert">{{ error }}</p>
    <p v-if="notice" class="digital-staff__message" role="status">{{ notice }}</p>
    <form class="digital-staff__filters" @submit.prevent="load(1)">
      <label>Tìm hồ sơ<input v-model="query" type="search" placeholder="Mã, tên tài liệu, tác giả" /></label>
      <label>Trạng thái<select v-model="statusFilter"><option value="">Tất cả</option><option value="new_submission">Mới nộp</option><option value="under_review">Đang thẩm định</option><option value="need_more_info">Cần bổ sung</option><option value="accepted">Đã tiếp nhận</option><option value="published">Đã công bố</option></select></label>
      <button type="submit" :disabled="loading">Lọc hồ sơ</button>
    </form>
    <p v-if="loading" class="digital-staff__empty" role="status">Đang tải hồ sơ…</p>
    <div v-else-if="result?.items.length" class="digital-staff__list">
      <article v-for="item in result.items" :key="item.id" class="digital-case">
        <div class="digital-case__top"><div><span class="digital-case__code">{{ item.submissionCode }}</span><h2>{{ item.title }}</h2><p>{{ item.author }}<span v-if="item.department"> · {{ item.department }}</span><span v-if="item.publishedYear"> · {{ item.publishedYear }}</span></p></div><span class="digital-case__status">{{ statusLabels[item.status] }}</span></div>
        <button type="button" class="digital-case__expand" :aria-expanded="expandedCardId === item.id" @click="expandedCardId = expandedCardId === item.id ? '' : item.id">{{ expandedCardId === item.id ? 'Thu gọn hồ sơ' : 'Mở chi tiết và thao tác' }}</button>
        <div v-if="expandedCardId === item.id" class="digital-case__body">
        <p class="digital-case__abstract">{{ item.abstract }}</p>
        <dl class="digital-case__metadata"><div><dt>Người nộp</dt><dd>{{ item.submitterName }}</dd></div><div><dt>Quyền sử dụng</dt><dd>{{ item.license }}</dd></div><div><dt>Tệp</dt><dd>{{ item.file ? `${item.file.originalName} · v${item.file.versionNumber}` : 'Chưa tải tệp' }}</dd></div></dl>
        <div class="digital-case__actions">
          <button v-if="item.file" type="button" class="digital-case__text-button" :disabled="downloadingId === item.id" @click="download(item)">{{ downloadingId === item.id ? 'Đang tải…' : 'Mở tệp thẩm định' }}</button>
          <button type="button" class="digital-case__text-button" @click="toggleEvents(item.id)">{{ expandedId === item.id ? 'Ẩn lịch sử' : 'Lịch sử xử lý' }}</button>
          <button v-if="isReviewer && item.status === 'new_submission'" type="button" :disabled="busyId === item.id || !item.file" @click="act(item, 'start')">Bắt đầu thẩm định</button>
        </div>
        <div v-if="isReviewer && item.status === 'under_review'" class="digital-case__decision">
          <label>Ghi chú xử lý<textarea v-model="notes[item.id]" rows="2" minlength="5" maxlength="2000" placeholder="Nêu rõ lý do tiếp nhận hoặc nội dung cần bổ sung"></textarea></label>
          <div><button type="button" class="digital-case__secondary" :disabled="busyId === item.id || (notes[item.id]?.trim().length ?? 0) < 5" @click="act(item, 'request')">Yêu cầu bổ sung</button><button type="button" :disabled="busyId === item.id || (notes[item.id]?.trim().length ?? 0) < 5" @click="act(item, 'accept')">Tiếp nhận hồ sơ</button></div>
        </div>
        <div v-if="canPublish && item.status === 'accepted'" class="digital-case__decision digital-case__publish">
          <label>Mức truy cập<select v-model="accessLevels[item.id]"><option value="public">Công khai</option><option value="members_only">Bạn đọc đăng nhập</option><option value="campus_only">Trong trường (chưa tích hợp SSO)</option><option value="restricted">Hạn chế</option></select></label>
          <label>Ghi chú công bố<textarea v-model="notes[item.id]" rows="2" maxlength="2000" placeholder="Ghi chú không bắt buộc"></textarea></label>
          <button type="button" :disabled="busyId === item.id" @click="act(item, 'publish')">Công bố tài liệu</button>
          <p class="digital-case__access-note">Mức “Trong trường” hiện được bảo vệ như tài liệu hạn chế vì dự án chưa có xác minh thành viên qua SSO.</p>
        </div>
        <div v-if="expandedId === item.id" class="digital-case__timeline"><h3>Lịch sử xử lý</h3><ol><li v-for="event in events[item.id] ?? []" :key="event.id"><strong>{{ actionLabel(event.action) }}</strong><span>{{ event.actorName }} · {{ new Date(event.createdAt).toLocaleString('vi-VN') }}</span><p v-if="event.note">{{ event.note }}</p></li></ol><p v-if="events[item.id]?.length === 0">Chưa có sự kiện.</p></div>
        </div>
      </article>
    </div>
    <p v-else-if="!loading" class="digital-staff__empty">Không có hồ sơ phù hợp với bộ lọc.</p>
    <nav v-if="result && totalPages > 1" class="digital-staff__pagination" aria-label="Phân trang hồ sơ"><button type="button" :disabled="page <= 1" @click="load(page - 1)">Trước</button><span>Trang {{ page }} / {{ totalPages }}</span><button type="button" :disabled="page >= totalPages" @click="load(page + 1)">Sau</button></nav>
  </section>
</template>

<style scoped>
.digital-staff { --section-accent: var(--navy); }
.digital-staff__heading { margin-bottom: 20px; }
.digital-staff__heading h1 { margin: 6px 0; color: var(--navy-deep); font-size: clamp(1.5rem, 3vw, 2rem); }
.digital-staff__heading > p:last-child { color: var(--muted); }
.digital-staff__filters { display: grid; grid-template-columns: minmax(210px, 1fr) minmax(170px, .5fr) auto; align-items: end; gap: 12px; margin: 18px 0; padding: 16px; background: #f8faff; border: 1px solid var(--line); border-radius: 10px; }
.digital-staff__filters label, .digital-case__decision label { display: grid; gap: 6px; font-size: .81rem; font-weight: 600; }
.digital-staff__filters input, .digital-staff__filters select, .digital-case__decision textarea, .digital-case__decision select { min-height: 39px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 7px; font: inherit; }
.digital-staff button { min-height: 37px; padding: 7px 12px; color: white; background: var(--navy); border: 0; border-radius: 7px; font: inherit; font-size: .81rem; font-weight: 650; cursor: pointer; }
.digital-staff button:disabled { opacity: .5; cursor: not-allowed; }
.digital-staff__filters button { min-height: 39px; }
.digital-staff__list { display: grid; gap: 14px; }
.digital-case { padding: 18px; border: 1px solid var(--line); border-radius: 11px; }
.digital-case__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; }
.digital-case__code { color: var(--muted); font-size: .7rem; letter-spacing: .05em; }
.digital-case h2 { margin: 4px 0; color: var(--navy-deep); font-size: 1.05rem; }
.digital-case__top p { margin: 5px 0; color: var(--muted); font-size: .8rem; }
.digital-case__status { padding: 5px 9px; color: #344a64; background: #edf2fa; border-radius: 99px; font-size: .72rem; white-space: nowrap; }
.digital-case__expand { margin-top: 10px; }
.digital-case__body { padding-top: 4px; }
.digital-case__abstract { color: #46566c; font-size: .83rem; line-height: 1.55; }
.digital-case__metadata { display: flex; flex-wrap: wrap; gap: 10px 22px; margin: 12px 0; }
.digital-case__metadata div { display: grid; gap: 3px; }
.digital-case__metadata dt { color: var(--muted); font-size: .69rem; }
.digital-case__metadata dd { margin: 0; font-size: .78rem; }
.digital-case__actions, .digital-case__decision > div { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 12px; }
.digital-case .digital-case__text-button { padding-inline: 0; color: var(--navy); background: transparent; text-decoration: underline; }
.digital-case__decision { display: grid; gap: 10px; margin-top: 15px; padding: 14px; background: #f8faff; border-radius: 9px; }
.digital-case__decision textarea { resize: vertical; }
.digital-case .digital-case__secondary { color: var(--navy); background: white; border: 1px solid var(--line); }
.digital-case__publish { grid-template-columns: 180px 1fr auto; align-items: end; }
.digital-case__access-note { grid-column: 1 / -1; margin: 0; color: var(--muted); font-size: .72rem; }
.digital-case__timeline { margin-top: 15px; padding-top: 13px; border-top: 1px solid var(--line); }
.digital-case__timeline h3 { margin: 0 0 8px; font-size: .88rem; }
.digital-case__timeline ol { display: grid; gap: 9px; margin: 0; padding-left: 20px; }
.digital-case__timeline li { font-size: .8rem; }
.digital-case__timeline li span { display: block; color: var(--muted); font-size: .72rem; }
.digital-case__timeline li p { margin: 4px 0; }
.digital-staff__empty { padding: 22px; color: var(--muted); text-align: center; }
.digital-staff__message { padding: 11px 13px; color: #2f6451; background: #e8f5ed; border-radius: 8px; }
.digital-staff__message--error { color: #873535; background: #fff1ef; }
.digital-staff__pagination { display: flex; justify-content: center; align-items: center; gap: 14px; margin: 20px 0; color: var(--muted); font-size: .82rem; }
@media (max-width: 720px) { .digital-staff__filters { grid-template-columns: 1fr; } .digital-case__publish { grid-template-columns: 1fr; } }
@media (max-width: 500px) { .digital-case__top { flex-direction: column; } }
</style>
