import type { RouteRecordRaw } from 'vue-router';

export const publicRoutes: RouteRecordRaw[] = [
  {
    path: '/digital/library',
    component: () => import('@/app/layouts/PublicLayout.vue'),
    meta: { public: true },
    children: [{ path: '', name: 'digital-public-library', component: () => import('@/features/digital/pages/DigitalLibraryPage.vue') }],
  },
  {
    path: '/search',
    component: () => import('@/app/layouts/PublicLayout.vue'),
    meta: { public: true },
    children: [{ path: '', name: 'public-search', component: () => import('./pages/SearchPage.vue') }],
  },
  {
    path: '/books/:id',
    component: () => import('@/app/layouts/PublicLayout.vue'),
    meta: { public: true },
    children: [{ path: '', name: 'public-book-detail', component: () => import('./pages/BookDetailPage.vue') }],
  },
];
