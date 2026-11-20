import type { RouteRecordRaw } from 'vue-router';

export const holdingsRoutes: RouteRecordRaw[] = [
  {
    path: 'holdings',
    name: 'holdings',
    component: () => import('./pages/HoldingsPage.vue'),
  },
];
