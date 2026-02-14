/**
 * ============================================
 * Vite Konfiguration
 * ============================================
 * Konfiguriert Vue 3 Plugin und Tailwind CSS 4 Integration
 */

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    // Vue 3 Single File Components
    vue(),
    // Tailwind CSS 4 (neuer Vite-Plugin-Ansatz)
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // @/ Alias für src/ Verzeichnis
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    // API-Anfragen an Backend weiterleiten (Entwicklung)
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
