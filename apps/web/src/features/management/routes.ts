import type { RouteRecordRaw } from 'vue-router';

export const managementRoutes: RouteRecordRaw[] = [
  { path: 'management/reports', name: 'management-reports', component: () => import('./ReportsPage.vue') },
  { path: 'management/audit', name: 'management-audit', component: () => import('./AuditPage.vue') },
];
