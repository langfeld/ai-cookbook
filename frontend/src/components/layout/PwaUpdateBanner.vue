<!--
  ============================================
  PwaUpdateBanner - App-Update-Hinweis
  ============================================
  Zeigt einen Banner, wenn ein neuer Service Worker
  bereitsteht und die App aktualisiert werden kann.
-->
<template>
  <Transition name="slide-down">
    <div
      v-if="hasUpdate"
      class="top-0 left-0 z-60 fixed w-full"
    >
      <div class="flex justify-center items-center gap-3 bg-blue-600 dark:bg-blue-700 px-4 py-2 text-white text-sm text-center">
        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>Neue Version verfügbar</span>
        <button
          class="bg-white/20 hover:bg-white/30 px-3 py-0.5 rounded font-medium text-xs transition-colors"
          @click="updateApp"
        >
          Jetzt aktualisieren
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { useAppUpdate } from '@/composables/useAppUpdate.js';

const { hasUpdate, updateApp } = useAppUpdate();
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
