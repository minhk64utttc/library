import type { RouteRecordRaw } from 'vue-router';

export const catalogRoutes: RouteRecordRaw[] = [
  {
    path: 'catalog/records',
    name: 'catalog-records',
    component: () => import('./pages/RecordsListPage.vue'),
  },
  {
    path: 'catalog/records/new',
    name: 'catalog-record-new',
    component: () => import('./pages/RecordFormPage.vue'),
  },
  {
    path: 'catalog/records/:id/view',
    name: 'catalog-record-detail',
    component: () => import('./pages/RecordDetailPage.vue'),
  },
  {
    path: 'catalog/records/:id',
    name: 'catalog-record-edit',
    component: () => import('./pages/RecordFormPage.vue'),
  },
  {
    path: 'catalog/publishers',
    name: 'catalog-publishers',
    component: () => import('./pages/PublishersPage.vue'),
  },
];
