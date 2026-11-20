import type { RouteRecordRaw } from 'vue-router';

export const circulationRoutes: RouteRecordRaw[] = [
  {
    path: 'management/policies',
    name: 'management-policies',
    component: () => import('./pages/PoliciesPage.vue'),
  },
  {
    path: 'circulation/receipts/:id',
    name: 'circulation-fine-receipt',
    component: () => import('./pages/FineReceiptPage.vue'),
  },
  {
    path: 'circulation/cards',
    name: 'circulation-cards',
    component: () => import('./pages/CardsPage.vue'),
  },
  {
    path: 'circulation/loans',
    name: 'circulation-loans',
    component: () => import('./pages/LoansPage.vue'),
  },
  {
    path: 'circulation/reservations',
    name: 'circulation-reservations',
    component: () => import('./pages/ReservationsPage.vue'),
  },
  {
    path: 'circulation/fines',
    name: 'circulation-fines',
    component: () => import('./pages/FinesPage.vue'),
  },
];
