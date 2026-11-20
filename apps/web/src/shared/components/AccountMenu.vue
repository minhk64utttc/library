<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import type { Role } from '@thu-vien/shared';
import { useSessionStore } from '@/features/auth/session.store';

const props = withDefaults(defineProps<{ workspace?: boolean }>(), { workspace: false });
const session = useSessionStore();
const route = useRoute();
const router = useRouter();
const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const pending = ref(false);
const error = ref('');
const panelPosition = ref({ top: '0px', right: '16px', maxHeight: '70vh' });
const panelId = computed(() => props.workspace ? 'workspace-account-panel' : 'reader-account-panel');
const hasReaderRole = computed(() => session.account?.roles.includes('reader'));
const hasStaffRole = computed(() => session.account?.roles.some(role => role !== 'reader'));
const profilePath = computed(() => props.workspace || !hasReaderRole.value ? '/account/profile' : '/me/profile');
const passwordPath = computed(() => props.workspace || !hasReaderRole.value ? '/account/security' : '/me/security');
const initial = computed(() => session.account?.fullName.trim().charAt(0).toLocaleUpperCase('vi-VN') || 'T');
const roleLabels: Record<Role, string> = { reader: 'Bạn đọc', circulation: 'Cán bộ mượn trả', cataloging: 'Cán bộ biên mục', inventory: 'Cán bộ kiểm kê', digital: 'Cán bộ học liệu số', manager: 'Quản lý thư viện', admin: 'Quản trị hệ thống' };
const roleDescription = computed(() => session.account?.roles.map(role => roleLabels[role]).join(' · '));

function close(restoreFocus = false): void { open.value = false; if (restoreFocus) trigger.value?.focus(); }
function closeOnViewportChange(): void { close(); }
function positionPanel(): void {
  const bounds = trigger.value?.getBoundingClientRect();
  if (!bounds) return;
  const top = bounds.bottom + 9;
  const width = Math.min(310, window.innerWidth - 32);
  const right = Math.max(16, Math.min(window.innerWidth - bounds.right, window.innerWidth - width - 16));
  panelPosition.value = { top: `${top}px`, right: `${right}px`, maxHeight: `${Math.max(120, window.innerHeight - top - 16)}px` };
}
function scrollPositionChanged(): void {
  if (!open.value) return;
  const bounds = trigger.value?.getBoundingClientRect();
  if (!bounds || bounds.bottom <= 0 || bounds.top >= window.innerHeight) close();
  else positionPanel();
}
function outside(event: PointerEvent): void { if (event.target instanceof Node && !root.value?.contains(event.target)) close(); }
function escape(event: KeyboardEvent): void { if (open.value && event.key === 'Escape') { event.preventDefault(); close(true); } }
function focusItems(): HTMLElement[] { return Array.from(panel.value?.querySelectorAll<HTMLElement>('a, button:not(:disabled)') ?? []); }
async function openWithKeyboard(): Promise<void> { open.value = true; await nextTick(); focusItems()[0]?.focus(); }
function moveFocus(event: KeyboardEvent): void {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const items = focusItems();
  if (!items.length) return;
  event.preventDefault();
  const current = items.indexOf(document.activeElement as HTMLElement);
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
  items[index]?.focus();
}
function focusOut(event: FocusEvent): void { if (event.relatedTarget instanceof Node && !root.value?.contains(event.relatedTarget)) close(); }
async function logout(): Promise<void> {
  if (pending.value) return;
  pending.value = true; error.value = '';
  try { await session.logout(); close(); await router.replace({ name: 'login' }); }
  catch { error.value = 'Chưa hoàn tất đăng xuất. Vui lòng thử lại.'; }
  finally { pending.value = false; }
}
watch(() => route.fullPath, () => close());
watch(open, async value => { if (value) { await nextTick(); positionPanel(); } });
onMounted(() => { document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape); window.addEventListener('resize', closeOnViewportChange); window.addEventListener('scroll', scrollPositionChanged); });
onBeforeUnmount(() => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('resize', closeOnViewportChange); window.removeEventListener('scroll', scrollPositionChanged); });
</script>

<template>
  <div ref="root" class="account-control" @focusout="focusOut">
    <button ref="trigger" class="account-control__trigger" type="button" :aria-expanded="open" :aria-controls="panelId" :aria-label="`Tài khoản: ${session.account?.fullName || 'của tôi'}`" @click="open = !open" @keydown.down.prevent="openWithKeyboard">
      <span class="account-control__avatar" aria-hidden="true">{{ initial }}</span>
      <span class="account-control__name">{{ session.account?.fullName || 'Tài khoản' }}</span>
      <span aria-hidden="true">⌄</span>
    </button>
    <div v-if="open" :id="panelId" ref="panel" class="account-control__panel" :style="panelPosition" @keydown="moveFocus">
      <div class="account-control__identity"><strong>{{ session.account?.fullName }}</strong><small>{{ roleDescription }}</small><span>{{ session.account?.email }}</span></div>
      <nav aria-label="Các mục tài khoản">
        <template v-if="!workspace && hasReaderRole">
          <RouterLink to="/me/loans">Đang mượn</RouterLink>
          <RouterLink to="/me/reservations">Đặt trước</RouterLink>
          <RouterLink to="/me/fines">Khoản phạt</RouterLink>
          <RouterLink to="/me/digital">Hồ sơ nộp</RouterLink>
        </template>
        <RouterLink :to="profilePath">{{ workspace || !hasReaderRole ? 'Hồ sơ cá nhân' : 'Hồ sơ & thẻ' }}</RouterLink>
        <RouterLink :to="passwordPath">Bảo mật / Đổi mật khẩu</RouterLink>
        <RouterLink v-if="workspace && hasReaderRole" class="account-control__switch" to="/me/loans">Chuyển sang cổng bạn đọc →</RouterLink>
        <RouterLink v-if="!workspace && hasStaffRole" class="account-control__switch" to="/">Chuyển sang nghiệp vụ thư viện →</RouterLink>
      </nav>
      <p v-if="error" role="alert">{{ error }}</p>
      <button class="account-control__logout" type="button" :disabled="pending" @click="logout">{{ pending ? 'Đang đăng xuất…' : 'Đăng xuất' }}</button>
    </div>
  </div>
</template>

<style scoped>
.account-control { position: relative; min-width: 0; }
.account-control__trigger { display: flex; align-items: center; gap: 9px; max-width: 235px; padding: 4px 10px 4px 5px; color: var(--navy); background: white; border: 1px solid var(--line); }
.account-control__avatar { display: grid; place-items: center; flex: 0 0 32px; width: 32px; height: 32px; border-radius: 50%; color: var(--navy); background: #f8edc6; font-weight: 700; }
.account-control__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .8rem; }
.account-control__panel { position: fixed; z-index: 60; width: min(310px, calc(100vw - 32px)); overflow-y: auto; padding: 8px; color: var(--ink); background: white; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 12px 32px #1b2e5b24; }
.account-control__identity { display: grid; gap: 5px; padding: 12px; margin-bottom: 6px; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
.account-control__identity strong { font-size: .9rem; }.account-control__identity small,.account-control__identity span { color: var(--muted); font-size: .75rem; }
.account-control__panel nav { display: grid; gap: 2px; }
.account-control__panel nav a { display: block; padding: 10px 12px; color: var(--navy); border-radius: 7px; text-decoration: none; font-size: .8rem; }
.account-control__panel nav a:hover { background: var(--canvas); }
.account-control__panel nav .account-control__switch { margin-top: 6px; border-top: 1px solid var(--line); border-radius: 0; font-weight: 600; }
.account-control__logout { width: 100%; margin-top: 6px; padding: 10px 12px; text-align: left; color: #8b3946; background: white; border: 0; border-top: 1px solid var(--line); border-radius: 0; }
.account-control__panel p { padding-inline: 12px; font-size: .8rem; }
@media (max-width: 680px) { .account-control__trigger { max-width: 190px; } }
@media (max-width: 380px) { .account-control__trigger { max-width: 150px; } }
</style>
