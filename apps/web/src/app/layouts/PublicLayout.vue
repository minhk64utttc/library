<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import { useSessionStore } from '@/features/auth/session.store';
import AccountMenu from '@/shared/components/AccountMenu.vue';

const session = useSessionStore();
</script>

<template>
  <div class="public-layout">
    <header class="public-layout__header">
      <RouterLink class="public-layout__brand" to="/search">
        <img src="/img/utc-logo.png" alt="" width="68" height="46" />
        <span><strong>Cổng bạn đọc</strong><small>Thư viện · Đại học Giao thông Vận tải</small></span>
      </RouterLink>
      <nav aria-label="Điều hướng công khai">
        <RouterLink to="/search" active-class="public-layout__active">Tra cứu</RouterLink>
        <RouterLink to="/digital/library" active-class="public-layout__active">Học liệu số</RouterLink>
        <AccountMenu v-if="session.isAuthenticated" />
        <RouterLink v-else :to="{ name: 'login', query: { redirect: '/search' } }">Đăng nhập</RouterLink>
      </nav>
    </header>
    <main class="public-layout__main"><RouterView /></main>
    <footer class="public-layout__footer">Thư viện · Trường Đại học Giao thông Vận tải</footer>
  </div>
</template>

<style scoped>
.public-layout { min-height: 100vh; display: flex; flex-direction: column; color: var(--ink); background: var(--canvas); }
.public-layout__header { display: flex; width: 100%; min-height: 72px; justify-content: space-between; align-items: center; gap: 20px; padding: 13px clamp(18px, 5vw, 72px); background: #fff; border-bottom: 1px solid var(--line); }
.public-layout__brand { display: flex; flex: 0 0 auto; align-items: center; gap: 12px; color: var(--navy-deep); text-decoration: none; }
.public-layout__brand img { width: 68px; height: 46px; object-fit: contain; }
.public-layout__brand span { display: grid; gap: 2px; }
.public-layout__brand strong { font-size: 1rem; }
.public-layout__brand small { color: var(--muted); font-size: .7rem; }
.public-layout__header nav { display: flex; flex: 0 0 auto; flex-wrap: nowrap; align-items: center; gap: 8px; }
.public-layout__header nav > a { flex: 0 0 auto; padding: 9px 12px; color: var(--navy); border-radius: 8px; font-size: .83rem; font-weight: 600; text-decoration: none; white-space: nowrap; }
.public-layout__header nav > a:hover { background: #f4f6fa; }
.public-layout__header nav > a.public-layout__active { background: #edf2fa; box-shadow: inset 0 -2px var(--navy); }
.public-layout__main { width: min(1120px, calc(100% - 36px)); flex: 1; margin: 28px auto 44px; padding: clamp(18px, 3vw, 32px); background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 12px 36px #2a42700c; }
.public-layout__footer { padding: 18px; color: var(--muted); text-align: center; font-size: .76rem; }
@media (max-width: 900px) { .public-layout__header { align-items: flex-start; flex-wrap: wrap; gap: 10px 16px; } .public-layout__header nav { width: 100%; flex: 1 0 100%; justify-content: flex-start; } }
@media (max-width: 540px) { .public-layout__header { gap: 12px; padding: 14px 18px; } .public-layout__brand small { max-width: 220px; } .public-layout__header nav { gap: 4px; } .public-layout__header nav > a { padding-inline: 9px; } .public-layout__main { width: calc(100% - 20px); margin-block: 12px 26px; padding: 15px; } }
</style>
