<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { apiFetch } from '@/shared/api/client';
withDefaults(defineProps<{ workspace?: boolean }>(), { workspace: false });

interface NotificationItem { id: string; subject: string; body: string; readAt: string | null }
const items = ref<NotificationItem[]>([]);
const unreadCount = ref(0);
const loading = ref(false);
const error = ref('');
const panel = ref<HTMLDetailsElement | null>(null);
const panelPosition = ref({ top: '0px', right: '16px', maxHeight: '70vh' });
const route = useRoute();
let refreshTimer: ReturnType<typeof setInterval> | undefined;
let loadingRequest = false;
function closePanel(restoreFocus = false): void { if (panel.value) panel.value.open = false; if (restoreFocus) panel.value?.querySelector('summary')?.focus(); }
function outside(event: PointerEvent): void { if (event.target instanceof Node && !panel.value?.contains(event.target)) closePanel(); }
function viewportChanged(): void { closePanel(); }
async function onToggle(): Promise<void> {
  if (!panel.value?.open) return;
  await nextTick();
  positionPanel();
  await load();
}
function positionPanel(): void {
  const bounds = panel.value?.querySelector('summary')?.getBoundingClientRect();
  if (bounds) {
    const top = bounds.bottom + 10;
    const width = Math.min(360, window.innerWidth - 40);
    const right = Math.max(20, Math.min(window.innerWidth - bounds.right, window.innerWidth - width - 20));
    panelPosition.value = { top: `${top}px`, right: `${right}px`, maxHeight: `${Math.max(120, window.innerHeight - top - 16)}px` };
  }
}
function scrollPositionChanged(): void {
  if (!panel.value?.open) return;
  const bounds = panel.value.querySelector('summary')?.getBoundingClientRect();
  if (!bounds || bounds.bottom <= 0 || bounds.top >= window.innerHeight) closePanel();
  else positionPanel();
}
async function load(quiet = false): Promise<void> {
  if (loadingRequest) return;
  loadingRequest = true;
  if (!quiet) loading.value = true;
  error.value = '';
  try {
    const result = await apiFetch<{ items: NotificationItem[]; unreadCount: number }>('/me/notifications?page=1&pageSize=5');
    items.value = result.items; unreadCount.value = result.unreadCount;
  } catch { error.value = 'Không tải được thông báo. Vui lòng thử lại.'; }
  finally { loading.value = false; loadingRequest = false; }
}
async function markRead(): Promise<void> {
  if (loading.value || loadingRequest) return;
  loading.value = true;
  try {
    await apiFetch('/me/notifications/read', { method: 'POST', body: JSON.stringify({ ids: items.value.filter(item => !item.readAt).map(item => item.id) }) });
    await load();
  } catch { error.value = 'Chưa đánh dấu được thông báo. Vui lòng thử lại.'; }
  finally { loading.value = false; }
}
function refreshWhenVisible(): void { if (document.visibilityState === 'visible') void load(true); }
function retryLoad(): void { void load(); }
onMounted(() => {
  void load();
  document.addEventListener('pointerdown', outside);
  document.addEventListener('visibilitychange', refreshWhenVisible);
  window.addEventListener('focus', refreshWhenVisible);
  window.addEventListener('resize', viewportChanged);
  window.addEventListener('scroll', scrollPositionChanged);
  refreshTimer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 15_000);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside);
  document.removeEventListener('visibilitychange', refreshWhenVisible);
  window.removeEventListener('focus', refreshWhenVisible);
  window.removeEventListener('resize', viewportChanged);
  window.removeEventListener('scroll', scrollPositionChanged);
  if (refreshTimer) window.clearInterval(refreshTimer);
});
watch(() => route.fullPath, () => { if (panel.value) panel.value.open = false; void load(); });
</script>

<template>
  <details ref="panel" class="notification-bell" @toggle="onToggle" @keydown.esc.prevent="closePanel(true)">
    <summary :aria-label="`Thông báo: ${unreadCount} chưa đọc`"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg><span v-if="unreadCount" class="notification-count">{{ unreadCount > 99 ? '99+' : unreadCount }}</span></summary>
    <div class="notification-panel" :style="panelPosition">
      <h2>Thông báo</h2>
      <p v-if="error" role="alert">{{ error }} <button type="button" @click="retryLoad">Thử lại</button></p>
      <p v-else-if="loading" role="status">Đang tải…</p>
      <ul v-else-if="items.length"><li v-for="item in items" :key="item.id"><strong>{{ item.readAt ? '' : '● ' }}{{ item.subject }}</strong><p>{{ item.body }}</p></li></ul>
      <p v-else>Bạn chưa có thông báo mới.</p>
      <button v-if="items.some(item => !item.readAt)" type="button" :disabled="loading" @click="markRead">Đánh dấu các thông báo hiển thị đã đọc</button>
      <RouterLink :to="workspace ? '/account/notifications' : '/me/notifications'">Xem tất cả thông báo →</RouterLink>
    </div>
  </details>
</template>

<style scoped>
.notification-bell { position: relative; }
.notification-bell summary { position: relative; display: flex; align-items: center; justify-content: center; min-width: 38px; min-height: 38px; padding: 8px; color: var(--navy); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; list-style: none; }
.notification-bell summary::-webkit-details-marker { display: none; }
.notification-count { position: absolute; top: -8px; right: -8px; min-width: 20px; padding: 2px 4px; color: white; background: #a65762; border-radius: 10px; font-size: .65rem; text-align: center; }
.notification-panel { position: fixed; z-index: 50; width: min(360px, calc(100vw - 40px)); overflow: auto; padding: 18px; color: var(--ink); background: white; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 12px 32px #1b2e5b22; }
.notification-panel h2 { font-size: 1rem; }
.notification-panel ul { list-style: none; padding: 0; }
.notification-panel li { padding: 12px 0; border-bottom: 1px solid var(--line); font-size: .8rem; }
.notification-panel li p { margin-bottom: 0; color: var(--muted); }
.notification-panel > a { display: block; margin-top: 15px; font-size: .8rem; }
.notification-panel button { padding: 8px; font-size: .75rem; }
</style>
