<!--
  ============================================
  PwaInstallBanner - App-Installations-Banner
  ============================================
  Zeigt einen dezenten Banner mit "Installieren"-Button,
  wenn die App installierbar ist. Der User kann ihn für
  7 Tage ausblenden.
-->
<template>
  <Transition name="slide-up">
    <div
      v-if="canInstall && !dismissed"
      class="right-4 bottom-4 left-4 z-50 fixed mx-auto max-w-sm"
    >
      <div class="flex items-center gap-3 bg-white dark:bg-stone-800 shadow-lg p-4 border border-stone-200 dark:border-stone-700 rounded-xl">
        <!-- App-Icon -->
        <div class="flex justify-center items-center bg-stone-100 dark:bg-stone-700 rounded-lg w-12 h-12 shrink-0">
          <span class="text-2xl">🍳</span>
        </div>

        <!-- Text -->
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-stone-900 dark:text-stone-100 text-sm">Zauberjournal installieren</p>
          <p class="text-stone-500 dark:text-stone-400 text-xs">Als App auf dem Homescreen nutzen</p>
        </div>

        <!-- Buttons -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Schließen -->
          <button
            class="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            title="Später erinnern"
            @click="dismissInstall"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <!-- Installieren -->
          <button
            class="bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg font-medium text-white text-sm transition-colors"
            @click="handleInstall"
          >
            Installieren
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { useInstallPrompt } from '@/composables/useInstallPrompt.js';

const { canInstall, dismissed, installApp, dismissInstall } = useInstallPrompt();

async function handleInstall() {
  await installApp();
}
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(1rem);
}
</style>
