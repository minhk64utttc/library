<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ROLES, accountListQuerySchema, type AccountDto, type Role } from '@thu-vien/shared';
import { useSessionStore } from '@/features/auth/session.store';
import { ApiError } from '@/shared/api/client';
import * as accountsApi from '../api';

type DialogMode = 'create' | 'edit' | 'status' | 'reset';
type ReaderGroup = AccountDto['readerGroup'];
const session = useSessionStore();
const route = useRoute();
const router = useRouter();
const canManage = computed(() => session.can('accounts:manage'));
const accounts = ref<AccountDto[]>([]);
const total = ref(0);
const loading = ref(false);
const backgroundRefreshing = ref(false);
const lastUpdatedAt = ref<Date | null>(null);
const refreshNotice = ref('');
const errorMessage = ref('');
const noticeMessage = ref('');
const query = computed(() => {
  const parsed = accountListQuerySchema.safeParse(route.query);
  return parsed.success ? parsed.data : accountListQuerySchema.parse({});
});
const searchText = ref(query.value.q ?? '');
const filterForm = reactive({ role: query.value.role ?? '' as '' | Role, status: query.value.status ?? '' as '' | 'active' | 'disabled' });
const accountSection = ref<HTMLElement | null>(null);
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / query.value.pageSize)));
const dialog = ref<HTMLDialogElement | null>(null);
const firstField = ref<HTMLInputElement | null>(null);
const heading = ref<HTMLElement | null>(null);
const mode = ref<DialogMode>('create');
const selected = ref<AccountDto | null>(null);
const pending = ref(false);
const dialogError = ref('');
const form = reactive({ email: '', fullName: '', password: '', roles: [] as Role[], readerGroup: 'student' as ReaderGroup, mustChangePassword: true });
const ROLE_LABELS: Record<Role, string> = {
  reader: 'Bạn đọc', circulation: 'Cán bộ mượn trả', cataloging: 'Cán bộ biên mục',
  inventory: 'Cán bộ kho', digital: 'Cán bộ học liệu số', manager: 'Quản lý thư viện', admin: 'Quản trị hệ thống',
};
const GROUP_LABELS: Record<ReaderGroup, string> = { student: 'Sinh viên', lecturer: 'Giảng viên', staff: 'Nhân viên', other: 'Khác' };
const dialogTitle = computed(() => mode.value === 'create' ? 'Tạo tài khoản' : mode.value === 'edit' ? 'Chỉnh sửa tài khoản' : mode.value === 'reset' ? 'Đặt lại mật khẩu' : selected.value?.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản');
const isSelf = computed(() => selected.value?.id === session.account?.id);
let returnFocus: HTMLElement | null = null;
let loadSequence = 0;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
let backgroundRequest = false;

function closeMenus(event?: Event): void {
  for (const menu of accountSection.value?.querySelectorAll<HTMLDetailsElement>('.accounts__menu[open]') ?? []) {
    if (!event || !(event.target instanceof Node) || !menu.contains(event.target)) menu.open = false;
  }
}
function menuEscape(event: KeyboardEvent): void {
  const menu = event.currentTarget as HTMLDetailsElement;
  menu.open = false;
  (menu.querySelector('summary') as HTMLElement | null)?.focus();
}
function oneMenu(event: Event): void {
  const current = event.currentTarget as HTMLDetailsElement;
  if (!current.open) return;
  for (const menu of accountSection.value?.querySelectorAll<HTMLDetailsElement>('.accounts__menu[open]') ?? []) if (menu !== current) menu.open = false;
}
function clearFilters(): void {
  searchText.value = '';
  filterForm.role = '';
  filterForm.status = '';
  navigate({ q: undefined, role: undefined, status: undefined, page: 1 });
}
function navigate(changes: Record<string, string | number | undefined>): void {
  void router.push({ query: { ...route.query, ...changes } });
}
function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Không kết nối được thư viện. Kiểm tra mạng và thử lại.';
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
  if (error.status === 403) return 'Bạn chưa có quyền quản lý tài khoản.';
  if (error.status === 409) return 'Email đã tồn tại. Hãy kiểm tra tài khoản có sẵn hoặc dùng email khác.';
  return error.code !== 'ERROR' ? error.message : 'Không lưu được thay đổi. Vui lòng thử lại.';
}
async function load(options: { quiet?: boolean } = {}): Promise<void> {
  const quiet = options.quiet ?? false;
  if (quiet && (backgroundRequest || loading.value)) return;
  if (quiet) backgroundRequest = true;
  const sequence = ++loadSequence;
  if (quiet) backgroundRefreshing.value = true;
  else { loading.value = true; errorMessage.value = ''; }
  refreshNotice.value = '';
  try {
    const result = await accountsApi.listAccounts(query.value);
    if (sequence !== loadSequence) return;
    accounts.value = result.items;
    total.value = result.total;
    lastUpdatedAt.value = new Date();
    if (query.value.page > Math.max(1, Math.ceil(result.total / query.value.pageSize))) navigate({ page: 1 });
  } catch (error) {
    if (sequence === loadSequence) {
      if (quiet) refreshNotice.value = 'Chưa thể cập nhật trạng thái mới nhất. Danh sách đang hiển thị dữ liệu lần tải trước.';
      else errorMessage.value = errorText(error);
    }
  } finally {
    if (sequence === loadSequence && !quiet) loading.value = false;
    if (quiet) { backgroundRefreshing.value = false; backgroundRequest = false; }
  }
}
async function openDialog(nextMode: DialogMode, account?: AccountDto): Promise<void> {
  if (pending.value) return;
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (returnFocus?.closest('details')) (returnFocus.closest('details') as HTMLDetailsElement).open = false;
  mode.value = nextMode;
  selected.value = account ?? null;
  dialogError.value = '';
  Object.assign(form, { email: account?.email ?? '', fullName: account?.fullName ?? '', password: '', roles: account ? [...account.roles] : ['reader'], readerGroup: account?.readerGroup ?? 'student', mustChangePassword: account?.mustChangePassword ?? true });
  await nextTick();
  dialog.value?.showModal();
  firstField.value?.focus();
}
function closeDialog(): void { if (!pending.value) dialog.value?.close(); }
function onClose(): void {
  form.password = '';
  if (returnFocus?.isConnected) {
    const summary = returnFocus.closest('details')?.querySelector('summary');
    if (summary instanceof HTMLElement) summary.focus(); else returnFocus.focus();
  } else heading.value?.focus();
}
async function submit(): Promise<void> {
  if (pending.value) return;
  dialogError.value = '';
  if (['create', 'edit'].includes(mode.value) && (!form.roles.length || !form.fullName.trim())) {
    dialogError.value = !form.roles.length ? 'Chọn ít nhất một vai trò cho tài khoản.' : 'Vui lòng nhập họ và tên.';
    return;
  }
  pending.value = true;
  noticeMessage.value = '';
  const account = selected.value;
  const affectsSelf = account?.id === session.account?.id;
  try {
    if (mode.value === 'create') {
      await accountsApi.createAccount({ email: form.email.trim(), fullName: form.fullName.trim(), password: form.password, roles: [...form.roles], readerGroup: form.roles.includes('reader') ? form.readerGroup : 'other', status: 'active', mustChangePassword: form.mustChangePassword });
      noticeMessage.value = 'Đã tạo tài khoản. Người dùng có thể đăng nhập bằng email đã cấp.';
    } else if (mode.value === 'edit' && account) {
      await accountsApi.updateAccount(account.id, { fullName: form.fullName.trim(), roles: [...form.roles], ...(form.roles.includes('reader') ? { readerGroup: form.readerGroup } : {}) });
      noticeMessage.value = `Đã cập nhật tài khoản ${account.fullName}.`;
    } else if (mode.value === 'status' && account) {
      await accountsApi.updateAccount(account.id, { status: account.status === 'active' ? 'disabled' : 'active' });
      noticeMessage.value = account.status === 'active' ? `Đã khóa ${account.fullName} và thu hồi các phiên đăng nhập.` : `Đã mở khóa ${account.fullName}.`;
    } else if (mode.value === 'reset' && account) {
      await accountsApi.resetAccountPassword(account.id, { password: form.password });
      noticeMessage.value = `Đã đặt lại mật khẩu ${account.fullName}, thu hồi các phiên và yêu cầu đổi mật khẩu ở lần đăng nhập tiếp theo.`;
    }
    form.password = '';
    dialog.value?.close();
    if (affectsSelf) {
      await session.load();
      if (!session.isAuthenticated) { await router.replace({ name: 'login' }); return; }
      if (!session.can('accounts:manage')) { await router.replace({ name: 'home' }); return; }
    }
    await load();
  } catch (error) { dialogError.value = errorText(error); }
  finally { pending.value = false; }
}
watch(() => route.fullPath, () => {
  searchText.value = query.value.q ?? '';
  filterForm.role = query.value.role ?? '';
  filterForm.status = query.value.status ?? '';
  closeMenus();
  void load();
}, { immediate: true });
function refreshWhenVisible(): void {
  if (document.visibilityState === 'visible') void load({ quiet: true });
}
function refreshNow(): void { void load({ quiet: true }); }
function retryLoad(): void { void load(); }
onMounted(() => {
  document.addEventListener('pointerdown', closeMenus);
  document.addEventListener('visibilitychange', refreshWhenVisible);
  window.addEventListener('focus', refreshWhenVisible);
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void load({ quiet: true });
  }, 20_000);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeMenus);
  document.removeEventListener('visibilitychange', refreshWhenVisible);
  window.removeEventListener('focus', refreshWhenVisible);
  if (refreshTimer) window.clearInterval(refreshTimer);
});
</script>

<template>
  <section ref="accountSection" class="accounts" aria-labelledby="accounts-title">
    <header class="accounts__header"><div><p class="eyebrow">Quản trị thư viện</p><h1 id="accounts-title" ref="heading" tabindex="-1">Tài khoản</h1><p>Quản lý người dùng, vai trò và quyền đăng nhập.</p><small v-if="lastUpdatedAt" class="accounts__updated" role="status" aria-live="polite">{{ backgroundRefreshing ? 'Đang cập nhật…' : `Cập nhật lúc ${lastUpdatedAt.toLocaleTimeString('vi-VN')}` }}</small></div><div class="accounts__header-actions"><button type="button" :disabled="loading || backgroundRefreshing" @click="refreshNow">Làm mới</button><button v-if="canManage" type="button" @click="openDialog('create')">+ Tạo tài khoản</button></div></header>
    <p v-if="refreshNotice" class="accounts__refresh-notice" role="status">{{ refreshNotice }} <button type="button" @click="refreshNow">Thử cập nhật lại</button></p>
    <form class="accounts__filters" role="search" @submit.prevent="navigate({ q: searchText.trim() || undefined, role: filterForm.role || undefined, status: filterForm.status || undefined, page: 1 })">
      <label>Tìm theo tên hoặc email<input v-model="searchText" type="search" maxlength="200" placeholder="Nhập tên hoặc email…" /></label>
      <label>Vai trò<select v-model="filterForm.role"><option value="">Tất cả vai trò</option><option v-for="role in ROLES" :key="role" :value="role">{{ ROLE_LABELS[role] }}</option></select></label>
      <label>Trạng thái<select v-model="filterForm.status"><option value="">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="disabled">Đã khóa</option></select></label><div class="accounts__filter-actions"><button type="submit">Áp dụng bộ lọc</button><button type="button" @click="clearFilters">Xóa bộ lọc</button></div>
    </form>
    <div v-if="query.q || query.role || query.status" class="accounts__chips" aria-label="Bộ lọc đang áp dụng"><button v-if="query.q" @click="navigate({ q: undefined, page: 1 })">{{ query.q }} ×</button><button v-if="query.role" @click="navigate({ role: undefined, page: 1 })">{{ ROLE_LABELS[query.role] }} ×</button><button v-if="query.status" @click="navigate({ status: undefined, page: 1 })">{{ query.status === 'active' ? 'Đang hoạt động' : 'Đã khóa' }} ×</button><button @click="clearFilters">Xóa bộ lọc</button></div>
    <p v-if="noticeMessage" class="accounts__notice" role="status">{{ noticeMessage }}</p>
    <p v-if="errorMessage" role="alert">{{ errorMessage }} <button @click="retryLoad">Thử lại</button></p>
    <div v-if="loading" class="accounts__skeleton" role="status" aria-label="Đang tải tài khoản"><div v-for="n in 4" :key="n"></div></div>
    <div v-else-if="!errorMessage && !accounts.length" class="empty-state"><h2>{{ query.q || query.role || query.status ? 'Không có tài khoản khớp bộ lọc' : 'Chưa có tài khoản' }}</h2><p>Thử tên, email khác hoặc bỏ bớt điều kiện lọc.</p><button v-if="canManage" @click="openDialog('create')">Tạo tài khoản</button></div>
    <template v-else-if="!errorMessage">
      <div class="accounts__table"><table><caption>{{ total }} tài khoản · Sắp xếp theo email A–Z</caption><thead><tr><th scope="col">Người dùng</th><th scope="col">Vai trò</th><th scope="col">Nhóm bạn đọc</th><th scope="col">Trạng thái</th><th scope="col"><span class="sr-only">Thao tác</span></th></tr></thead><tbody>
        <tr v-for="account in accounts" :key="account.id"><td data-label="Người dùng"><div class="accounts__person"><span class="accounts__avatar" aria-hidden="true">{{ account.fullName.trim().charAt(0).toLocaleUpperCase('vi') }}</span><div><strong>{{ account.fullName }}</strong><small>{{ account.email }}</small><small v-if="account.id === session.account?.id" class="accounts__self">Tài khoản của bạn</small></div></div></td>
          <td data-label="Vai trò"><div class="accounts__badges"><span v-for="role in account.roles.slice(0, 2)" :key="role" class="accounts__role">{{ ROLE_LABELS[role] }}</span><details v-if="account.roles.length > 2" class="accounts__remaining"><summary :aria-label="`Xem ${account.roles.length - 2} vai trò khác của ${account.fullName}`">+{{ account.roles.length - 2 }}</summary><span v-for="role in account.roles.slice(2)" :key="role" class="accounts__role">{{ ROLE_LABELS[role] }}</span></details></div></td>
          <td data-label="Nhóm bạn đọc"><template v-if="account.roles.includes('reader')">{{ GROUP_LABELS[account.readerGroup] }}</template><span v-else class="accounts__muted">Không áp dụng</span></td>
          <td data-label="Trạng thái"><span class="accounts__status" :data-state="account.status">{{ account.status === 'active' ? '● Đang hoạt động' : '○ Đã khóa' }}</span><small v-if="account.mustChangePassword">Cần đổi mật khẩu khi đăng nhập</small></td>
          <td data-label="Thao tác"><details v-if="canManage" class="accounts__menu" @keydown.esc.prevent="menuEscape" @toggle="oneMenu"><summary :aria-label="`Thao tác với ${account.fullName}`">⋯</summary><div><button @click="openDialog('edit', account)">Chỉnh sửa tài khoản</button><button @click="openDialog('status', account)">{{ account.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản' }}</button><button @click="openDialog('reset', account)">Đặt lại mật khẩu</button></div></details></td>
        </tr>
      </tbody></table></div>
      <nav class="accounts__pagination" aria-label="Phân trang tài khoản"><label>Số dòng<select :value="query.pageSize" @change="navigate({ pageSize: Number(($event.target as HTMLSelectElement).value), page: 1 })"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option></select></label><span>{{ total ? (query.page - 1) * query.pageSize + 1 : 0 }}–{{ Math.min(query.page * query.pageSize, total) }} / {{ total }}</span><button :disabled="query.page <= 1" @click="navigate({ page: query.page - 1 })">← Trước</button><span>Trang {{ query.page }}/{{ pageCount }}</span><button :disabled="query.page >= pageCount" @click="navigate({ page: query.page + 1 })">Sau →</button></nav>
    </template>
    <dialog ref="dialog" class="accounts__dialog" aria-labelledby="account-dialog-title" @close="onClose" @cancel="pending && $event.preventDefault()">
      <form @submit.prevent="submit"><div class="accounts__dialog-head"><h2 id="account-dialog-title">{{ dialogTitle }}</h2><button type="button" aria-label="Đóng" :disabled="pending" @click="closeDialog">×</button></div>
        <p v-if="selected" class="accounts__selected"><strong>{{ selected.fullName }}</strong><span>{{ selected.email }}</span></p>
        <template v-if="mode === 'create' || mode === 'edit'">
          <fieldset :disabled="pending" class="accounts__fields"><legend class="sr-only">Thông tin tài khoản</legend>
            <label v-if="mode === 'create'">Email đăng nhập<input ref="firstField" v-model="form.email" type="email" required maxlength="200" autocomplete="off" /></label>
            <label>Họ và tên<input :ref="mode === 'edit' ? 'firstField' : undefined" v-model="form.fullName" required maxlength="200" autocomplete="off" /></label>
            <label v-if="mode === 'create'">Mật khẩu tạm thời<input v-model="form.password" type="password" required minlength="8" maxlength="200" autocomplete="new-password" /><small>Ít nhất 8 ký tự. Giao mật khẩu qua kênh riêng cho người dùng.</small></label>
            <fieldset class="accounts__roles"><legend>Vai trò <span aria-hidden="true">*</span></legend><p>Một người có thể có nhiều vai trò. Chọn theo công việc được giao.</p><label v-for="role in ROLES" :key="role"><input v-model="form.roles" type="checkbox" :value="role" />{{ ROLE_LABELS[role] }}</label></fieldset>
            <div v-if="form.roles.includes('reader')" class="accounts__group"><label>Nhóm bạn đọc<select v-model="form.readerGroup"><option v-for="(label, group) in GROUP_LABELS" :key="group" :value="group">{{ label }}</option></select></label><small>Dùng để áp dụng chính sách mượn cho người có vai trò Bạn đọc; không thay thế vai trò hệ thống.</small></div>
            <label v-if="mode === 'create'" class="accounts__check"><input v-model="form.mustChangePassword" type="checkbox" />Yêu cầu đổi mật khẩu ở lần đăng nhập đầu</label>
          </fieldset>
        </template>
        <template v-else-if="mode === 'reset'"><p>Mọi phiên đăng nhập của tài khoản này sẽ bị thu hồi. Người dùng phải đổi mật khẩu ở lần đăng nhập tiếp theo.</p><label>Mật khẩu tạm thời mới<input ref="firstField" v-model="form.password" type="password" required minlength="8" maxlength="200" :disabled="pending" autocomplete="new-password" /><small>Ít nhất 8 ký tự. Mật khẩu không được gửi tự động qua email.</small></label></template>
        <template v-else><p v-if="selected?.status === 'active'">Người dùng sẽ không thể đăng nhập và mọi phiên đăng nhập hiện tại sẽ bị thu hồi. Dữ liệu mượn, thẻ và lịch sử vẫn được giữ.</p><p v-else>Người dùng có thể đăng nhập lại bằng mật khẩu hiện tại. Các phiên đã thu hồi không được khôi phục.</p></template>
        <p v-if="isSelf && (mode === 'status' || mode === 'reset')" class="accounts__warning">Bạn đang thao tác với tài khoản của mình. Thao tác này có thể đưa bạn về trang đăng nhập.</p>
        <p v-if="dialogError" class="accounts__dialog-error" role="alert">{{ dialogError }}</p>
        <div class="accounts__dialog-actions"><button type="button" :disabled="pending" @click="closeDialog">Hủy</button><button type="submit" :disabled="pending">{{ pending ? 'Đang lưu…' : mode === 'create' ? 'Tạo tài khoản' : mode === 'edit' ? 'Lưu thay đổi' : dialogTitle }}</button></div>
      </form>
    </dialog>
  </section>
</template>

<style scoped>
.accounts__header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:24px}.accounts__header h1{margin:5px 0}.accounts__header p{margin-bottom:0;color:var(--muted)}.accounts__filters{display:grid;grid-template-columns:minmax(220px,2fr) 1fr 1fr auto;align-items:end;gap:14px;margin-bottom:16px}.accounts__filter-actions,.accounts__chips,.accounts__badges,.accounts__pagination{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.accounts__chips{margin:14px 0}.accounts__chips button{border-radius:20px;font-size:.75rem}.accounts__table{overflow-x:auto}.accounts__person{display:flex;gap:12px;align-items:center}.accounts__person>div{min-width:0}.accounts__avatar{display:grid;place-items:center;flex-shrink:0;width:38px;height:38px;background:#edf2fa;color:var(--navy);border:1px solid #dce4ef;border-radius:50%;font-weight:700}td{vertical-align:top}td strong{display:block;font-size:.88rem}td small{display:block;color:var(--muted);font-size:.74rem;margin-top:5px;overflow-wrap:anywhere}.accounts__self{color:var(--navy)!important}.accounts__role{display:inline-block;padding:5px 8px;border:1px solid #dce4ef;background:#f1f5fa;color:var(--navy);font-size:.72rem;border-radius:5px;white-space:nowrap}.accounts__remaining summary{cursor:pointer;padding:5px 8px;color:var(--navy);font-size:.75rem}.accounts__remaining[open]{display:grid;gap:4px}.accounts__status{display:inline-block;padding:5px 8px;border:1px solid #d0e2d7;background:#eef7f1;color:#2b6044;font-size:.75rem;border-radius:5px;white-space:nowrap}.accounts__status[data-state="disabled"]{border-color:#ddd;background:#f4f4f4;color:#606672}.accounts__muted{color:var(--muted);font-size:.8rem}.accounts__menu summary{width:36px;padding:4px 10px;cursor:pointer;border:1px solid var(--line);border-radius:6px;list-style:none;font-weight:700}.accounts__menu>div{display:grid;gap:4px;width:190px;padding:8px;margin-top:5px;border:1px solid var(--line);border-radius:8px;background:#fff;box-shadow:0 6px 18px #10233f12}.accounts__menu button{text-align:left;background:#fff;color:var(--navy);border:0;font-size:.75rem;min-height:32px;padding:7px 9px}.accounts__menu button:hover{background:#edf2fa}.accounts__pagination{justify-content:flex-end;margin-top:18px;font-size:.8rem}.accounts__pagination label{display:flex;align-items:center;gap:8px}.accounts__pagination select{width:auto}.accounts__notice{padding:13px;color:#2b6044;background:#eef7f1;border:1px solid #d0e2d7;border-radius:8px}.accounts__skeleton{display:grid;gap:12px}.accounts__skeleton div{height:70px;background:#edf2f7;border-radius:6px}.accounts__dialog{width:min(600px,calc(100% - 28px));max-height:90vh;overflow:auto;padding:26px;border:1px solid var(--line);border-radius:12px;color:var(--ink)}.accounts__dialog::backdrop{background:#12244288}.accounts__dialog form{display:grid;gap:18px}.accounts__dialog-head{display:flex;justify-content:space-between;align-items:center;gap:16px}.accounts__dialog-head h2{margin:0;font-size:1.3rem}.accounts__dialog-head button{background:transparent;color:var(--ink);border:0;font-size:1.4rem;min-width:36px}.accounts__selected{display:grid;gap:5px;padding:12px;background:#f1f5fa;border-radius:8px;margin:0;font-size:.83rem}.accounts__selected span{color:var(--muted);overflow-wrap:anywhere}.accounts__fields{display:grid;gap:16px;border:0;padding:0;min-width:0}.accounts__roles{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px;border:1px solid var(--line);border-radius:8px}.accounts__roles p{grid-column:1/-1;margin:0;color:var(--muted);font-size:.75rem}.accounts__roles label,.accounts__check{display:flex;align-items:center;gap:8px;font-size:.8rem}.accounts__roles input,.accounts__check input{width:16px;height:16px;flex-shrink:0}.accounts__group{padding:16px;background:#f6f8fc;border:1px solid var(--line);border-radius:8px}.accounts__dialog small{color:var(--muted);font-size:.75rem;line-height:1.5}.accounts__dialog-actions{display:flex;justify-content:flex-end;gap:10px;padding-top:12px;border-top:1px solid var(--line)}.accounts__dialog-actions>button:first-child{background:white;color:var(--navy)}.accounts__warning{padding:12px;background:#fff6df;color:#79551b;border-radius:6px;font-size:.8rem}.accounts__dialog-error{margin:0;color:#9f3131;font-size:.85rem}.sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:900px){.accounts__filters{grid-template-columns:1fr 1fr}.accounts__header{align-items:flex-start}}@media(max-width:600px){.accounts__table caption{display:block;width:100%;text-align:left}.accounts__header{flex-direction:column}.accounts__filters{grid-template-columns:1fr}.accounts__table table,.accounts__table tbody,.accounts__table tr,.accounts__table td{display:block;min-width:0;width:100%}.accounts__table thead{display:none}.accounts__table tr{padding:16px 0;border-bottom:1px solid var(--line)}.accounts__table td{border:0;padding:8px 4px}.accounts__table td::before{content:attr(data-label);display:block;color:var(--muted);font-size:.68rem;margin-bottom:6px}.accounts__pagination{justify-content:flex-start}.accounts__roles{grid-template-columns:1fr}.accounts__dialog{padding:18px}.accounts__person strong{overflow-wrap:anywhere}}
.accounts__header-actions{display:flex;gap:9px;align-items:center;flex-shrink:0}.accounts__updated{display:block;margin-top:7px;color:var(--muted);font-size:.75rem}.accounts__refresh-notice{padding:10px 12px;color:#76521d;background:#fff7e6;border:1px solid #edd9ae;border-radius:8px;font-size:.82rem}.accounts__refresh-notice button{margin-left:8px}@media(max-width:600px){.accounts__header-actions{width:100%;flex-wrap:wrap}}
</style>
