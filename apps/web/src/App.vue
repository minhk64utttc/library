<script setup lang="ts">
import { ref } from 'vue';
import { router } from './app/router';

const navigationFailed = ref(false);
router.onError(() => { navigationFailed.value = true; });

function retry(): void {
  window.location.reload();
}
</script>

<template>
  <main v-if="navigationFailed" class="public-layout">
    <section class="change-password" role="alert">
      <h1>Chưa tải được trang</h1>
      <p>Kết nối tới hệ thống bị gián đoạn. Vui lòng tải lại để tiếp tục.</p>
      <button type="button" @click="retry">Tải lại</button>
    </section>
  </main>
  <RouterView v-else />
</template>
