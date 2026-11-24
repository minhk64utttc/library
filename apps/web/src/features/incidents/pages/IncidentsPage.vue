<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  INCIDENT_DECISIONS,
  INCIDENT_KINDS,
  INCIDENT_STATUSES,
  type CopyDto,
  type IncidentDecision,
  type IncidentDto,
  type IncidentKind,
  type IncidentStatus,
} from '@thu-vien/shared';

import { useSessionStore } from '@/features/auth/session.store';
import { ApiError } from '@/shared/api/client';
import * as incidentsApi from '../api';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const canReport = computed(() => session.can('incidents:report'));
const canDecide = computed(() => session.can('incidents:decide'));

const statusLabels: Record<IncidentStatus, string> = {
  new: 'Mới ghi nhận',
  need_info: 'Cần bổ sung',
  under_review: 'Chờ quyết định',
  resolved: 'Đã xử lý',
};
const kindLabels: Record<IncidentKind, string> = {
  reported_lost: 'Báo mất',
  damaged: 'Hư hỏng',
  other: 'Khác',
};
const decisionLabels: Record<IncidentDecision, string> = {
  no_change: 'Không đổi hiện trạng',
  confirmed_lost: 'Xác nhận mất',
  confirmed_damaged: 'Xác nhận hư hỏng',
};

const incidents = ref<IncidentDto[]>([]);
const copies = ref<CopyDto[]>([]);
const copySearch = ref('');
const searchingCopies = ref(false);
const total = ref(0);
const loading = ref(false);
const pending = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const selectedId = ref<string | null>(null);
const detailDialog = ref<HTMLDialogElement | null>(null);
const selectedImages = ref<File[]>([]);
const selectedImagesIncidentId = ref<string | null>(null);
const imagePreviews = ref<Array<{ name: string; url: string }>>([]);
const createForm = reactive({ copyId: '', kind: 'reported_lost' as IncidentKind, description: '', evidence: '' });
const infoText = ref('');
const requestText = ref('');
const decisionForm = reactive({ decision: 'no_change' as IncidentDecision, reason: '' });

const page = computed(() => {
  const value = Number(route.query.page);
  return Number.isInteger(value) && value > 0 ? value : 1;
});
const statusFilter = computed<IncidentStatus | ''>(() =>
  typeof route.query.status === 'string' && INCIDENT_STATUSES.includes(route.query.status as IncidentStatus)
    ? (route.query.status as IncidentStatus)
    : '',
);
const selected = computed(() => incidents.value.find((incident) => incident.id === selectedId.value) ?? null);
const decisionImpact = computed(() => ({
  no_change: 'Kết thúc tra soát và đưa bản sao về trạng thái phục vụ nếu điều kiện kho cho phép.',
  confirmed_lost: 'Đánh dấu bản sao là mất; nếu đang mượn, khoản mượn sẽ được đóng theo trạng thái mất.',
  confirmed_damaged: 'Đánh dấu bản sao hư hỏng; nếu còn đang mượn, trạng thái hư hỏng được áp dụng khi nhận trả.',
}[decisionForm.decision]));
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 20)));

async function openIncident(id: string): Promise<void> {
  selectedId.value = id;
  await nextTick();
  detailDialog.value?.showModal();
}

async function load(): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await incidentsApi.listIncidents({
      page: page.value,
      ...(statusFilter.value ? { status: statusFilter.value } : {}),
    });
    incidents.value = result.items;
    total.value = result.total;
  } catch {
    errorMessage.value = 'Không tải được hồ sơ sự cố. Hãy thử lại.';
  } finally {
    loading.value = false;
  }
}

async function onSearchCopies(): Promise<void> {
  if (!copySearch.value.trim()) return;
  searchingCopies.value = true;
  errorMessage.value = '';
  try {
    copies.value = (await incidentsApi.searchCopies(copySearch.value.trim())).items;
    createForm.copyId = '';
  } catch {
    errorMessage.value = 'Không tìm được mã cuốn. Hãy thử lại.';
  } finally {
    searchingCopies.value = false;
  }
}

async function runAction(action: () => Promise<IncidentDto>, message: string): Promise<void> {
  if (pending.value) return;
  pending.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await action();
    successMessage.value = message;
    await load();
  } catch (error) {
    errorMessage.value = error instanceof ApiError && error.status === 409
      ? 'Dữ liệu vừa thay đổi hoặc bản sao đã có hồ sơ đang xử lý. Hãy tải lại.'
      : 'Không thực hiện được thao tác. Kiểm tra trạng thái hồ sơ và thử lại.';
  } finally {
    pending.value = false;
  }
}

async function onCreate(): Promise<void> {
  if (pending.value) return;
  pending.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const created = await incidentsApi.createIncident({
      copyId: createForm.copyId,
      kind: createForm.kind,
      description: createForm.description.trim(),
      ...(createForm.evidence.trim() ? { evidence: createForm.evidence.trim() } : {}),
    });
    createForm.copyId = '';
    createForm.description = '';
    createForm.evidence = '';
    selectedId.value = created.id;
    successMessage.value = 'Đã ghi nhận hồ sơ. Bản sao sẵn sàng được tạm giữ để tra soát; khoản mượn không tự đóng.';
    if (selectedImages.value.length) {
      selectedImagesIncidentId.value = created.id;
      try {
        await incidentsApi.uploadIncidentAttachments(created.id, selectedImages.value);
        clearSelectedImages();
      } catch (cause) {
        errorMessage.value = attachmentError(cause);
        successMessage.value += ' Ảnh chưa tải lên; có thể thử lại trong chi tiết hồ sơ.';
      }
    }
    await load();
  } catch (cause) {
    errorMessage.value = cause instanceof ApiError ? cause.message : 'Không ghi nhận được hồ sơ. Hãy kiểm tra thông tin rồi thử lại.';
  } finally {
    pending.value = false;
  }
}

function attachmentError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.code === 'INVALID_INCIDENT_IMAGE' || cause.code === 'INVALID_INCIDENT_IMAGE_CONTENT') return cause.message;
    if (cause.code === 'ATTACHMENT_LIMIT') return cause.message;
    if (cause.status === 401) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi thử tải ảnh.';
    if (cause.status === 403) return 'Tài khoản không có quyền tải ảnh sự cố.';
    return cause.message;
  }
  return 'Không tải được ảnh. Kiểm tra kết nối rồi thử lại.';
}

function onImageSelection(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (files.length > 3 || files.some((file) => file.size > 5 * 1024 * 1024)) {
    errorMessage.value = 'Mỗi lần chọn tối đa 3 ảnh; từng ảnh không quá 5 MB.';
    return;
  }
  errorMessage.value = '';
  releaseImagePreviews();
  selectedImages.value = files;
  imagePreviews.value = files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
}

function releaseImagePreviews(): void {
  for (const preview of imagePreviews.value) URL.revokeObjectURL(preview.url);
  imagePreviews.value = [];
}

function clearSelectedImages(): void {
  releaseImagePreviews();
  selectedImages.value = [];
  selectedImagesIncidentId.value = null;
  const input = document.querySelector<HTMLInputElement>('#incident-images');
  if (input) input.value = '';
}

async function uploadSelectedImages(): Promise<void> {
  if (!selected.value || selected.value.status === 'resolved' || !selectedImages.value.length || pending.value) return;
  if (selectedImagesIncidentId.value && selectedImagesIncidentId.value !== selected.value.id) {
    errorMessage.value = 'Ảnh đang chờ tải thuộc hồ sơ khác. Hãy mở đúng hồ sơ để tải lại.';
    return;
  }
  selectedImagesIncidentId.value = selected.value.id;
  pending.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await incidentsApi.uploadIncidentAttachments(selected.value.id, selectedImages.value);
    clearSelectedImages();
    successMessage.value = 'Đã tải ảnh bằng chứng lên hồ sơ.';
    await load();
  } catch (cause) {
    errorMessage.value = attachmentError(cause);
  } finally {
    pending.value = false;
  }
}

async function onAddInfo(): Promise<void> {
  if (!selected.value) return;
  await runAction(() => incidentsApi.addIncidentInfo(selected.value!.id, { evidence: infoText.value.trim() }), 'Đã bổ sung thông tin và chuyển hồ sơ sang chờ quyết định.');
  if (!errorMessage.value) infoText.value = '';
}

async function onRequestInfo(): Promise<void> {
  if (!selected.value) return;
  await runAction(() => incidentsApi.requestIncidentInfo(selected.value!.id, { requestInfo: requestText.value.trim() }), 'Đã yêu cầu bổ sung thông tin.');
  if (!errorMessage.value) requestText.value = '';
}

async function onDecide(): Promise<void> {
  if (!selected.value) return;
  await runAction(() => incidentsApi.decideIncident(selected.value!.id, {
    decision: decisionForm.decision,
    reason: decisionForm.reason.trim(),
  }), 'Đã ghi quyết định xử lý.');
  if (!errorMessage.value) decisionForm.reason = '';
}

function setStatus(value: string): void {
  void router.replace({ query: { ...route.query, status: value || undefined, page: undefined } });
}

function setPage(value: number): void {
  void router.replace({ query: { ...route.query, page: value > 1 ? String(value) : undefined } });
}

watch(() => [route.query.status, route.query.page], () => { void load(); });
onMounted(() => { void load(); });
onBeforeUnmount(releaseImagePreviews);
</script>

<template>
  <section class="incidents">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Kho tài liệu</span>
        <h1>Hồ sơ sự cố</h1>
        <p>Ghi nhận, tra soát và xử lý báo mất hoặc hư hỏng tài liệu.</p>
      </div>
    </div>

    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
    <p v-if="successMessage" role="status">{{ successMessage }}</p>

    <fieldset v-if="canReport">
      <legend>Ghi nhận sự cố</legend>
      <form class="incident-form" @submit.prevent="onCreate">
        <label>Mã cuốn cần tìm
          <input v-model="copySearch" type="search" maxlength="100" placeholder="Nhập mã cuốn hoặc một phần mã" @keydown.enter.prevent="onSearchCopies" />
        </label>
        <button type="button" :disabled="searchingCopies || !copySearch.trim()" @click="onSearchCopies">Tìm mã cuốn</button>
        <label>Bản sao
          <select v-model="createForm.copyId" required>
            <option value="">Chọn mã cuốn</option>
            <option v-for="copy in copies" :key="copy.id" :value="copy.id">{{ copy.code }} · {{ copy.workTitle }}</option>
          </select>
        </label>
        <label>Loại sự cố
          <select v-model="createForm.kind">
            <option v-for="kind in INCIDENT_KINDS" :key="kind" :value="kind">{{ kindLabels[kind] }}</option>
          </select>
        </label>
        <label class="incident-form__wide">Mô tả
          <textarea v-model="createForm.description" required minlength="10" maxlength="2000" rows="3" />
        </label>
        <label class="incident-form__wide">Thông tin, bằng chứng ban đầu
          <textarea v-model="createForm.evidence" maxlength="4000" rows="2" />
        </label>
        <label class="incident-form__wide">Ảnh bằng chứng (tối đa 3 ảnh, mỗi ảnh 5 MB)
          <input id="incident-images" type="file" accept="image/jpeg,image/png,image/webp" multiple @change="onImageSelection" :disabled="Boolean(selectedImagesIncidentId)" />
          <small>Ảnh JPEG, PNG hoặc WebP. Ảnh được chuẩn hóa và lưu riêng trong kho tệp của thư viện.</small>
        </label>
        <div v-if="imagePreviews.length" class="incident-images incident-form__wide" aria-label="Ảnh đã chọn">
          <figure v-for="preview in imagePreviews" :key="preview.url"><img :src="preview.url" :alt="preview.name" /><figcaption>{{ preview.name }}</figcaption></figure>
        </div>
        <p v-if="selectedImagesIncidentId" class="incident-form__wide" role="status">Ảnh chưa tải xong cho hồ sơ đã tạo. Mở hồ sơ đó và thử tải lại trước khi tạo hồ sơ mới.</p>
        <button type="submit" :disabled="pending || copies.length === 0 || Boolean(selectedImagesIncidentId)">Tạo hồ sơ</button>
      </form>
      <p v-if="copies.length === 0" class="empty-state">Tìm theo mã cuốn để chọn bản sao cần ghi nhận.</p>
    </fieldset>

    <div class="incident-list-head">
      <h2>Danh sách hồ sơ</h2>
      <label>Trạng thái
        <select :value="statusFilter" @change="setStatus(($event.target as HTMLSelectElement).value)">
          <option value="">Tất cả</option>
          <option v-for="status in INCIDENT_STATUSES" :key="status" :value="status">{{ statusLabels[status] }}</option>
        </select>
      </label>
    </div>
    <p v-if="loading" role="status">Đang tải hồ sơ…</p>
    <p v-else-if="incidents.length === 0" class="empty-state">Chưa có hồ sơ sự cố trong bộ lọc này.</p>
    <div v-else class="table-scroll">
      <table>
        <thead><tr><th scope="col">Mã cuốn</th><th scope="col">Tài liệu</th><th scope="col">Loại</th><th scope="col">Trạng thái</th><th scope="col">Ngày ghi nhận</th><th scope="col">Thao tác</th></tr></thead>
        <tbody>
          <tr v-for="incident in incidents" :key="incident.id">
            <td>{{ incident.copyCode }}</td>
            <td>{{ incident.workTitle }}</td>
            <td>{{ kindLabels[incident.kind] }}</td>
            <td><span class="status-badge" :data-state="incident.status">{{ statusLabels[incident.status] }}</span></td>
            <td>{{ new Date(incident.createdAt).toLocaleDateString('vi-VN') }}</td>
              <td><button type="button" @click="openIncident(incident.id)">Chi tiết</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="total > 20" class="pagination">
      <button type="button" :disabled="page <= 1 || loading" @click="setPage(page - 1)">Trang trước</button>
      <span>Trang {{ page }} / {{ pageCount }}</span>
      <button type="button" :disabled="page >= pageCount || loading" @click="setPage(page + 1)">Trang sau</button>
    </div>

      <dialog v-if="selected" ref="detailDialog" class="incident-detail" aria-label="Chi tiết hồ sơ sự cố" @close="selectedId = null">
        <button type="button" class="incident-detail__close" @click="detailDialog?.close()">Đóng</button>
      <h2>{{ selected.copyCode }} · {{ selected.workTitle }}</h2>
      <p><strong>Người ghi nhận:</strong> {{ selected.reportedByName }}</p>
      <p><strong>Mô tả:</strong> {{ selected.description }}</p>
      <p v-if="selected.evidence"><strong>Thông tin đã ghi:</strong> {{ selected.evidence }}</p>
      <p v-if="selected.requestInfo"><strong>Cần bổ sung:</strong> {{ selected.requestInfo }}</p>
      <p v-if="selected.decision"><strong>Quyết định:</strong> {{ decisionLabels[selected.decision] }} · {{ selected.decisionReason }}</p>
      <p v-if="selected.decidedByName"><strong>Người quyết định:</strong> {{ selected.decidedByName }}</p>

      <section class="incident-attachments" aria-label="Ảnh bằng chứng">
        <h3>Ảnh bằng chứng · {{ selected.attachments.length }}/6</h3>
        <div v-if="selected.attachments.length" class="incident-images">
          <figure v-for="attachment in selected.attachments" :key="attachment.id">
            <a :href="incidentsApi.incidentAttachmentUrl(selected.id, attachment.id)" target="_blank" rel="noopener noreferrer">
              <img :src="incidentsApi.incidentAttachmentUrl(selected.id, attachment.id)" :alt="attachment.originalName" loading="lazy" />
            </a>
            <figcaption>{{ attachment.originalName }} · {{ Math.ceil(attachment.sizeBytes / 1024) }} KB</figcaption>
          </figure>
        </div>
        <p v-else class="empty-state">Chưa có ảnh đính kèm.</p>
        <form v-if="canReport && selected.status !== 'resolved' && selected.attachments.length < 6" class="incident-detail__form" @submit.prevent="uploadSelectedImages">
          <label>Thêm ảnh (tối đa {{ Math.min(3, 6 - selected.attachments.length) }} ảnh mỗi lần)
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple @change="onImageSelection" />
          </label>
          <button type="submit" :disabled="pending || !selectedImages.length">{{ pending ? 'Đang tải ảnh…' : 'Tải ảnh lên' }}</button>
        </form>
      </section>

      <button v-if="canReport && selected.status === 'new'" type="button" :disabled="pending" @click="runAction(() => incidentsApi.submitIncident(selected!.id), 'Đã gửi hồ sơ để xem xét.')">Gửi xem xét</button>
      <form v-if="canReport && selected.status === 'need_info'" class="incident-detail__form" @submit.prevent="onAddInfo">
        <label>Bổ sung thông tin
          <textarea v-model="infoText" required maxlength="4000" rows="3" />
        </label>
        <button type="submit" :disabled="pending">Gửi bổ sung</button>
      </form>
      <template v-if="canDecide && selected.status === 'under_review'">
        <form class="incident-detail__form" @submit.prevent="onRequestInfo">
          <label>Yêu cầu bổ sung
            <textarea v-model="requestText" required minlength="10" maxlength="1000" rows="2" />
          </label>
          <button type="submit" :disabled="pending">Yêu cầu thông tin</button>
        </form>
        <form class="incident-detail__form" @submit.prevent="onDecide">
          <label>Quyết định
            <select v-model="decisionForm.decision">
              <option v-for="decision in INCIDENT_DECISIONS" :key="decision" :value="decision">{{ decisionLabels[decision] }}</option>
            </select>
          </label>
          <p class="incident-detail__impact">{{ decisionImpact }}</p>
          <label>Lý do
            <textarea v-model="decisionForm.reason" required minlength="10" maxlength="2000" rows="2" />
          </label>
          <button type="submit" :disabled="pending">Ghi quyết định</button>
        </form>
      </template>
    </dialog>
  </section>
</template>

<style scoped>
.incident-detail { width: min(760px, calc(100% - 28px)); max-height: min(88vh, 900px); overflow: auto; padding: 24px; border: 1px solid var(--line); border-radius: 14px; color: var(--ink); }
.incident-detail::backdrop { background: rgb(12 24 40 / 52%); }
.incident-detail__close { float: right; }
.incident-detail__impact { padding: 11px 13px; color: #344a64; background: #f1f5fb; border-radius: 8px; }
</style>
