import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import { router } from './app/router';
import './styles.css';

// An open tab can reference chunks removed by a newer deployment.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'library-chunk-reload';
  const lastRetry = Number(sessionStorage.getItem(key) ?? 0);
  if (Date.now() - lastRetry > 60_000) {
    event.preventDefault();
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
});

createApp(App).use(createPinia()).use(router).mount('#app');
