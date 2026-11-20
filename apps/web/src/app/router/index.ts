import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

import { accountsRoutes } from '@/features/accounts/routes';
import { authRoutes } from '@/features/auth/routes';
import { useSessionStore } from '@/features/auth/session.store';
import { catalogRoutes } from '@/features/catalog/routes';
import { circulationRoutes } from '@/features/circulation/routes';
import { holdingsRoutes } from '@/features/holdings/routes';
import { incidentRoutes } from '@/features/incidents/routes';
import { inventoryRoutes } from '@/features/inventory/routes';
import { digitalRoutes } from '@/features/digital/routes';
import { managementRoutes } from '@/features/management/routes';
import { publicRoutes } from '@/features/public/routes';
import { profileRoutes } from '@/features/profile/routes';

const routes: RouteRecordRaw[] = [
  ...publicRoutes,
  ...profileRoutes,
  ...authRoutes,
  {
    path: '/',
    component: () => import('@/app/layouts/StaffLayout.vue'),
    meta: { workspace: true },
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/features/dashboard/pages/HomePage.vue'),
      },
      { path: 'account/profile', name: 'staff-profile', component: () => import('@/features/profile/pages/MyProfilePage.vue'), meta: { title: 'Hồ sơ cá nhân' } },
      { path: 'account/security', name: 'staff-security', component: () => import('@/features/auth/pages/ChangePasswordPage.vue'), meta: { title: 'Bảo mật tài khoản' } },
      { path: 'account/notifications', name: 'staff-notifications', component: () => import('@/features/profile/pages/MyNotificationsPage.vue'), meta: { title: 'Thông báo' } },
      ...catalogRoutes,
      ...holdingsRoutes,
      ...incidentRoutes,
      ...inventoryRoutes,
      ...digitalRoutes,
      ...managementRoutes,
      ...circulationRoutes,
      ...accountsRoutes,
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const session = useSessionStore();

  if (!session.initialized) {
    await session.load();
  }

  const isPublic = to.meta.public === true;

  if (!isPublic && !session.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (session.isAuthenticated && session.mustChangePassword && !['change-password', 'staff-security', 'my-security'].includes(String(to.name))) {
    return { name: 'change-password' };
  }

  if (to.name === 'login' && session.isAuthenticated) {
    return { name: session.account?.roles.some(role => role !== 'reader') ? 'home' : 'my-loans' };
  }

  const hasStaffRole = session.account?.roles.some(role => role !== 'reader');
  if (session.isAuthenticated && to.name === 'change-password' && !session.mustChangePassword) return { name: hasStaffRole ? 'staff-security' : 'my-security' };
  if (session.isAuthenticated && to.meta.workspace && !hasStaffRole) return { name: 'my-loans' };
  if (session.isAuthenticated && hasStaffRole && !session.account?.roles.includes('reader')) {
    if (to.name === 'my-profile') return { name: 'staff-profile', query: to.query };
    if (to.name === 'my-security') return { name: 'staff-security' };
  }

  return true;
});
