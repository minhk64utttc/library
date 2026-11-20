<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
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
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 20)));

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
  await runAction(
    () => incidentsApi.createIncident({
      copyId: createForm.copyId,
      kind: createForm.kind,
      description: createForm.description.trim(),
      ...(createForm.evidence.trim() ? { evidence: createForm.evidence.trim() } : {}),
    }),
    'Đã ghi nhận hồ sơ. Bản sao sẵn sàng được tạm giữ để tra soát; khoản mượn không tự đóng.',
  );
  if (!errorMessage.value) {
    createForm.copyId = '';
    createForm.description = '';
    createForm.evidence = '';
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
        <button type="submit" :disabled="pending || copies.length === 0">Tạo hồ sơ</button>
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
            <td><button type="button" :aria-expanded="selectedId === incident.id" @click="selectedId = selectedId === incident.id ? null : incident.id">Chi tiết</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="total > 20" class="pagination">
      <button type="button" :disabled="page <= 1 || loading" @click="setPage(page - 1)">Trang trước</button>
      <span>Trang {{ page }} / {{ pageCount }}</span>
      <button type="button" :disabled="page >= pageCount || loading" @click="setPage(page + 1)">Trang sau</button>
    </div>

    <section v-if="selected" class="incident-detail" aria-label="Chi tiết hồ sơ sự cố">
      <h2>{{ selected.copyCode }} · {{ selected.workTitle }}</h2>
      <p><strong>Người ghi nhận:</strong> {{ selected.reportedByName }}</p>
      <p><strong>Mô tả:</strong> {{ selected.description }}</p>
      <p v-if="selected.evidence"><strong>Thông tin đã ghi:</strong> {{ selected.evidence }}</p>
      <p v-if="selected.requestInfo"><strong>Cần bổ sung:</strong> {{ selected.requestInfo }}</p>
      <p v-if="selected.decision"><strong>Quyết định:</strong> {{ decisionLabels[selected.decision] }} · {{ selected.decisionReason }}</p>
      <p v-if="selected.decidedByName"><strong>Người quyết định:</strong> {{ selected.decidedByName }}</p>

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
          <label>Lý do
            <textarea v-model="decisionForm.reason" required minlength="10" maxlength="2000" rows="2" />
          </label>
          <button type="submit" :disabled="pending">Ghi quyết định</button>
        </form>
      </template>
    </section>
  </section>
</template>
