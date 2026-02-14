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
          <!-- Sidebar Navigation -->
          <AppSidebar
            :is-collapsed="sidebarCollapsed"
            @toggle="sidebarCollapsed = !sidebarCollapsed"
          />

          <!-- Hauptbereich -->
          <div class="flex flex-col flex-1 overflow-hidden">
            <!-- Header mit Suche und Theme-Toggle -->
            <AppHeader @toggle-sidebar="sidebarCollapsed = !sidebarCollapsed" />

            <!-- Seiteninhalt -->
            <main class="flex-1 p-4 lg:p-6 overflow-y-auto">
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
import { ref, onMounted } from 'vue';
import { RouterView } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useTheme } from '@/composables/useTheme.js';
import AppSidebar from '@/components/layout/AppSidebar.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import NotificationToast from '@/components/layout/NotificationToast.vue';

const authStore = useAuthStore();
const { isDark } = useTheme();
const sidebarCollapsed = ref(false);

// Auth-Status beim App-Start prüfen
onMounted(() => {
  authStore.checkAuth();
});
</script>
