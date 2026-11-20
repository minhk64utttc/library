<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { WorkspaceTaskDto } from '@thu-vien/shared';
import { apiFetch } from '@/shared/api/client';
import { RouterLink } from 'vue-router';

import { NAV_ITEMS } from '@/app/navigation';
import { useSessionStore } from '@/features/auth/session.store';

const session = useSessionStore();
const tasks = ref<WorkspaceTaskDto[]>([]);
const loading = ref(true);
const error = ref('');
async function loadTasks(): Promise<void> {
  loading.value = true;
  error.value = '';
  try { tasks.value = await apiFetch<WorkspaceTaskDto[]>('/me/workspace'); }
  catch { error.value = 'Không tải được việc cần làm. Bạn vẫn có thể mở các nghiệp vụ bên dưới.'; }
  finally { loading.value = false; }
}
onMounted(() => void loadTasks());
const moduleDescriptions: Record<string, string> = {
  '/catalog/records': 'Tạo bản ghi, xét duyệt và công bố tài liệu.',
  '/catalog/publishers': 'Quản lý thông tin nhà xuất bản.',
  '/holdings': 'Theo dõi bản sao, vị trí và mã xếp giá.',
  '/incidents': 'Ghi nhận, tra soát và quyết định xử lý sự cố tài liệu.',
  '/inventory': 'Quét mã cuốn, đối soát vị trí và tra soát bản sao chưa thấy.',
  '/circulation/loans': 'Ghi nhận mượn, trả và gia hạn tài liệu.',
  '/circulation/cards': 'Cấp, gia hạn và quản lý trạng thái thẻ bạn đọc.',
  '/circulation/reservations': 'Theo dõi hàng chờ và giữ sách.',
  '/circulation/fines': 'Xem và xử lý các khoản phạt.',
  '/digital/submissions': 'Tiếp nhận, xét duyệt và công bố học liệu số.',
  '/management/reports': 'Theo dõi mượn trả, tiền phạt và tình hình kho.',
  '/management/audit': 'Tra cứu người thực hiện và lịch sử thao tác.',
  '/accounts': 'Tạo tài khoản, gán quyền và quản lý đăng nhập.',
  '/management/policies': 'Thiết lập chính sách mượn và lịch phục vụ.',
};
const availableModules = computed(() =>
  NAV_ITEMS.filter((item) => item.to !== '/' && ((!item.permission || session.can(item.permission)) || (item.alternatePermission && session.can(item.alternatePermission)))),
);
</script>

<template>
  <section class="home">
    <div class="home__intro">
      <span class="eyebrow">Trường Đại học Giao thông Vận tải</span>
      <h1>Không gian làm việc của thư viện</h1>
      <p v-if="session.account">Xin chào {{ session.account.fullName }}. Chọn nghiệp vụ để bắt đầu.</p>
    </div>

    <div class="home__section-head"><h2>Việc cần làm</h2><p>Số liệu hiện tại theo quyền tài khoản.</p></div>
    <div v-if="loading" class="task-grid" role="status" aria-label="Đang tải việc cần làm"><div v-for="n in 3" :key="n" class="task-card skeleton"></div></div>
    <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="loadTasks">Thử lại</button></p>
    <div v-else-if="tasks.length" class="task-grid">
      <RouterLink v-for="task in tasks" :key="task.to" :to="task.to" class="task-card"><strong>{{ task.count }}</strong><span>{{ task.label }}</span><small>Mở danh sách →</small></RouterLink>
    </div>
    <p v-else class="empty-state">Bạn có thể tra cứu tài liệu hoặc theo dõi khoản mượn trong <RouterLink to="/me/loans">tài khoản của tôi</RouterLink>.</p>
    <div class="home__section-head">
      <h2>Truy cập nhanh</h2>
      <p>Các mục hiển thị theo quyền tài khoản.</p>
    </div>
    <div v-if="availableModules.length" class="home__modules">
      <RouterLink v-for="item in availableModules" :key="item.to" class="home__module" :to="item.to">
        <strong>{{ item.label }}</strong>
        <span>{{ moduleDescriptions[item.to] }}</span>
        <span class="home__module-arrow" aria-hidden="true">→</span>
      </RouterLink>
    </div>
    <p v-else class="empty-state">Tài khoản chưa có nghiệp vụ được phân quyền.</p>
  </section>
</template>

<style scoped>
.task-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin: 20px 0 32px; }
.task-card { display: grid; gap: 10px; min-height: 145px; padding: 22px; border: 1px solid var(--line); border-top: 3px solid var(--gold); border-radius: 10px; text-decoration: none; background: #f8faff; }
.task-card strong { font-size: 2rem; font-variant-numeric: tabular-nums; }
.task-card small { color: var(--muted); }
.skeleton { background: linear-gradient(100deg, #edf1f7 30%, #fafbfd 50%, #edf1f7 70%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
</style>
