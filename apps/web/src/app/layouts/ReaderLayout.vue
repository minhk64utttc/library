<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import NotificationBell from '@/shared/components/NotificationBell.vue';
import AccountMenu from '@/shared/components/AccountMenu.vue';
</script>

<template>
  <div class="reader-layout">
    <a class="skip-link" href="#reader-content">Bỏ qua điều hướng</a>
    <header class="reader-layout__header">
      <RouterLink class="reader-layout__brand" to="/search">
        <img src="/img/utc-logo.png" alt="" width="68" height="46" />
        <span><strong>Cổng bạn đọc</strong><small>Thư viện · Đại học Giao thông Vận tải</small></span>
      </RouterLink>
      <nav aria-label="Điều hướng khu vực bạn đọc">
        <RouterLink to="/search">Tra cứu</RouterLink>
        <RouterLink to="/digital/library">Học liệu số</RouterLink>
        <NotificationBell />
        <AccountMenu />
      </nav>
    </header>
    <main id="reader-content" class="reader-layout__main"><RouterView /></main>
    <footer class="reader-layout__footer">Thư viện · Trường Đại học Giao thông Vận tải</footer>
  </div>
</template>

<style scoped>
.reader-layout { min-height: 100vh; display: flex; flex-direction: column; color: var(--ink); background: var(--canvas); }
.reader-layout__header { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 13px clamp(18px, 5vw, 72px); background: #fff; border-bottom: 1px solid var(--line); }
.reader-layout__brand { display: flex; align-items: center; gap: 12px; color: var(--navy-deep); text-decoration: none; }
.reader-layout__brand img { width: 68px; height: 46px; object-fit: contain; }
.reader-layout__brand span { display: grid; gap: 2px; }
.reader-layout__brand strong { font-size: 1rem; }
.reader-layout__brand small { color: var(--muted); font-size: .7rem; }
.reader-layout__header nav { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
.reader-layout__header nav a { padding: 9px 11px; color: var(--navy); border-radius: 8px; font-size: .8rem; font-weight: 600; text-decoration: none; }
.reader-layout__header nav a:hover, .reader-layout__header nav .reader-layout__active { background: #edf2fa; }
.reader-layout__header nav button { min-height: 36px; padding: 7px 11px; font-size: .78rem; }
.reader-layout__main { width: min(1080px, calc(100% - 36px)); flex: 1; margin: 28px auto 44px; padding: clamp(18px, 3vw, 34px); background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 12px 36px #2a42700c; }
.reader-layout__footer { padding: 18px; color: var(--muted); text-align: center; font-size: .76rem; }
@media (max-width: 700px) { .reader-layout__header { align-items: flex-start; } .reader-layout__header nav { justify-content: flex-end; } }
@media (max-width: 520px) { .reader-layout__brand small { max-width: 145px; } .reader-layout__header nav { gap: 2px; } .reader-layout__header nav a { padding-inline: 7px; } .reader-layout__main { width: calc(100% - 20px); margin-block: 12px 26px; padding: 15px; } }
@media (max-width: 700px) { .reader-layout__header { flex-wrap: wrap; } .reader-layout__header nav { width: 100%; justify-content: flex-start; } }
</style>
