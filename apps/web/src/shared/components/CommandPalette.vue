<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NAV_ITEMS } from '@/app/navigation';
import { useSessionStore } from '@/features/auth/session.store';

const session = useSessionStore();
const router = useRouter();
const dialog = ref<HTMLDialogElement | null>(null);
const query = ref('');
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
const results = computed(() => NAV_ITEMS.filter(item =>
  ((!item.permission || session.can(item.permission)) || (item.alternatePermission && session.can(item.alternatePermission))) && normalize(item.label).includes(normalize(query.value)),
));
function open(): void { query.value = ''; if (!dialog.value?.open) dialog.value?.showModal(); }
function shortcut(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); }
}
async function go(to: string): Promise<void> { dialog.value?.close(); await router.push(to); }
onMounted(() => document.addEventListener('keydown', shortcut));
onBeforeUnmount(() => document.removeEventListener('keydown', shortcut));
</script>

<template>
  <button class="command-trigger" type="button" aria-haspopup="dialog" aria-label="Tìm nhanh chức năng" title="Tìm nhanh chức năng (Ctrl K)" @click="open"><svg class="command-trigger__icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg><span class="command-trigger__label">Tìm nhanh chức năng</span><kbd>Ctrl K</kbd></button>
  <dialog ref="dialog" class="command-dialog" aria-labelledby="command-title">
    <div class="command-heading"><h2 id="command-title">Tìm nhanh chức năng</h2><button type="button" aria-label="Đóng tìm nhanh" @click="dialog?.close()">✕</button></div>
    <label>Tìm chức năng<input v-model="query" autofocus placeholder="Ví dụ: mượn, phạt, tài liệu…" @keydown.enter.prevent="results[0] && go(results[0].to)" /></label>
    <ul><li v-for="item in results" :key="item.to"><button type="button" @click="go(item.to)">{{ item.label }} <span aria-hidden="true">→</span></button></li></ul>
    <p v-if="!results.length">Không có chức năng khớp. Thử từ “mượn”, “thẻ” hoặc “sách”.</p>
    <small>Enter mở kết quả đầu · Esc đóng</small>
  </dialog>
</template>

<style scoped>
.command-trigger { display: flex; align-items: center; gap: 7px; padding: 8px 12px; font-size: .78rem; color: var(--navy); background: var(--canvas); white-space: nowrap; }
.command-trigger__icon { flex-shrink: 0; }
kbd { padding: 2px 4px; margin-left: 8px; border: 1px solid var(--line); border-radius: 4px; font-size: .7rem; }
.command-dialog { width: min(540px, calc(100% - 30px)); max-height: 80vh; padding: 24px; border: 1px solid var(--line); border-radius: 14px; color: var(--ink); }
.command-dialog::backdrop { background: #16284988; }
.command-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.command-heading h2 { font-size: 1.2rem; }
.command-dialog ul { display: grid; gap: 4px; list-style: none; padding: 0; }
.command-dialog li button { display: flex; justify-content: space-between; width: 100%; background: var(--canvas); color: var(--navy); border: 1px solid transparent; text-align: left; }
.command-dialog li button:hover { border-color: var(--navy); }
.command-dialog small { color: var(--muted); }
@media (max-width: 680px) { kbd { display: none; } .command-trigger__label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; } .command-trigger { width: 40px; height: 40px; justify-content: center; padding: 8px; } }
</style>
