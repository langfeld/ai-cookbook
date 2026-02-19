<!--
  ============================================
  AppSidebar - Hauptnavigation
  ============================================
  Responsive Sidebar mit Icons und Labels.
  Kann auf mobilen Geräten eingeklappt werden.
-->
<template>
  <aside
    :class="[
      'flex flex-col bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 transition-all duration-300',
      // Mobile: Fixed Overlay
      'fixed inset-y-0 left-0 z-50 lg:static lg:z-auto',
      isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      isCollapsed && !isMobileOpen ? 'lg:w-16' : 'w-64'
    ]"
  >
    <!-- Logo / App-Name -->
    <div class="flex items-center px-4 border-stone-200 dark:border-stone-800 border-b h-16">
      <span class="text-2xl">🍳</span>
      <transition name="page">
        <span
          v-if="!isCollapsed || isMobileOpen"
          class="ml-3 font-display font-bold text-stone-800 dark:text-stone-100 text-lg"
        >
          AI Cookbook
        </span>
      </transition>
      <!-- Mobile: Schließen-Button -->
      <button
        v-if="isMobileOpen"
        @click="$emit('close-mobile')"
        class="lg:hidden hover:bg-stone-100 dark:hover:bg-stone-800 ml-auto p-1.5 rounded-lg"
      >
        <X class="w-5 h-5 text-stone-500" />
      </button>
    </div>

    <!-- Navigations-Links -->
    <nav class="flex-1 space-y-1 py-4 overflow-y-auto">
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :class="[
          'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg transition-colors',
          'hover:bg-primary-50 dark:hover:bg-primary-950/50',
          'text-stone-600 dark:text-stone-400',
          isCollapsed && !isMobileOpen ? 'justify-center' : '',
        ]"
        active-class="!bg-primary-100 dark:!bg-primary-900/50 !text-primary-700 dark:!text-primary-300 font-medium"
        @click="onNavClick"
      >
        <component :is="item.icon" class="w-5 h-5 shrink-0" />
        <span v-if="!isCollapsed || isMobileOpen" class="text-sm">{{ item.label }}</span>

        <!-- Badge für Benachrichtigungen -->
        <span
          v-if="item.badge && (!isCollapsed || isMobileOpen)"
          class="bg-red-100 dark:bg-red-900/50 ml-auto px-2 py-0.5 rounded-full text-red-700 dark:text-red-300 text-xs"
        >
          {{ item.badge }}
        </span>
      </router-link>

      <!-- Admin-Bereich (nur für Admins) -->
      <template v-if="authStore.isAdmin">
        <div class="mx-4 my-3 border-stone-200 dark:border-stone-700 border-t"></div>
        <div v-if="!isCollapsed || isMobileOpen" class="mx-4 mb-1 font-semibold text-stone-400 dark:text-stone-500 text-xs uppercase tracking-wider">
          Admin
        </div>
        <router-link
          v-for="item in adminNavItems"
          :key="item.to"
          :to="item.to"
          :class="[
            'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg transition-colors',
            'hover:bg-amber-50 dark:hover:bg-amber-950/50',
            'text-stone-600 dark:text-stone-400',
            isCollapsed && !isMobileOpen ? 'justify-center' : '',
          ]"
          active-class="!bg-amber-100 dark:!bg-amber-900/50 !text-amber-700 dark:!text-amber-300 font-medium"
          @click="onNavClick"
        >
          <component :is="item.icon" class="w-5 h-5 shrink-0" />
          <span v-if="!isCollapsed || isMobileOpen" class="text-sm">{{ item.label }}</span>
        </router-link>
      </template>
    </nav>

    <!-- Collapse-Button (nur Desktop) -->
    <button
      @click="$emit('toggle')"
      class="hidden lg:flex justify-center items-center border-stone-200 dark:border-stone-800 border-t h-12 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
    >
      <ChevronLeft v-if="!isCollapsed" class="w-5 h-5" />
      <ChevronRight v-else class="w-5 h-5" />
    </button>
  </aside>
</template>

<script setup>
/**
 * Props:
 * - isCollapsed: Ob die Sidebar eingeklappt ist
 * Emits:
 * - toggle: Sidebar ein-/ausklappen
 */
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  ShoppingCart,
  Warehouse,
  ChevronLeft,
  ChevronRight,
  X,
  Shield,
  Users,
  Settings,
  SmilePlus,
  DatabaseBackup,
  FolderDown,
} from 'lucide-vue-next';
import { usePantryStore } from '@/stores/pantry.js';
import { useShoppingStore } from '@/stores/shopping.js';
import { useAuthStore } from '@/stores/auth.js';
import { computed } from 'vue';

const props = defineProps({
  isCollapsed: { type: Boolean, default: false },
  isMobileOpen: { type: Boolean, default: false },
});
const emit = defineEmits(['toggle', 'close-mobile']);

// Auf Mobile: Nach Klick auf Nav-Link Sidebar schließen
function onNavClick() {
  if (window.innerWidth < 1024) {
    emit('close-mobile');
  }
}

const pantryStore = usePantryStore();
const shoppingStore = useShoppingStore();
const authStore = useAuthStore();

// Navigations-Einträge mit Icons und optionalen Badges
const navItems = computed(() => [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/recipes', label: 'Rezepte', icon: BookOpen },
  { to: '/mealplan', label: 'Wochenplan', icon: Calendar },
  {
    to: '/shopping',
    label: 'Einkaufsliste',
    icon: ShoppingCart,
    badge: shoppingStore.openItemsCount || null,
  },
  {
    to: '/pantry',
    label: 'Vorratsschrank',
    icon: Warehouse,
    badge: pantryStore.expiringCount || null,
  },
  { to: '/my-data', label: 'Meine Daten', icon: FolderDown },
]);

// Admin-Navigations-Einträge
const adminNavItems = [
  { to: '/admin', label: 'Dashboard', icon: Shield },
  { to: '/admin/users', label: 'Benutzer', icon: Users },
  { to: '/admin/data', label: 'Datenverwaltung', icon: DatabaseBackup },
  { to: '/admin/settings', label: 'Einstellungen', icon: Settings },
  { to: '/admin/ingredient-icons', label: 'Zutaten-Icons', icon: SmilePlus },
];
</script>
