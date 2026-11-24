<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { ReportSummaryDto, WorkspaceTaskDto } from '@thu-vien/shared';
import { apiFetch } from '@/shared/api/client';
import { RouterLink } from 'vue-router';

import { NAV_ITEMS } from '@/app/navigation';
import { useSessionStore } from '@/features/auth/session.store';
import { getReportSummary } from '@/features/management/api';

const session = useSessionStore();
const tasks = ref<WorkspaceTaskDto[]>([]);
const loading = ref(true);
const error = ref('');
const report = ref<ReportSummaryDto | null>(null);
const reportError = ref('');
const reportLoading = ref(false);
const canSeeReports = computed(() => session.can('reports:read'));
const maxMonthly = computed(() => Math.max(1, ...(report.value?.monthlyActivity.map((month) => Math.max(month.borrowed, month.returned)) ?? [1])));
async function loadTasks(): Promise<void> {
  loading.value = true;
  error.value = '';
  try { tasks.value = await apiFetch<WorkspaceTaskDto[]>('/me/workspace'); }
  catch { error.value = 'Không tải được việc cần làm. Bạn vẫn có thể mở các nghiệp vụ bên dưới.'; }
  finally { loading.value = false; }
}
onMounted(() => void loadTasks());
async function loadReport(): Promise<void> {
  if (!canSeeReports.value) return;
  reportLoading.value = true;
  reportError.value = '';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  try { report.value = await getReportSummary({ from: `${today.slice(0, 4)}-01-01`, to: today }); }
  catch { reportError.value = 'Chưa tải được số liệu tổng quan.'; }
  finally { reportLoading.value = false; }
}
onMounted(() => void loadReport());
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

    <section v-if="canSeeReports" class="dashboard" aria-labelledby="dashboard-title">
      <div class="home__section-head"><div><h2 id="dashboard-title">Tổng quan thư viện</h2><p>Số liệu cập nhật theo dữ liệu lưu thông từ đầu năm đến nay.</p></div><RouterLink to="/management/reports">Mở báo cáo →</RouterLink></div>
      <p v-if="reportLoading" class="dashboard__loading" role="status">Đang tải số liệu…</p>
      <p v-else-if="reportError" role="alert">{{ reportError }} <button type="button" @click="loadReport">Thử lại</button></p>
      <template v-else-if="report">
        <div class="dashboard__metrics" aria-label="Chỉ số thư viện">
          <article><span>Đầu sách</span><strong>{{ report.totalWorks.toLocaleString('vi-VN') }}</strong></article>
          <article><span>Đang cho mượn</span><strong>{{ report.activeLoans.toLocaleString('vi-VN') }}</strong></article>
          <article><span>Quá hạn</span><strong>{{ report.overdueCount.toLocaleString('vi-VN') }}</strong></article>
          <article><span>Thẻ bạn đọc</span><strong>{{ report.readerCount.toLocaleString('vi-VN') }}</strong></article>
        </div>
        <div class="dashboard__charts">
          <section class="dashboard__panel"><h3>Mượn và trả theo tháng</h3>
            <div class="dashboard__legend"><span><i class="dashboard__borrowed"></i>Lượt mượn</span><span><i class="dashboard__returned"></i>Lượt trả</span></div>
            <div class="dashboard__chart" role="img" aria-label="Biểu đồ cột lượt mượn và trả theo tháng">
              <div v-for="month in report.monthlyActivity" :key="month.month" class="dashboard__month"><div class="dashboard__bars"><i class="dashboard__borrowed" :title="`${month.borrowed} lượt mượn`" :style="{ height: `${Math.max(2, month.borrowed / maxMonthly * 100)}%` }"></i><i class="dashboard__returned" :title="`${month.returned} lượt trả`" :style="{ height: `${Math.max(2, month.returned / maxMonthly * 100)}%` }"></i></div><small>T{{ month.month }}</small></div>
            </div>
          </section>
          <section class="dashboard__panel"><h3>Top 5 tài liệu được mượn</h3>
            <ol v-if="report.popularWorks.length" class="dashboard__popular"><li v-for="(work, index) in report.popularWorks.slice(0, 5)" :key="work.title"><span><b>{{ index + 1 }}.</b> {{ work.title }}</span><strong>{{ work.borrowCount }}</strong></li></ol>
            <p v-else class="empty-state">Chưa có lượt mượn trong năm nay.</p>
          </section>
        </div>
      </template>
    </section>
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
.dashboard { margin: 34px 0; }.dashboard__metrics { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0; }.dashboard__metrics article,.dashboard__panel { padding:18px;background:#fff;border:1px solid var(--line);border-radius:10px; }.dashboard__metrics span,.dashboard__metrics strong { display:block; }.dashboard__metrics span { color:var(--muted);font-size:.82rem; }.dashboard__metrics strong { margin-top:8px;color:var(--navy-deep);font-size:1.75rem; }.dashboard__charts { display:grid;grid-template-columns:1.2fr 1fr;gap:14px; }.dashboard__panel h3 { margin:0 0 16px;font-size:1rem; }.dashboard__legend { display:flex;gap:18px;color:var(--muted);font-size:.78rem; }.dashboard__legend span { display:flex;align-items:center;gap:6px; }.dashboard__legend i { width:10px;height:10px;border-radius:2px; }.dashboard__borrowed { background:#315b9b; }.dashboard__returned { background:#d4a63e; }.dashboard__chart { display:grid;grid-template-columns:repeat(12,minmax(0,1fr));align-items:end;gap:6px;height:175px;margin-top:8px;padding-top:12px;border-bottom:1px solid var(--line); }.dashboard__month { display:grid;grid-template-rows:1fr auto;gap:6px;height:100%;text-align:center;color:var(--muted); }.dashboard__month small { font-size:.68rem; }.dashboard__bars { display:flex;align-items:end;justify-content:center;gap:3px;height:100%; }.dashboard__bars i { width:min(12px,35%);min-height:2px;border-radius:3px 3px 0 0; }.dashboard__popular { display:grid;gap:9px;padding:0;margin:0;list-style:none; }.dashboard__popular li { display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line);font-size:.84rem; }.dashboard__popular li span { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }.dashboard__popular li b { color:var(--muted); }.dashboard__loading { color:var(--muted); }
@media(max-width:760px) { .dashboard__metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }.dashboard__charts { grid-template-columns:1fr; } }
</style>
