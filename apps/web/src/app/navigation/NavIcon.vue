<script setup lang="ts">
defineProps<{ name: 'home' | 'catalog' | 'holdings' | 'circulation' | 'admin' }>();
</script>

<template>
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'home'">
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z" />
      <path d="M9 21v-7h6v7" />
    </template>
    <template v-else-if="name === 'catalog'">
      <path d="M4 5.5c2.8-1.2 5.5-.9 8 1v13c-2.5-1.9-5.2-2.2-8-1V5.5ZM20 5.5c-2.8-1.2-5.5-.9-8 1v13c2.5-1.9 5.2-2.2 8-1V5.5Z" />
      <path d="M6.5 9h2.8M15 9h2.5" />
    </template>
    <template v-else-if="name === 'holdings'">
      <path d="M4 5h16v4H4zM5.5 9v11h13V9M10 13h4" />
      <path d="M3 5V3h18v2" />
    </template>
    <template v-else-if="name === 'admin'">
      <path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </template>
    <template v-else>
      <path d="M4 7h14l-3-3M20 17H6l3 3" />
      <path d="m18 7-3 3M6 17l3-3" />
    </template>
  </svg>
</template>
