<!--
  ============================================
  Admin Dashboard - Übersicht & Statistiken
  ============================================
  Zeigt Systemstatistiken, beliebte Rezepte und Aktivitätslogs.
-->
<template>
  <div class="mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
    <!-- Header -->
    <div class="mb-6 sm:mb-8">
      <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl sm:text-3xl">
        Admin Dashboard
      </h1>
      <p class="mt-1 text-stone-500 dark:text-stone-400 text-sm">
        Systemübersicht und Statistiken
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 rounded-full w-8 h-8 animate-spin"></div>
    </div>

    <template v-else-if="stats">
      <!-- Statistik-Karten -->
      <div class="gap-3 sm:gap-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 mb-6 sm:mb-8">
        <div
          v-for="card in statCards"
          :key="card.label"
          class="bg-white dark:bg-stone-800 p-4 sm:p-5 border border-stone-200 dark:border-stone-700 rounded-xl"
        >
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                card.bgClass
              ]"
            >
              <component :is="card.icon" class="w-5 h-5" :class="card.iconClass" />
            </div>
            <div class="min-w-0">
              <p class="font-bold text-stone-800 dark:text-stone-100 text-2xl">{{ card.value }}</p>
              <p class="text-stone-500 dark:text-stone-400 text-xs truncate">{{ card.label }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 2-Spalten Layout -->
      <div class="gap-4 sm:gap-6 grid grid-cols-1 lg:grid-cols-2">
        <!-- Beliebte Rezepte -->
        <div class="bg-white dark:bg-stone-800 p-4 sm:p-5 border border-stone-200 dark:border-stone-700 rounded-xl">
          <h2 class="mb-4 font-display font-semibold text-stone-800 dark:text-stone-100 text-lg">
            🏆 Beliebteste Rezepte
          </h2>
          <div v-if="stats.popular_recipes?.length" class="space-y-3">
            <div
              v-for="(recipe, i) in stats.popular_recipes"
              :key="recipe.id"
              class="flex items-center gap-3"
            >
              <span class="w-5 font-bold text-stone-400 dark:text-stone-500 text-sm text-right">{{ i + 1 }}.</span>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-stone-700 dark:text-stone-200 text-sm truncate">{{ recipe.title }}</p>
                <p class="text-stone-400 dark:text-stone-500 text-xs">von {{ recipe.username }}</p>
              </div>
              <span class="bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-full font-medium text-primary-600 dark:text-primary-400 text-xs">
                {{ recipe.cook_count }}× gekocht
              </span>
            </div>
          </div>
          <p v-else class="text-stone-400 dark:text-stone-500 text-sm italic">
            Noch keine Kochhistorie vorhanden.
          </p>
        </div>

        <!-- Letzte Aktivitäten -->
        <div class="bg-white dark:bg-stone-800 p-4 sm:p-5 border border-stone-200 dark:border-stone-700 rounded-xl">
          <h2 class="mb-4 font-display font-semibold text-stone-800 dark:text-stone-100 text-lg">
            📋 Letzte Admin-Aktionen
          </h2>
          <div v-if="logs.length" class="space-y-3">
            <div
              v-for="log in logs"
              :key="log.id"
              class="flex items-start gap-3 text-sm"
            >
              <div class="mt-1.5 rounded-full w-2 h-2 shrink-0" :class="logDotColor(log.action)"></div>
              <div class="flex-1 min-w-0">
                <p class="text-stone-700 dark:text-stone-300">
                  <span class="font-medium">{{ log.username || 'System' }}</span>
                  — {{ log.action }}
                </p>
                <p v-if="log.details" class="text-stone-400 dark:text-stone-500 text-xs truncate">{{ log.details }}</p>
                <p class="text-stone-400 dark:text-stone-500 text-xs">{{ formatDate(log.created_at) }}</p>
              </div>
            </div>
          </div>
          <p v-else class="text-stone-400 dark:text-stone-500 text-sm italic">
            Noch keine Admin-Aktivitäten protokolliert.
          </p>
        </div>
      </div>

      <!-- System-Info -->
      <div class="bg-white dark:bg-stone-800 mt-4 sm:mt-6 p-4 sm:p-5 border border-stone-200 dark:border-stone-700 rounded-xl">
        <h2 class="mb-4 font-display font-semibold text-stone-800 dark:text-stone-100 text-lg">
          💾 Systeminfo
        </h2>
        <div class="gap-4 grid grid-cols-1 sm:grid-cols-3">
          <div>
            <p class="mb-1 text-stone-400 dark:text-stone-500 text-xs uppercase tracking-wider">Speicher (Uploads)</p>
            <p class="font-semibold text-stone-700 dark:text-stone-200 text-lg">{{ formatSize(stats.storage_size) }}</p>
          </div>
          <div>
            <p class="mb-1 text-stone-400 dark:text-stone-500 text-xs uppercase tracking-wider">Datenbank</p>
            <p class="font-semibold text-stone-700 dark:text-stone-200 text-lg">{{ formatSize(stats.db_size) }}</p>
          </div>
          <div>
            <p class="mb-1 text-stone-400 dark:text-stone-500 text-xs uppercase tracking-wider">Aktive Benutzer</p>
            <p class="font-semibold text-stone-700 dark:text-stone-200 text-lg">{{ stats.active_users }} / {{ stats.total_users }}</p>
          </div>
        </div>
      </div>

      <!-- Export / Import -->
      <div class="bg-white dark:bg-stone-800 mt-4 sm:mt-6 p-4 sm:p-5 border border-stone-200 dark:border-stone-700 rounded-xl">
        <h2 class="mb-4 font-display font-semibold text-stone-800 dark:text-stone-100 text-lg">
          📦 Rezept Export / Import
        </h2>
        <p class="mb-4 text-stone-500 dark:text-stone-400 text-sm">
          Exportiere alle Rezepte als JSON-Backup oder importiere Rezepte aus einer Export-Datei.
        </p>
        <button
          @click="showExportImport = true"
          class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 px-4 py-2.5 rounded-lg font-medium text-white text-sm transition-colors"
        >
          <ArrowDownUp class="w-4 h-4" />
          Export / Import öffnen
        </button>
      </div>
    </template>

    <!-- Export/Import Modal -->
    <RecipeImportExportModal
      v-if="showExportImport"
      :is-admin="true"
      :users="adminUsers"
      @close="showExportImport = false"
      @imported="handleImported"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useApi } from '@/composables/useApi.js';
import { useNotification } from '@/composables/useNotification.js';
import RecipeImportExportModal from '@/components/recipes/RecipeImportExportModal.vue';
import {
  Users,
  BookOpen,
  Calendar,
  ShoppingCart,
  Sparkles,
  Warehouse,
  ChefHat,
  HardDrive,
  ArrowDownUp,
} from 'lucide-vue-next';

const api = useApi();
const { showSuccess } = useNotification();
const loading = ref(true);
const stats = ref(null);
const logs = ref([]);
const showExportImport = ref(false);
const adminUsers = ref([]);

const statCards = computed(() => {
  if (!stats.value) return [];
  return [
    { label: 'Benutzer', value: stats.value.total_users, icon: Users, bgClass: 'bg-blue-50 dark:bg-blue-900/30', iconClass: 'text-blue-600 dark:text-blue-400' },
    { label: 'Rezepte', value: stats.value.total_recipes, icon: BookOpen, bgClass: 'bg-green-50 dark:bg-green-900/30', iconClass: 'text-green-600 dark:text-green-400' },
    { label: 'KI-Rezepte', value: stats.value.ai_recipes, icon: Sparkles, bgClass: 'bg-purple-50 dark:bg-purple-900/30', iconClass: 'text-purple-600 dark:text-purple-400' },
    { label: 'Wochenpläne', value: stats.value.total_meal_plans, icon: Calendar, bgClass: 'bg-amber-50 dark:bg-amber-900/30', iconClass: 'text-amber-600 dark:text-amber-400' },
    { label: 'Einkaufslisten', value: stats.value.total_shopping_lists, icon: ShoppingCart, bgClass: 'bg-rose-50 dark:bg-rose-900/30', iconClass: 'text-rose-600 dark:text-rose-400' },
    { label: 'Vorratsartikel', value: stats.value.total_pantry_items, icon: Warehouse, bgClass: 'bg-teal-50 dark:bg-teal-900/30', iconClass: 'text-teal-600 dark:text-teal-400' },
    { label: 'Mal gekocht', value: stats.value.total_cook_count, icon: ChefHat, bgClass: 'bg-orange-50 dark:bg-orange-900/30', iconClass: 'text-orange-600 dark:text-orange-400' },
    { label: 'Upload-Speicher', value: formatSize(stats.value.storage_size), icon: HardDrive, bgClass: 'bg-stone-100 dark:bg-stone-700/50', iconClass: 'text-stone-600 dark:text-stone-400' },
  ];
});

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function logDotColor(action) {
  if (action?.includes('gelöscht') || action?.includes('delete')) return 'bg-red-500';
  if (action?.includes('gesperrt') || action?.includes('deaktiviert')) return 'bg-amber-500';
  if (action?.includes('erstellt') || action?.includes('aktiviert')) return 'bg-green-500';
  return 'bg-blue-500';
}

function handleImported(data) {
  showExportImport.value = false;
  showSuccess(data?.message || 'Import abgeschlossen!');
}

onMounted(async () => {
  try {
    const [statsData, logsData, usersData] = await Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/logs?limit=10'),
      api.get('/admin/users'),
    ]);
    stats.value = statsData;
    logs.value = logsData.logs || [];
    adminUsers.value = usersData.users || [];
  } catch {
    // Fehler wird von useApi gehandelt
  } finally {
    loading.value = false;
  }
});
</script>
