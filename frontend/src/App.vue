<!--
  ============================================
  App.vue - Haupt-App-Komponente
  ============================================
  Layout mit Sidebar, Header und Hauptinhalt.
  Verwaltet Theme-Toggle und Auth-Status.
-->
<template>
  <!-- Wrapper mit Dark-Mode Klasse -->
  <div :class="{ dark: isDark }" class="min-h-screen">
    <div class="bg-stone-50 dark:bg-stone-950 min-h-screen transition-colors duration-300">

      <!-- Login-Ansicht (kein Layout) -->
      <template v-if="!authStore.isLoggedIn">
        <RouterView />
      </template>

      <!-- App-Layout (nach Login) -->
      <template v-else>
        <div class="flex h-screen overflow-hidden">

          <!-- Offline-Banner -->
          <Transition name="slide-down">
            <div
              v-if="!isOnline"
              class="top-0 right-0 left-0 z-50 fixed flex justify-center items-center gap-2 bg-amber-500 dark:bg-amber-600 shadow-md px-4 py-1.5 text-white text-sm text-center"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 12h.01" />
              </svg>
              <span>Offline – Änderungen werden bei Verbindung synchronisiert</span>
              <span v-if="pendingCount > 0" class="bg-white/20 ml-1 px-2 py-0.5 rounded-full font-medium text-xs">
                {{ pendingCount }} ausstehend
              </span>
            </div>
          </Transition>

          <!-- Sync-Erfolg Flash -->
          <Transition name="slide-down">
            <div
              v-if="justReconnected && pendingCount === 0"
              class="top-0 right-0 left-0 z-50 fixed bg-emerald-500 dark:bg-emerald-600 shadow-md px-4 py-1.5 text-white text-sm text-center"
            >
              ✓ Wieder online – alles synchronisiert
            </div>
          </Transition>

          <!-- Mobile Backdrop -->
          <Transition name="fade">
            <div
              v-if="mobileMenuOpen"
              class="lg:hidden z-40 fixed inset-0 bg-black/50 backdrop-blur-sm"
              @click="mobileMenuOpen = false"
            />
          </Transition>

          <!-- Sidebar Navigation -->
          <AppSidebar
            :is-collapsed="sidebarCollapsed"
            :is-mobile-open="mobileMenuOpen"
            @toggle="sidebarCollapsed = !sidebarCollapsed"
            @close-mobile="mobileMenuOpen = false"
          />

          <!-- Hauptbereich -->
          <div class="flex flex-col flex-1 w-0 overflow-hidden">
            <!-- Header mit Suche und Theme-Toggle -->
            <AppHeader @toggle-sidebar="toggleSidebar" />

            <!-- Seiteninhalt -->
            <main ref="mainContent" class="flex-1 p-4 lg:p-6 overflow-y-auto">
              <RouterView v-slot="{ Component }">
                <Transition name="page" mode="out-in">
                  <component :is="Component" />
                </Transition>
              </RouterView>
            </main>
          </div>
        </div>

        <!-- Benachrichtigungen -->
        <NotificationToast />
      </template>
    </div>
  </div>
</template>

<script setup>
/**
 * App Setup:
 * - Prüft Auth-Status beim Start
 * - Verwaltet Sidebar und Theme
 */
import { ref, onMounted, watch } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useTheme } from '@/composables/useTheme.js';
import { useNetworkStatus } from '@/composables/useNetworkStatus.js';
import { offlineQueue } from '@/services/offlineQueue.js';
import AppSidebar from '@/components/layout/AppSidebar.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import NotificationToast from '@/components/layout/NotificationToast.vue';

const authStore = useAuthStore();
const { isDark } = useTheme();
const { isOnline, justReconnected } = useNetworkStatus();
const { pendingCount } = offlineQueue;
const sidebarCollapsed = ref(false);
const mobileMenuOpen = ref(false);
const mainContent = ref(null);
const router = useRouter();

// Bei Seitenwechsel zum Anfang scrollen
watch(() => router.currentRoute.value.fullPath, () => {
  mainContent.value?.scrollTo({ top: 0 });
});

// Sidebar-Toggle: Auf Mobile → Overlay, auf Desktop → Collapse
function toggleSidebar() {
  if (window.innerWidth < 1024) {
    mobileMenuOpen.value = !mobileMenuOpen.value;
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }
}

// Auth-Status beim App-Start prüfen
onMounted(() => {
  authStore.checkAuth();
});
</script>
