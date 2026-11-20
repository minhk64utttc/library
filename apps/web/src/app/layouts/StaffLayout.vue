<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';

import { useSessionStore } from '@/features/auth/session.store';
import NavIcon from '../navigation/NavIcon.vue';
import { NAV_GROUPS, NAV_ITEMS } from '../navigation';
import CommandPalette from '@/shared/components/CommandPalette.vue';
import NotificationBell from '@/shared/components/NotificationBell.vue';
import AccountMenu from '@/shared/components/AccountMenu.vue';

const session = useSessionStore();
const route = useRoute();
const sidebarCollapsed = ref(false);
const mobileMenuOpen = ref(false);
const sidebarElement = ref<HTMLElement | null>(null);
const mobileMenuButton = ref<HTMLButtonElement | null>(null);
const expandedGroup = ref<string | null>(null);

const visibleGroups = computed(() =>
  NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      (!item.permission || session.can(item.permission)) ||
      (item.alternatePermission !== undefined && session.can(item.alternatePermission)),
    ),
  })).filter((group) => group.items.length > 0),
);

const pageTitle = computed(() =>
  typeof route.meta.title === 'string'
    ? route.meta.title
    : NAV_ITEMS.find((item) => route.path === item.to || (item.to !== '/' && route.path.startsWith(`${item.to}/`)))?.label ?? 'Thư viện',
);

watch(
  () => route.path,
  (path) => {
    const activeGroup = NAV_GROUPS.find((group) =>
      group.items.some((item) => path === item.to || path.startsWith(`${item.to}/`)),
    );
    if (activeGroup) expandedGroup.value = activeGroup.label;
    mobileMenuOpen.value = false;
  },
  { immediate: true },
);

function toggleGroup(label: string): void {
  if (sidebarCollapsed.value) {
    sidebarCollapsed.value = false;
    expandedGroup.value = label;
    return;
  }
  expandedGroup.value = expandedGroup.value === label ? null : label;
}

async function openMobileMenu(): Promise<void> {
  sidebarCollapsed.value = false;
  mobileMenuOpen.value = true;
  await nextTick();
  sidebarElement.value?.focus();
}

function closeMobileMenu(): void {
  if (!mobileMenuOpen.value) return;
  mobileMenuOpen.value = false;
  mobileMenuButton.value?.focus();
}

</script>

<template>
  <div class="staff-layout" :class="{ 'staff-layout--collapsed': sidebarCollapsed }" @keydown.esc="closeMobileMenu">
    <a class="skip-link" href="#main-content">Bỏ qua điều hướng</a>
    <button
      v-if="mobileMenuOpen"
      class="sidebar-backdrop"
      type="button"
      aria-label="Đóng menu điều hướng"
      @click="closeMobileMenu"
    ></button>

    <aside id="staff-sidebar" ref="sidebarElement" class="sidebar" :class="{ 'sidebar--open': mobileMenuOpen }" tabindex="-1">
      <div class="sidebar__top">
        <RouterLink class="sidebar__brand" to="/" aria-label="Thư viện Trường Đại học Giao thông Vận tải — trang chủ">
          <span class="sidebar__crest"><img src="/img/utc-logo.png" alt="" width="120" height="80" /></span>
          <span class="sidebar__brand-copy">
            <strong>Trường Đại học<br />Giao thông Vận tải</strong>
            <small>Thư viện</small>
          </span>
        </RouterLink>
        <button
          class="sidebar__collapse"
          type="button"
          :aria-label="sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h11" />
          </svg>
        </button>
      </div>

      <nav class="sidebar__nav" aria-label="Điều hướng chính">
        <span class="sidebar__heading">Không gian làm việc</span>
        <RouterLink class="sidebar__item" to="/" aria-label="Trang chủ" @click="mobileMenuOpen = false">
          <NavIcon name="home" />
          <span class="sidebar__item-text">Trang chủ</span>
        </RouterLink>

        <div v-for="(group, index) in visibleGroups" :key="group.label" class="sidebar__group">
          <button
            class="sidebar__item sidebar__group-toggle"
            type="button"
            :aria-label="group.label"
            :aria-expanded="expandedGroup === group.label && !sidebarCollapsed"
            :aria-controls="`sidebar-group-${index}`"
            @click="toggleGroup(group.label)"
          >
            <NavIcon :name="group.icon" />
            <span class="sidebar__item-text">{{ group.label }}</span>
            <svg class="sidebar__chevron" :class="{ 'sidebar__chevron--open': expandedGroup === group.label }" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg>
          </button>
          <Transition name="submenu">
            <ul v-show="expandedGroup === group.label && !sidebarCollapsed" :id="`sidebar-group-${index}`" class="sidebar__sublist">
              <li v-for="item in group.items" :key="item.to">
                <RouterLink :to="item.to" @click="mobileMenuOpen = false">{{ item.label }}</RouterLink>
              </li>
            </ul>
          </Transition>
        </div>
      </nav>
      <div class="sidebar__footer">Cổng nghiệp vụ thư viện</div>
    </aside>

    <div class="staff-layout__content">
      <header class="staff-layout__header">
        <button
          ref="mobileMenuButton"
          class="staff-layout__menu"
          type="button"
          aria-label="Mở menu điều hướng"
          aria-controls="staff-sidebar"
          :aria-expanded="mobileMenuOpen"
          @click="openMobileMenu"
        >
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div class="staff-layout__context">
          <span>Khu nghiệp vụ thư viện</span>
          <strong>{{ pageTitle }}</strong>
        </div>
        <div class="staff-layout__account">
          <CommandPalette />
          <NotificationBell workspace />
          <AccountMenu workspace />
        </div>
      </header>

      <main id="main-content" class="staff-layout__main" tabindex="-1">
        <div class="staff-layout__workspace"><RouterView /></div>
      </main>
    </div>
  </div>
</template>
