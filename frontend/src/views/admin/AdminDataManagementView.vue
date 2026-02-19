<!--
  ============================================
  Admin Datenverwaltung - Export / Import Center
  ============================================
  Zentrale Seite für alle Daten-Export/Import-Funktionen.
  Bietet Überblick über alle exportierbaren Datentypen
  und direkten Zugang zu den jeweiligen Modals.
-->
<template>
  <div class="mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
    <!-- Header -->
    <div class="mb-6 sm:mb-8">
      <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl sm:text-3xl">
        Datenverwaltung
      </h1>
      <p class="mt-1 text-stone-500 dark:text-stone-400 text-sm">
        Export, Import und Backups für alle Daten zentral verwalten
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 rounded-full w-8 h-8 animate-spin"></div>
    </div>

    <template v-else>
      <!-- Komplett-Backup Sektion -->
      <div class="bg-linear-to-r from-primary-50 dark:from-primary-900/20 to-amber-50 dark:to-amber-900/10 mb-6 sm:mb-8 p-5 sm:p-6 border border-primary-200 dark:border-primary-800/50 rounded-2xl">
        <div class="flex sm:flex-row flex-col sm:items-center gap-4">
          <div class="flex flex-1 items-center gap-3">
            <div class="flex justify-center items-center bg-primary-100 dark:bg-primary-900/40 rounded-xl w-12 h-12 shrink-0">
              <HardDrive class="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-lg">
                💾 Komplett-Backup
              </h2>
              <p class="text-stone-500 dark:text-stone-400 text-sm">
                Komplette SQLite-Datenbank als Datei herunterladen — enthält alle Daten inkl. Passwort-Hashes.
              </p>
            </div>
          </div>
          <button
            @click="downloadBackup"
            :disabled="backupDownloading"
            class="flex justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-5 py-3 rounded-xl font-medium text-white text-sm transition-colors shrink-0"
          >
            <Loader2 v-if="backupDownloading" class="w-4 h-4 animate-spin" />
            <DatabaseBackup v-else class="w-4 h-4" />
            {{ backupDownloading ? 'Lade...' : 'Backup herunterladen' }}
          </button>
        </div>
      </div>

      <!-- Datentypen-Grid -->
      <div class="gap-4 sm:gap-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="item in dataCategories"
          :key="item.key"
          class="bg-white dark:bg-stone-800 hover:shadow-md p-5 border border-stone-200 dark:border-stone-700 rounded-xl transition-shadow"
        >
          <!-- Header -->
          <div class="flex items-start gap-3 mb-3">
            <div :class="[
              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
              item.bgClass
            ]">
              <component :is="item.icon" class="w-5 h-5" :class="item.iconClass" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-stone-800 dark:text-stone-100 text-base">
                {{ item.emoji }} {{ item.label }}
              </h3>
              <p class="mt-0.5 text-stone-400 dark:text-stone-500 text-xs">
                {{ item.count !== null ? `${item.count} Einträge` : '' }}
              </p>
            </div>
          </div>

          <!-- Beschreibung -->
          <p class="mb-4 text-stone-500 dark:text-stone-400 text-sm leading-relaxed">
            {{ item.description }}
          </p>

          <!-- Buttons -->
          <button
            @click="item.action()"
            class="flex justify-center items-center gap-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 dark:hover:bg-stone-600 px-4 py-2.5 rounded-lg w-full font-medium text-stone-700 dark:text-stone-200 text-sm transition-colors"
          >
            <ArrowDownUp class="w-4 h-4" />
            Export / Import öffnen
          </button>
        </div>
      </div>

      <!-- Hinweis für Benutzer-Exporte -->
      <div class="bg-stone-50 dark:bg-stone-800/50 mt-6 sm:mt-8 p-4 sm:p-5 border border-stone-200 dark:border-stone-700 rounded-xl">
        <div class="flex items-start gap-3">
          <Info class="mt-0.5 w-5 h-5 text-stone-400 dark:text-stone-500 shrink-0" />
          <div>
            <p class="font-medium text-stone-700 dark:text-stone-300 text-sm">
              Hinweis für Benutzer-Exporte
            </p>
            <p class="mt-1 text-stone-500 dark:text-stone-400 text-sm">
              Reguläre Benutzer können ihre eigenen Rezepte und Vorräte auch direkt in den jeweiligen Ansichten exportieren.
              Diese Admin-Seite exportiert <strong class="text-stone-600 dark:text-stone-300">alle Daten aller Benutzer</strong>.
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- Modals -->
    <RecipeImportExportModal
      v-if="activeModal === 'recipes'"
      :is-admin="true"
      :users="adminUsers"
      @close="activeModal = null"
      @imported="handleImported"
    />

    <PantryImportExportModal
      v-if="activeModal === 'pantry'"
      :users="adminUsers"
      @close="activeModal = null"
      @imported="handleImported"
    />

    <RewePreferencesImportExportModal
      v-if="activeModal === 'rewe-prefs'"
      :users="adminUsers"
      @close="activeModal = null"
      @imported="handleImported"
    />

    <UsersImportExportModal
      v-if="activeModal === 'users'"
      @close="activeModal = null"
      @imported="handleUsersImported"
    />

    <IngredientAliasesImportExportModal
      v-if="activeModal === 'aliases'"
      :users="adminUsers"
      @close="activeModal = null"
      @imported="handleImported"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useApi } from '@/composables/useApi.js';
import { useAuthStore } from '@/stores/auth.js';
import { useNotification } from '@/composables/useNotification.js';

import RecipeImportExportModal from '@/components/recipes/RecipeImportExportModal.vue';
import PantryImportExportModal from '@/components/pantry/PantryImportExportModal.vue';
import RewePreferencesImportExportModal from '@/components/rewe/RewePreferencesImportExportModal.vue';
import UsersImportExportModal from '@/components/admin/UsersImportExportModal.vue';
import IngredientAliasesImportExportModal from '@/components/admin/IngredientAliasesImportExportModal.vue';

import {
  Users,
  BookOpen,
  Warehouse,
  ShoppingCart,
  Link,
  HardDrive,
  ArrowDownUp,
  Info,
  Loader2,
  DatabaseBackup,
} from 'lucide-vue-next';

const api = useApi();
const authStore = useAuthStore();
const { showSuccess, showError } = useNotification();

const loading = ref(true);
const activeModal = ref(null);
const adminUsers = ref([]);
const backupDownloading = ref(false);

// Zähler für Datentypen
const counts = ref({
  users: 0,
  recipes: 0,
  pantry: 0,
  rewePrefs: 0,
  aliases: 0,
});

const dataCategories = computed(() => [
  {
    key: 'users',
    emoji: '👤',
    label: 'Benutzer',
    description: 'Benutzerkonten exportieren/importieren. Passwörter werden nicht exportiert — importierte Benutzer erhalten ein temporäres Passwort.',
    icon: Users,
    bgClass: 'bg-blue-50 dark:bg-blue-900/30',
    iconClass: 'text-blue-600 dark:text-blue-400',
    count: counts.value.users,
    action: () => { activeModal.value = 'users'; },
  },
  {
    key: 'recipes',
    emoji: '📦',
    label: 'Rezepte',
    description: 'Alle Rezepte aller Benutzer inkl. Zutaten, Schritte, Kategorien und optionalen Bildern als JSON exportieren.',
    icon: BookOpen,
    bgClass: 'bg-green-50 dark:bg-green-900/30',
    iconClass: 'text-green-600 dark:text-green-400',
    count: counts.value.recipes,
    action: () => { activeModal.value = 'recipes'; },
  },
  {
    key: 'pantry',
    emoji: '🗄️',
    label: 'Vorratsschrank',
    description: 'Vorratsartikel aller Benutzer exportieren/importieren inkl. Ablaufdatum, Kategorien und Mengen.',
    icon: Warehouse,
    bgClass: 'bg-teal-50 dark:bg-teal-900/30',
    iconClass: 'text-teal-600 dark:text-teal-400',
    count: counts.value.pantry,
    action: () => { activeModal.value = 'pantry'; },
  },
  {
    key: 'rewe-prefs',
    emoji: '🏪',
    label: 'REWE-Präferenzen',
    description: 'Bevorzugte REWE Produkt-Zuordnungen aller Benutzer exportieren/importieren.',
    icon: ShoppingCart,
    bgClass: 'bg-rose-50 dark:bg-rose-900/30',
    iconClass: 'text-rose-600 dark:text-rose-400',
    count: counts.value.rewePrefs,
    action: () => { activeModal.value = 'rewe-prefs'; },
  },
  {
    key: 'aliases',
    emoji: '🔗',
    label: 'Zutaten-Aliase',
    description: 'Zutaten-Zusammenfassungen exportieren/importieren (z. B. „Gurke Mini" → „Mini-Gurke").',
    icon: Link,
    bgClass: 'bg-violet-50 dark:bg-violet-900/30',
    iconClass: 'text-violet-600 dark:text-violet-400',
    count: counts.value.aliases,
    action: () => { activeModal.value = 'aliases'; },
  },
]);

// ============================================
// Komplett-Backup
// ============================================
async function downloadBackup() {
  backupDownloading.value = true;
  try {
    const response = await fetch('/api/admin/backup/download', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (!response.ok) throw new Error('Backup-Download fehlgeschlagen');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cookbook-backup-${new Date().toISOString().split('T')[0]}.db`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Datenbank-Backup erfolgreich heruntergeladen!');
  } catch (err) {
    showError(err.message || 'Backup-Download fehlgeschlagen');
  } finally {
    backupDownloading.value = false;
  }
}

// ============================================
// Modal Callbacks
// ============================================
function handleImported() {
  activeModal.value = null;
  fetchCounts();
}

function handleUsersImported() {
  activeModal.value = null;
  fetchCounts();
  // Benutzerliste neu laden
  fetchUsers();
}

// ============================================
// Daten laden
// ============================================
async function fetchCounts() {
  try {
    const stats = await api.get('/admin/stats');
    counts.value = {
      users: stats.total_users || 0,
      recipes: stats.total_recipes || 0,
      pantry: stats.total_pantry_items || 0,
      rewePrefs: stats.rewe_preferences || 0,
      aliases: stats.ingredient_aliases || 0,
    };
  } catch {
    // Ignorieren
  }
}

async function fetchUsers() {
  try {
    const data = await api.get('/admin/users');
    adminUsers.value = data.users || [];
  } catch {
    // Ignorieren
  }
}

onMounted(async () => {
  try {
    await Promise.all([fetchCounts(), fetchUsers()]);
  } finally {
    loading.value = false;
  }
});
</script>
