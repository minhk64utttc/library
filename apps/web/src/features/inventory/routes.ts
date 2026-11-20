import type { RouteRecordRaw } from 'vue-router';
export const inventoryRoutes: RouteRecordRaw[] = [
  { path: 'inventory', name: 'inventory', component: () => import('./pages/InventoryPage.vue') },
  { path: 'inventory/:id', name: 'inventory-detail', component: () => import('./pages/InventoryPage.vue') },
];
