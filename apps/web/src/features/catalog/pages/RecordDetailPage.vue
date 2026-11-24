<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import type { CatalogRecordDto } from '@thu-vien/shared';
import { useSessionStore } from '@/features/auth/session.store';
import { getRecord } from '../api';
import { statusLabel } from '../status';
import { languageLabel } from '@/shared/language-label';
const route = useRoute();
const session = useSessionStore();
const record = ref<CatalogRecordDto | null>(null);
const loading = ref(true);
const error = ref('');
let sequence = 0;
async function load(): Promise<void> {
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  try { const result = await getRecord(String(route.params.id)); if (current === sequence) record.value = result; }
  catch { if (current === sequence) error.value = 'Không tải được bản ghi. Kiểm tra quyền truy cập và thử lại.'; }
  finally { if (current === sequence) loading.value = false; }
}
watch(() => route.params.id, () => void load(), { immediate: true });
</script>
<template><section><nav aria-label="Đường dẫn"><RouterLink :to="{ name: 'home' }">Trang chủ</RouterLink> › <RouterLink :to="{ name: 'catalog-records' }">Sách &amp; tài liệu</RouterLink> › Chi tiết</nav><p v-if="loading" role="status">Đang tải bản ghi…</p><p v-else-if="error" role="alert">{{ error }} <button @click="load">Thử lại</button></p><template v-else-if="record"><header><p class="eyebrow">Chi tiết bản ghi</p><h1>{{ record.title }}</h1><p>{{ record.author || 'Chưa có tác giả' }}</p><span class="status-badge" :data-state="record.status">{{ statusLabel(record.status) }}</span><p>Nháp → Chờ duyệt → Đã duyệt → Đã công bố</p><RouterLink v-if="session.can('catalog:write') && ['draft', 'withdrawn'].includes(record.status)" :to="{ name: 'catalog-record-edit', params: { id: record.id } }">Sửa bản ghi</RouterLink></header><p v-if="record.rejectReason" role="note">Lý do trả lại: {{ record.rejectReason }}</p><dl><dt>Chủ đề</dt><dd>{{ record.subject || 'Chưa cập nhật' }}</dd><dt>Phân loại</dt><dd>{{ record.classification || 'Chưa cập nhật' }}</dd><dt>Ngày tạo</dt><dd>{{ new Date(record.createdAt).toLocaleString('vi-VN') }}</dd><dt>Cập nhật</dt><dd>{{ new Date(record.updatedAt).toLocaleString('vi-VN') }}</dd></dl><h2>Ấn bản ({{ record.editions.length }})</h2><p v-if="!record.editions.length" class="empty-state">Chưa có ấn bản. Cần bổ sung thông tin ấn bản trước khi đưa sách vào kho.</p><div class="edition-grid"><article v-for="edition in record.editions" :key="edition.id"><h3>{{ edition.publishYear || 'Chưa rõ năm xuất bản' }}</h3><dl><dt>Nhà xuất bản</dt><dd>{{ edition.publisherName || 'Chưa cập nhật' }}</dd><dt>ISBN</dt><dd>{{ edition.isbn || 'Chưa cập nhật' }}</dd><dt>Ngôn ngữ</dt><dd>{{ languageLabel(edition.language) || 'Chưa cập nhật' }}</dd><dt>Lần xuất bản</dt><dd>{{ edition.editionNo || 'Chưa cập nhật' }}</dd><dt>Ký hiệu xếp giá</dt><dd>{{ edition.callNumber || 'Chưa gán' }}</dd></dl></article></div></template></section></template>
<style scoped>nav{margin-bottom:24px;color:var(--muted)}header{padding:20px 0;border-bottom:1px solid var(--line)}header h1{margin:6px 0}header>p{color:var(--muted)}dl{display:grid;grid-template-columns:140px 1fr;gap:12px}dt{color:var(--muted)}dd{margin:0;overflow-wrap:anywhere}.edition-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:16px}article{padding:20px;border:1px solid var(--line);border-radius:10px}article dl{grid-template-columns:120px 1fr;font-size:.85rem}@media(max-width:480px){dl{grid-template-columns:1fr;gap:6px}dd{margin-bottom:10px}}</style>
