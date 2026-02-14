/**
 * ============================================
 * Vue 3 App - Einstiegspunkt
 * ============================================
 * Initialisiert Vue App mit Router, Pinia und globalen Styles.
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router/index.js';
import App from './App.vue';

// Tailwind CSS 4 Styles laden
import './assets/styles/main.css';

// Vue App erstellen
const app = createApp(App);

// Pinia State Management
app.use(createPinia());

// Vue Router
app.use(router);

// App in #app Element mounten
app.mount('#app');
