import type { RouteRecordRaw } from 'vue-router';

export const digitalRoutes: RouteRecordRaw[] = [
  {
    path: 'digital/submissions',
    name: 'digital-submissions',
    component: () => import('./pages/DigitalStaffPage.vue'),
  },
];
