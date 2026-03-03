/**
 * ============================================
 * Vue 3 App - Einstiegspunkt
 * ============================================
 * Initialisiert Vue App mit Router, Pinia und globalen Styles.
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import router from './router/index.js';
import App from './App.vue';
import { syncManager } from './services/syncManager.js';
import { registerSyncHandlers } from './services/syncHandlers.js';

// Tailwind CSS 4 Styles laden
import './assets/styles/main.css';

// Vue App erstellen
const app = createApp(App);

// Pinia State Management mit Persistierung
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);

// Offline-Sync-Handlers registrieren und Manager starten
registerSyncHandlers();
syncManager.init();

// Vue Router
app.use(router);

// App in #app Element mounten
app.mount('#app');
