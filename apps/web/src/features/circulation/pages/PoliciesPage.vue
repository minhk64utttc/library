<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { PolicyDto, PolicyScopeQuery, PolicyVersionCreate } from '@thu-vien/shared';
import { getPolicy, listPolicyVersions, updatePolicy } from '../api';

const current = ref<PolicyDto | null>(null);
const versions = ref<PolicyDto[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const notice = ref('');
const scope = reactive({ readerGroup: '' as '' | NonNullable<PolicyScopeQuery['readerGroup']>, materialType: '', branchCode: '' });
const dayOptions = [
  { value: 1, label: 'Thứ 2' }, { value: 2, label: 'Thứ 3' }, { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' }, { value: 5, label: 'Thứ 6' }, { value: 6, label: 'Thứ 7' }, { value: 0, label: 'Chủ nhật' },
];
const form = reactive({
  effectiveOn: '', loanDays: 30, renewLimit: 1, renewDays: 7,
  maxActiveLoans: 5, overdueFinePerDay: 5000, holdDays: 3,
  serviceOpenDays: [1, 2, 3, 4, 5] as number[], serviceOpensAt: '08:00', serviceClosesAt: '17:00',
});
const scopeQuery = computed<PolicyScopeQuery>(() => ({
  ...(scope.readerGroup ? { readerGroup: scope.readerGroup } : {}),
  ...(scope.materialType.trim() ? { materialType: scope.materialType.trim() } : {}),
  ...(scope.branchCode.trim() ? { branchCode: scope.branchCode.trim() } : {}),
}));
const scopeDescription = computed(() => [
  scope.readerGroup || 'mọi nhóm bạn đọc', scope.materialType.trim() || 'mọi loại tài liệu', scope.branchCode.trim() || 'mọi cơ sở',
].join(' · '));
const policyPreview = computed(() => current.value ? [
  `Thời hạn mượn: ${current.value.loanDays} → ${form.loanDays} ngày`,
  `Giới hạn mượn: ${current.value.maxActiveLoans} → ${form.maxActiveLoans} cuốn`,
  `Thời gian giữ: ${current.value.holdDays} → ${form.holdDays} ngày phục vụ`,
].join(' | ') : 'Chính sách mới áp dụng cho giao dịch phát sinh sau ngày hiệu lực.');

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(new Date(value));
}

function useCurrentValues(policy: PolicyDto): void {
  form.loanDays = policy.loanDays;
  form.renewLimit = policy.renewLimit;
  form.renewDays = policy.renewDays;
  form.maxActiveLoans = policy.maxActiveLoans;
  form.overdueFinePerDay = policy.overdueFinePerDay;
  form.holdDays = policy.holdDays;
  form.serviceOpenDays = [...policy.serviceOpenDays];
  form.serviceOpensAt = policy.serviceOpensAt;
  form.serviceClosesAt = policy.serviceClosesAt;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const [active, history] = await Promise.all([getPolicy(scopeQuery.value), listPolicyVersions(scopeQuery.value)]);
    current.value = active;
    versions.value = history;
    useCurrentValues(active);
    const tomorrow = new Date(Date.now() + 7 * 60 * 60 * 1000 + 86_400_000);
    form.effectiveOn = tomorrow.toISOString().slice(0, 10);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không tải được chính sách.';
  } finally {
    loading.value = false;
  }
}

function toggleServiceDay(day: number): void {
  form.serviceOpenDays = form.serviceOpenDays.includes(day)
    ? form.serviceOpenDays.filter((value) => value !== day)
    : [...form.serviceOpenDays, day];
}

async function save(): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  notice.value = '';
  try {
    if (!window.confirm(`Xác nhận tạo chính sách cho ${scopeDescription.value}? ${policyPreview.value}`)) return;
    const input: PolicyVersionCreate = {
      ...form, ...scopeQuery.value,
      readerGroup: scopeQuery.value.readerGroup ?? null,
      materialType: scopeQuery.value.materialType ?? null,
      branchCode: scopeQuery.value.branchCode ?? null,
    };
    await updatePolicy(input);
    notice.value = 'Đã tạo phiên bản chính sách. Phiên bản sẽ có hiệu lực vào ngày đã chọn.';
    await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không lưu được phiên bản chính sách.';
  } finally {
    saving.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <section class="policies" aria-labelledby="policies-title">
    <header class="policies__heading">
      <p class="eyebrow">Quản trị thư viện</p>
      <h1 id="policies-title">Chính sách lưu thông</h1>
      <p>Tạo quy định có ngày hiệu lực; các khoản mượn đã phát sinh giữ nguyên điều kiện tại thời điểm mượn.</p>
    </header>

    <p v-if="error" class="policies__message policies__message--error" role="alert">{{ error }}</p>
    <p v-if="notice" class="policies__message" role="status">{{ notice }}</p>
    <p v-if="loading" class="policies__loading" role="status">Đang tải chính sách…</p>

    <template v-else>
      <section class="policies__panel policies__scope">
        <h2>Phạm vi áp dụng</h2>
        <p class="policies__hint">Để trống tiêu chí nào thì chính sách áp dụng cho mọi giá trị của tiêu chí đó.</p>
        <div class="policies__scope-fields">
          <label>Nhóm bạn đọc
            <select v-model="scope.readerGroup">
              <option value="">Mọi nhóm</option><option value="student">Sinh viên</option><option value="lecturer">Giảng viên</option><option value="staff">Nhân viên</option><option value="other">Khác</option>
            </select>
          </label>
          <label>Loại tài liệu / phân loại<input v-model="scope.materialType" maxlength="100" placeholder="Ví dụ: giáo trình" /></label>
          <label>Cơ sở / mã địa điểm<input v-model="scope.branchCode" maxlength="100" placeholder="Để trống cho mọi cơ sở" /></label>
          <button type="button" :disabled="loading" @click="load">Xem phạm vi</button>
        </div>
        <p class="policies__scope-preview">Đang xem: <strong>{{ scopeDescription }}</strong></p>
      </section>
      <section class="policies__current" aria-label="Chính sách hiện hành">
        <div><span>Đang áp dụng</span><strong>Phiên bản {{ current?.versionNumber }}</strong></div>
        <div><span>Hiệu lực từ</span><strong>{{ current ? formatDate(current.effectiveFrom) : '—' }}</strong></div>
        <div><span>Thời hạn mượn</span><strong>{{ current?.loanDays }} ngày</strong></div>
        <div><span>Số lượt gia hạn</span><strong>{{ current?.renewLimit }} lượt</strong></div>
      </section>

      <section class="policies__panel">
        <h2>Lên lịch phiên bản tiếp theo</h2>
        <p class="policies__hint">Để trống mục không đổi; ngày hiệu lực phải là ngày trong tương lai.</p>
        <form class="policies__form" @submit.prevent="save">
          <label>Ngày hiệu lực<input v-model="form.effectiveOn" type="date" required /></label>
          <label>Ngày mượn tối đa<input v-model.number="form.loanDays" type="number" min="1" max="365" required /></label>
          <label>Số lượt gia hạn<input v-model.number="form.renewLimit" type="number" min="0" max="10" required /></label>
          <label>Số ngày mỗi lần gia hạn<input v-model.number="form.renewDays" type="number" min="1" max="90" required /></label>
          <label>Số sách mượn tối đa<input v-model.number="form.maxActiveLoans" type="number" min="1" max="100" required /></label>
          <label>Phạt mỗi ngày quá hạn (₫)<input v-model.number="form.overdueFinePerDay" type="number" min="0" max="1000000" required /></label>
          <label>Ngày giữ sách đặt trước<input v-model.number="form.holdDays" type="number" min="1" max="30" required /></label>
          <label>Giờ mở cửa<input v-model="form.serviceOpensAt" type="time" required /></label>
          <label>Giờ đóng cửa<input v-model="form.serviceClosesAt" type="time" required /></label>
          <fieldset class="policies__days"><legend>Ngày phục vụ</legend>
            <label v-for="day in dayOptions" :key="day.value"><input type="checkbox" :checked="form.serviceOpenDays.includes(day.value)" @change="toggleServiceDay(day.value)" />{{ day.label }}</label>
          </fieldset>
          <p class="policies__scope-preview">Xem trước: {{ policyPreview }}</p>
          <div class="policies__actions"><button type="submit" :disabled="saving">{{ saving ? 'Đang lưu…' : 'Tạo phiên bản' }}</button></div>
        </form>
      </section>

      <section class="policies__panel">
        <h2>Lịch sử phiên bản</h2>
        <div class="policies__table-wrap">
          <table>
            <thead><tr><th>Phiên bản</th><th>Hiệu lực</th><th>Mượn</th><th>Gia hạn</th><th>Giới hạn mượn</th><th>Phạt/ngày</th><th>Ngày giữ</th><th>Người tạo</th></tr></thead>
            <tbody>
              <tr v-for="version in versions" :key="version.id">
                <td>v{{ version.versionNumber }} · {{ version.scopeKey }}<span v-if="version.id === current?.id" class="policies__badge">Hiện hành</span></td>
                <td>{{ formatDate(version.effectiveFrom) }}</td><td>{{ version.loanDays }} ngày</td>
                <td>{{ version.renewLimit }} × {{ version.renewDays }} ngày</td><td>{{ version.maxActiveLoans }}</td>
                <td>{{ version.overdueFinePerDay.toLocaleString('vi-VN') }} ₫</td><td>{{ version.holdDays }} ngày</td><td>{{ version.createdByName || 'Hệ thống' }}</td>
              </tr>
              <tr v-if="versions.length === 0"><td colspan="8">Chưa có dữ liệu phiên bản.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.policies { --section-accent: var(--navy); max-width: 1180px; margin: 0 auto; }
.policies__heading { margin-bottom: 22px; }
.policies__heading h1 { margin: 6px 0; color: var(--ink, #20324b); font-size: clamp(1.5rem, 2.5vw, 2rem); }
.policies__heading > p:last-child, .policies__hint { color: var(--muted, #68778b); }
.policies__current { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
.policies__scope-fields { display: grid; grid-template-columns: repeat(3, minmax(150px, 1fr)) auto; align-items: end; gap: 12px; }
.policies__scope-fields label { display: grid; gap: 6px; font-size: .85rem; font-weight: 600; }
.policies__scope-fields input, .policies__scope-fields select { min-height: 40px; padding: 8px 10px; border: 1px solid var(--line, #dce3eb); border-radius: 7px; font: inherit; }
.policies__scope-fields button { min-height: 40px; padding: 0 14px; color: white; background: var(--navy, #19365b); border: 0; border-radius: 7px; font: inherit; cursor: pointer; }
.policies__scope-preview { color: var(--muted, #68778b); font-size: .84rem; }
.policies__current > div, .policies__panel { padding: 18px; background: white; border: 1px solid var(--line, #dce3eb); border-radius: 12px; }
.policies__current span, .policies__current strong { display: block; }
.policies__current span { color: var(--muted, #68778b); font-size: .8rem; }
.policies__current strong { margin-top: 7px; color: var(--ink, #20324b); }
.policies__panel { margin-bottom: 18px; }
.policies__panel h2 { margin: 0 0 6px; font-size: 1.1rem; }
.policies__form { display: grid; grid-template-columns: repeat(3, minmax(150px, 1fr)); gap: 14px; margin-top: 16px; }
.policies__form label { display: grid; gap: 6px; font-size: .85rem; font-weight: 600; }
.policies__days { display: flex; flex-wrap: wrap; gap: 8px 14px; min-width: 0; padding: 10px; border: 1px solid var(--line, #dce3eb); border-radius: 7px; }
.policies__days legend { padding: 0 5px; font-size: .84rem; font-weight: 650; }
.policies__days label { display: flex; align-items: center; gap: 6px; font-size: .8rem; font-weight: 500; }
.policies__form input { min-height: 40px; padding: 8px 10px; color: inherit; border: 1px solid var(--line, #dce3eb); border-radius: 7px; }
.policies__actions { display: flex; align-items: end; }
.policies__actions button { min-height: 40px; padding: 0 16px; color: white; background: var(--navy, #19365b); border: 0; border-radius: 7px; font: inherit; font-weight: 650; cursor: pointer; }
.policies__actions button:disabled { opacity: .6; cursor: wait; }
.policies__table-wrap { overflow-x: auto; }
.policies table { width: 100%; border-collapse: collapse; font-size: .83rem; white-space: nowrap; }
.policies th, .policies td { padding: 11px 9px; text-align: left; border-bottom: 1px solid var(--line, #dce3eb); }
.policies th { color: var(--muted, #68778b); font-weight: 650; }
.policies__badge { display: inline-block; margin-left: 7px; padding: 3px 7px; color: #23614b; background: #e7f4ed; border-radius: 99px; font-size: .7rem; }
.policies__message { padding: 11px 14px; color: #245a45; background: #e9f5ee; border-radius: 8px; }
.policies__message--error { color: #8a3333; background: #fff0ef; }
.policies__loading { color: var(--muted, #68778b); }
@media (max-width: 900px) { .policies__scope-fields { grid-template-columns: 1fr 1fr; } }
@media (max-width: 760px) { .policies__current { grid-template-columns: repeat(2, 1fr); } .policies__form { grid-template-columns: 1fr 1fr; } }
@media (max-width: 480px) { .policies__form, .policies__scope-fields { grid-template-columns: 1fr; } }
</style>
