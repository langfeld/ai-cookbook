/**
 * ============================================
 * Vite Konfiguration
 * ============================================
 * Konfiguriert Vue 3 Plugin, Tailwind CSS 4 und PWA Service Worker
 */

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    // Vue 3 Single File Components
    vue(),
    // Tailwind CSS 4 (neuer Vite-Plugin-Ansatz)
    tailwindcss(),
    // PWA — Service Worker für Offline-Asset-Caching
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // Alle Build-Assets cachen (JS, CSS, HTML, Bilder, Fonts)
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff,woff2}'],
        // Navigations-Anfragen auf index.html umleiten (SPA-Fallback)
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Runtime-Caching für API-Responses (optional, kurze TTL)
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300, // 5 Minuten
              },
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      manifest: {
        name: 'Zauberjournal',
        short_name: 'Zauberjournal',
        description: 'KI-gestützte Rezeptverwaltung mit Wochenplaner, Einkaufsliste und Offline-Modus',
        theme_color: '#1c1917',
        background_color: '#fafaf9',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
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
