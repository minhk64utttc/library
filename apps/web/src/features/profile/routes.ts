import type { RouteRecordRaw } from 'vue-router';

export const profileRoutes: RouteRecordRaw[] = [
  {
    path: '/me',
    component: () => import('@/app/layouts/ReaderLayout.vue'),
    children: [
      { path: 'profile', name: 'my-profile', component: () => import('./pages/MyProfilePage.vue') },
      { path: 'security', name: 'my-security', component: () => import('@/features/auth/pages/ChangePasswordPage.vue') },
      { path: 'loans', name: 'my-loans', component: () => import('./pages/MyLoansPage.vue') },
      { path: 'reservations', name: 'my-reservations', component: () => import('./pages/MyReservationsPage.vue') },
      { path: 'fines', name: 'my-fines', component: () => import('./pages/MyFinesPage.vue') },
      { path: 'notifications', name: 'my-notifications', component: () => import('./pages/MyNotificationsPage.vue') },
      { path: 'digital', name: 'my-digital-submissions', component: () => import('@/features/digital/pages/MyDigitalSubmissionsPage.vue') },
      { path: 'receipts/:id', name: 'my-fine-receipt', component: () => import('@/features/circulation/pages/FineReceiptPage.vue') },
    ],
  },
];
