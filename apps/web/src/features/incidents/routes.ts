import type { RouteRecordRaw } from 'vue-router';

export const incidentRoutes: RouteRecordRaw[] = [
  {
    path: 'incidents',
    name: 'incidents',
    component: () => import('./pages/IncidentsPage.vue'),
  },
];
