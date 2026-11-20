<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { onBeforeRouteLeave, RouterLink, useRoute } from 'vue-router';
import type { MyProfileDto, MyCardActivityDto, Role } from '@thu-vien/shared';
import { ApiError, apiFetch } from '@/shared/api/client';
import { loadMyProfile, removeMyProfilePhoto, saveMyProfile, uploadMyProfilePhoto } from '../api';

const profile = ref<MyProfileDto | null>(null);
const route = useRoute();
const form = reactive({ fullName: '', phone: '', contactEmail: '', reminderEmailEnabled: true });
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const notice = ref('');
const photoBusy = ref(false);
const photoError = ref('');
const photoNotice = ref('');
const cardActivity = ref<MyCardActivityDto | null>(null);
const cardError = ref('');
async function loadCardActivity(): Promise<void> {
  cardError.value = '';
  try { cardActivity.value = await apiFetch<MyCardActivityDto>('/me/card/activity'); }
  catch { cardError.value = 'Không tải được lịch sử thẻ.'; }
}
const cardActions: Record<string, string> = { issued: 'Cấp thẻ', renewed: 'Gia hạn thẻ', locked: 'Khóa thẻ', active: 'Mở khóa thẻ' };
const photoDialog = ref<HTMLDialogElement | null>(null);
const activeTab = ref('contact');
const tabs = computed(() => [{ id: 'contact', label: 'Thông tin cá nhân' }, ...(profile.value?.libraryCard || profile.value?.roles.includes('reader') ? [{ id: 'card', label: 'Thẻ thư viện' }] : []), { id: 'security', label: 'Bảo mật' }, { id: 'notifications', label: 'Thông báo' }]);
const savedForm = ref('');
const dirty = computed(() => Boolean(profile.value) && JSON.stringify(form) !== savedForm.value);
const isStaff = computed(() => route.meta.workspace === true);
const securityPath = computed(() => isStaff.value ? '/account/security' : '/me/security');
const leaveDialog = ref<HTMLDialogElement | null>(null);
let resolveLeave: ((allow: boolean) => void) | undefined;
function decideLeave(allow: boolean): void { leaveDialog.value?.close(); resolveLeave?.(allow); resolveLeave = undefined; }
onBeforeRouteLeave(() => {
  if (!dirty.value) return true;
  return new Promise<boolean>(resolve => { resolveLeave = resolve; leaveDialog.value?.showModal(); });
});
function beforeUnload(event: BeforeUnloadEvent): void { if (dirty.value) { event.preventDefault(); event.returnValue = ''; } }
function resetForm(): void {
  if (!profile.value) return;
  Object.assign(form, { fullName: profile.value.fullName, phone: profile.value.phone ?? '', contactEmail: profile.value.contactEmail ?? '', reminderEmailEnabled: profile.value.reminderEmailEnabled });
  savedForm.value = JSON.stringify(form);
}

const roleLabels: Record<Role, string> = {
  reader: 'Bạn đọc', circulation: 'Cán bộ mượn trả', cataloging: 'Cán bộ biên mục',
  inventory: 'Cán bộ kiểm kê', digital: 'Cán bộ tài liệu số', manager: 'Quản lý thư viện', admin: 'Quản trị hệ thống',
};

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    profile.value = await loadMyProfile();
    form.fullName = profile.value.fullName;
    form.phone = profile.value.phone ?? '';
    form.contactEmail = profile.value.contactEmail ?? '';
    form.reminderEmailEnabled = profile.value.reminderEmailEnabled;
    savedForm.value = JSON.stringify(form);
  } catch {
    error.value = 'Không tải được hồ sơ. Hãy tải lại trang để thử lại.';
  } finally {
    loading.value = false;
  }
}

async function submit(): Promise<void> {
  if (saving.value) return;
  if (!form.fullName.trim()) { activeTab.value = 'contact'; error.value = 'Vui lòng nhập họ và tên trước khi lưu.'; return; }
  saving.value = true;
  error.value = '';
  notice.value = '';
  try {
    profile.value = await saveMyProfile({
      fullName: form.fullName,
      phone: form.phone,
      contactEmail: form.contactEmail,
      reminderEmailEnabled: form.reminderEmailEnabled,
    });
    resetForm();
    notice.value = 'Thông tin liên hệ đã được lưu.';
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.status === 400
      ? 'Tên, số điện thoại hoặc email liên hệ chưa đúng định dạng.'
      : 'Không lưu được hồ sơ. Thông tin của bạn vẫn được giữ trên biểu mẫu để thử lại.';
  } finally {
    saving.value = false;
  }
}

async function changePhoto(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || photoBusy.value) return;
  photoError.value = '';
  photoNotice.value = '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    photoError.value = 'Chọn ảnh JPEG, PNG hoặc WebP.';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    photoError.value = 'Ảnh phải nhỏ hơn 5 MB.';
    return;
  }
  photoBusy.value = true;
  try {
    profile.value = await uploadMyProfilePhoto(file);
    photoNotice.value = 'Ảnh hồ sơ đã được cập nhật.';
  } catch (cause) {
    photoError.value = cause instanceof ApiError && cause.status === 400
      ? cause.message
      : 'Không lưu được ảnh. Ảnh hiện tại vẫn được giữ nguyên.';
  } finally {
    photoBusy.value = false;
  }
}

async function removePhoto(): Promise<void> {
  if (photoBusy.value || !profile.value?.photoUrl) return;
  photoDialog.value?.close();
  photoBusy.value = true;
  photoError.value = '';
  photoNotice.value = '';
  try {
    profile.value = await removeMyProfilePhoto();
    photoNotice.value = 'Đã xóa ảnh hồ sơ.';
  } catch {
    photoError.value = 'Không xóa được ảnh hồ sơ. Vui lòng thử lại.';
  } finally {
    photoBusy.value = false;
  }
}

onMounted(() => { void load(); void loadCardActivity(); window.addEventListener('beforeunload', beforeUnload); });
onBeforeUnmount(() => { window.removeEventListener('beforeunload', beforeUnload); resolveLeave?.(false); });
</script>

<template>
  <section class="reader-profile" aria-labelledby="profile-title">
    <div class="reader-profile__heading">
      <p class="eyebrow">{{ isStaff ? 'Tài khoản nhân viên' : 'Tài khoản của tôi' }}</p>
      <h1 id="profile-title">Hồ sơ cá nhân</h1>
      <p>Cập nhật thông tin để thư viện liên hệ khi cần.</p>
    </div>

    <div v-if="loading" class="empty-state" role="status">Đang tải hồ sơ…</div>
    <p v-else-if="error && !profile" role="alert">{{ error }}</p>
    <div v-else-if="profile" class="reader-profile__folio">
      <aside class="reader-profile__identity" aria-label="Thông tin tài khoản">
        <img v-if="profile.photoUrl" class="reader-profile__photo" :src="profile.photoUrl" alt="Ảnh hồ sơ bạn đọc" />
        <span v-else class="reader-profile__seal" aria-hidden="true">{{ form.fullName.trim().charAt(0).toLocaleUpperCase('vi-VN') || 'T' }}</span>
        <div class="reader-profile__photo-tools">
          <label class="reader-profile__photo-picker" :class="{ 'reader-profile__photo-picker--busy': photoBusy }">
            {{ photoBusy ? 'Đang xử lý ảnh…' : profile.photoUrl ? 'Đổi ảnh hồ sơ' : 'Thêm ảnh hồ sơ' }}
            <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="photoBusy" @change="changePhoto" />
          </label>
          <button v-if="profile.photoUrl" class="reader-profile__photo-remove" type="button" :disabled="photoBusy" @click="photoDialog?.showModal()">Xóa ảnh</button>
          <small>JPEG, PNG hoặc WebP · tối đa 5 MB</small>
          <p v-if="photoError" class="reader-profile__photo-error" role="alert">{{ photoError }}</p>
          <p v-if="photoNotice" class="reader-profile__photo-success" role="status">{{ photoNotice }}</p>
        </div>
        <span class="reader-profile__overline">{{ isStaff ? 'Hồ sơ nhân viên' : 'Hồ sơ bạn đọc' }}</span>
        <h2>{{ form.fullName || 'Chưa cập nhật họ tên' }}</h2>
        <p class="reader-profile__login-email">{{ profile.email }}</p>
        <div class="reader-profile__rule"></div>
        <span class="reader-profile__overline">Quyền tài khoản</span>
        <ul class="reader-profile__roles">
          <li v-for="role in profile.roles" :key="role">{{ roleLabels[role] }}</li>
        </ul>
        <div v-if="profile.libraryCard" class="reader-profile__card">
          <span class="reader-profile__overline">Thẻ thư viện</span>
          <strong>{{ profile.libraryCard.cardNumber }}</strong>
          <span>{{ profile.libraryCard.status === 'active' ? 'Đang hiệu lực' : profile.libraryCard.status === 'locked' ? 'Đang khóa' : 'Đã hết hạn' }}</span>
          <span>Hết hạn {{ new Date(`${profile.libraryCard.expiresOn}T12:00:00`).toLocaleDateString('vi-VN') }}</span>
        </div>
        <p class="reader-profile__footnote">Email đăng nhập và quyền truy cập do thư viện quản lý.</p>
      </aside>

      <div class="reader-profile__form-wrap">
        <nav class="profile-tabs" aria-label="Các phần hồ sơ">
          <button v-for="tab in tabs" :key="tab.id" type="button" :aria-pressed="activeTab === tab.id" @click="activeTab = tab.id">{{ tab.label }}</button>
        </nav>
        <template v-if="activeTab === 'contact' || activeTab === 'notifications'">
        <div class="reader-profile__form-heading">
          <h2>{{ activeTab === 'contact' ? 'Thông tin liên hệ' : 'Tùy chọn thông báo' }}</h2>
          <p>Email liên hệ có thể khác email dùng để đăng nhập.</p>
        </div>
        <p v-if="notice" class="reader-profile__success" role="status">{{ notice }}</p>
        <p v-if="error" role="alert">{{ error }}</p>
        <form @submit.prevent="submit">
          <label v-show="activeTab === 'contact'">Họ và tên
            <input v-model="form.fullName" name="fullName" autocomplete="name" :disabled="activeTab !== 'contact'" required maxlength="200" />
          </label>
          <label>Email liên hệ
            <input v-model="form.contactEmail" name="contactEmail" type="email" autocomplete="email" maxlength="254" placeholder="Địa chỉ nhận thông tin từ thư viện" />
          </label>
          <label v-show="activeTab === 'contact'">Số điện thoại
            <input v-model="form.phone" name="phone" type="tel" autocomplete="tel" :disabled="activeTab !== 'contact'" maxlength="20" placeholder="Ví dụ: 09xx xxx xxx" />
          </label>
          <label v-show="activeTab === 'notifications'" class="reader-profile__email-preference"><input v-model="form.reminderEmailEnabled" name="reminderEmailEnabled" type="checkbox" /> Nhận email nhắc hạn mượn</label>
          <div class="profile-actions">
            <p role="status">{{ dirty ? 'Bạn có thay đổi chưa lưu.' : 'Thông tin đã được lưu.' }}</p>
            <button type="submit" :disabled="saving || !dirty">{{ saving ? 'Đang lưu…' : 'Lưu thay đổi' }}</button>
            <button type="button" :disabled="saving || !dirty" @click="resetForm">Hoàn tác</button>
          </div>
        </form>
        <p class="reader-profile__privacy">Thông tin này chỉ dùng cho việc quản lý tài khoản và liên hệ phục vụ thư viện.</p>
        </template>
        <section v-else-if="activeTab === 'card'" class="profile-panel">
          <h2>Thẻ thư viện</h2>
          <template v-if="profile.libraryCard">
            <strong class="profile-card-number">{{ profile.libraryCard.cardNumber }}</strong>
            <p>{{ profile.libraryCard.status === 'active' ? 'Đang hiệu lực' : profile.libraryCard.status === 'locked' ? 'Đang khóa' : 'Đã hết hạn' }}</p>
            <p>Hạn thẻ: {{ new Date(`${profile.libraryCard.expiresOn}T12:00:00`).toLocaleDateString('vi-VN') }}</p>
            <p v-if="cardActivity">Đang mượn: <strong>{{ cardActivity.activeLoanCount }}</strong> cuốn</p>
            <p>Để gia hạn thẻ, vui lòng liên hệ quầy thư viện.</p>
            <RouterLink to="/me/loans">Xem các khoản mượn của tôi →</RouterLink>
            <h3>Lịch sử thẻ gần đây</h3>
            <p v-if="cardError" role="alert">{{ cardError }} <button type="button" @click="loadCardActivity">Thử lại</button></p>
            <ol v-else-if="cardActivity?.events.length" class="card-history"><li v-for="event in cardActivity.events" :key="event.id"><strong>{{ cardActions[event.action] || event.action }}</strong> · {{ new Date(event.createdAt).toLocaleDateString('vi-VN') }}<p v-if="event.reason">{{ event.reason }}</p><small v-if="event.newExpiresOn">Hạn mới: {{ event.newExpiresOn }}</small></li></ol>
            <p v-else>Chưa có lịch sử thẻ.</p>
          </template>
          <p v-else class="empty-state">Bạn chưa có thẻ thư viện. Liên hệ quầy để được cấp thẻ.</p>
        </section>
        <section v-else class="profile-panel">
          <h2>Bảo mật tài khoản</h2>
          <p>Email đăng nhập: <strong>{{ profile.email }}</strong></p>
          <p>Liên hệ thư viện nếu cần thay đổi email đăng nhập.</p>
          <RouterLink class="profile-security-link" :to="securityPath">Đổi mật khẩu →</RouterLink>
          <p>Đổi mật khẩu sẽ thu hồi các phiên đăng nhập khác của tài khoản.</p>
        </section>
      </div>
    </div>
    <dialog ref="leaveDialog" aria-labelledby="leave-title" @cancel.prevent="decideLeave(false)">
      <h2 id="leave-title">Rời trang khi chưa lưu?</h2>
      <p>Thông tin vừa sửa sẽ không được lưu.</p>
      <div class="profile-actions"><button autofocus type="button" @click="decideLeave(false)">Tiếp tục chỉnh sửa</button><button type="button" @click="decideLeave(true)">Bỏ thay đổi và rời trang</button></div>
    </dialog>
    <dialog ref="photoDialog" aria-labelledby="remove-photo-title">
      <h2 id="remove-photo-title">Xóa ảnh hồ sơ?</h2><p>Bạn có thể tải một ảnh mới sau khi xóa.</p>
      <div class="profile-actions"><button autofocus type="button" @click="photoDialog?.close()">Giữ ảnh</button><button type="button" @click="removePhoto">Xóa ảnh</button></div>
    </dialog>
  </section>
</template>

<style scoped>
.reader-profile__heading { margin-bottom: 24px; }
.profile-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid var(--line); }
.profile-tabs button { color: var(--navy); background: white; font-size: .78rem; padding: 9px 10px; }
.profile-tabs button[aria-pressed="true"] { background: var(--navy); color: white; }
.profile-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.profile-actions p { flex-basis: 100%; margin: 0; color: var(--muted); font-size: .8rem; }
.profile-panel { min-height: 240px; line-height: 1.7; }
.card-history { padding-left: 20px; font-size: .83rem; }
.card-history li { margin: 12px 0; }
.card-history p { margin: 2px 0; }
.profile-card-number { display: block; padding: 20px; background: var(--canvas); font-size: 1.5rem; letter-spacing: .08em; }
.profile-security-link { display: inline-block; padding: 12px 0; font-weight: 600; }
dialog { max-width: min(500px, calc(100% - 32px)); padding: 26px; border: 1px solid var(--line); border-radius: 14px; color: var(--ink); }
dialog::backdrop { background: #16284988; }
.reader-profile__heading h1 { margin: 7px 0 4px; }
.reader-profile__heading > p:last-child { margin: 0; color: var(--muted); }
.reader-profile__folio { display: grid; grid-template-columns: minmax(235px, .72fr) minmax(0, 1.5fr); overflow: hidden; border: 1px solid var(--line); border-radius: 14px; }
.reader-profile__identity { position: relative; padding: 32px 28px; color: var(--ink); background: #f5f8fd; }
.reader-profile__identity::after { position: absolute; top: 0; right: 0; width: 5px; height: 100%; background: var(--gold); content: ''; }
.reader-profile__seal, .reader-profile__photo { display: grid; place-items: center; width: 76px; height: 76px; margin-bottom: 13px; color: var(--navy-deep); background: #f6e9b9; border: 3px double #d4ae44; border-radius: 50%; font-size: 1.5rem; font-weight: 700; }
.reader-profile__photo { object-fit: cover; }
.reader-profile__photo-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 7px 10px; margin: 0 0 24px; }
.reader-profile__photo-picker { position: relative; display: inline-flex; min-height: 30px; align-items: center; padding: 5px 9px; overflow: hidden; color: var(--navy); border: 1px solid var(--line); border-radius: 6px; cursor: pointer; font-size: .7rem; font-weight: 600; }
.reader-profile__photo-picker:focus-within { outline: 2px solid #f2e7c1; outline-offset: 2px; }
.reader-profile__photo-picker input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.reader-profile__photo-picker--busy { opacity: .65; cursor: wait; }
.reader-profile__photo-remove { min-height: 30px; padding: 4px 8px; color: var(--navy); background: transparent; border-color: var(--line); font-size: .7rem; }
.reader-profile__photo-tools small { flex-basis: 100%; color: var(--muted); font-size: .67rem; }
.reader-profile__photo-error, .reader-profile__photo-success { flex-basis: 100%; margin: 2px 0 0; font-size: .72rem; line-height: 1.45; }
.reader-profile__photo-error { color: #873535; }
.reader-profile__photo-success { color: #2f6451; }
.reader-profile__overline { color: var(--muted); font-size: .68rem; font-weight: 700; letter-spacing: .11em; text-transform: uppercase; }
.reader-profile__identity h2 { margin: 7px 0; color: var(--navy-deep); font-size: 1.25rem; overflow-wrap: anywhere; }
.reader-profile__login-email { color: var(--muted); font-size: .83rem; overflow-wrap: anywhere; }
.reader-profile__rule { width: 100%; height: 1px; margin: 24px 0; background: var(--line); }
.reader-profile__roles { display: grid; gap: 8px; margin: 10px 0 22px; padding: 0; list-style: none; }
.reader-profile__roles li { width: fit-content; padding: 5px 9px; color: var(--navy); background: #fff; border: 1px solid var(--line); border-radius: 999px; font-size: .73rem; }
.reader-profile__card { display: grid; gap: 6px; margin: 20px 0; padding: 13px; color: var(--navy); background: #fff; border: 1px solid var(--line); border-radius: 10px; font-size: .75rem; }
.reader-profile__card strong { color: var(--navy); font-size: .9rem; letter-spacing: .06em; }
.reader-profile__card span:not(:first-child) { color: var(--muted); }
.reader-profile__footnote { margin: 0; color: var(--muted); font-size: .73rem; line-height: 1.6; }
.reader-profile__form-wrap { padding: clamp(22px, 4vw, 40px); }
.reader-profile__form-heading { margin-bottom: 20px; }
.reader-profile__form-heading h2 { margin-bottom: 5px; }
.reader-profile__form-heading p { margin-bottom: 0; color: var(--muted); font-size: .83rem; }
.reader-profile form { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 17px; }
.reader-profile form label { min-width: 0; }
.reader-profile form label:nth-child(2) { grid-column: 1 / -1; }
.reader-profile form label small { color: var(--muted); font-size: .72rem; font-weight: 400; }
.reader-profile form .reader-profile__email-preference { display: flex; grid-column: 1 / -1; align-items: center; gap: 9px; font-weight: 500; }
.reader-profile__email-preference input { width: 17px; height: 17px; accent-color: var(--navy); }
.reader-profile form button { justify-self: start; min-width: 150px; margin-top: 2px; }
.reader-profile__privacy { margin: 22px 0 0; padding-top: 14px; color: var(--muted); border-top: 1px solid var(--line); font-size: .73rem; }
.reader-profile__success { padding: 11px 13px; color: #2f6451; background: #e8f5ed; border: 1px solid #c8e4d1; border-radius: 8px; font-size: .83rem; }
@media (max-width: 680px) { .reader-profile__folio { grid-template-columns: 1fr; } .reader-profile__identity { padding: 24px; } .reader-profile__seal, .reader-profile__photo { width: 64px; height: 64px; } }
@media (max-width: 480px) { .reader-profile form { grid-template-columns: 1fr; } .reader-profile form label:nth-child(2) { grid-column: auto; } }
</style>
