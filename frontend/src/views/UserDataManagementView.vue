<!--
  ============================================
  UserDataManagementView - Meine Daten
  ============================================
  Zentrale Seite für Benutzer zum Exportieren
  und Importieren aller persönlichen Daten.
-->
<template>
  <div class="mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
    <!-- Header -->
    <div class="mb-6 sm:mb-8">
      <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl sm:text-3xl">
        Meine Daten
      </h1>
      <p class="mt-1 text-stone-500 dark:text-stone-400 text-sm">
        Exportiere und importiere deine persönlichen Daten als Backup oder zur Übertragung
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 rounded-full w-8 h-8 animate-spin"></div>
    </div>

    <template v-else>
      <!-- Datentypen-Grid -->
      <div class="gap-4 sm:gap-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="item in dataCategories"
          :key="item.key"
          class="bg-white dark:bg-stone-800 hover:shadow-md p-5 border border-stone-200 dark:border-stone-700 rounded-xl transition-shadow"
        >
          <!-- Header -->
          <div class="flex items-start gap-3 mb-3">
            <div :class="['w-10 h-10 rounded-lg flex items-center justify-center shrink-0', item.bgClass]">
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

      <!-- Hinweis -->
      <div class="bg-stone-50 dark:bg-stone-800/50 mt-6 sm:mt-8 p-4 sm:p-5 border border-stone-200 dark:border-stone-700 rounded-xl">
        <div class="flex items-start gap-3">
          <Info class="mt-0.5 w-5 h-5 text-stone-400 dark:text-stone-500 shrink-0" />
          <div>
            <p class="font-medium text-stone-700 dark:text-stone-300 text-sm">
              Hinweis zu Exporten
            </p>
            <p class="mt-1 text-stone-500 dark:text-stone-400 text-sm">
              Alle Exporte enthalten ausschließlich <strong class="text-stone-600 dark:text-stone-300">deine eigenen Daten</strong>.
              Die Dateien können jederzeit wieder importiert werden — z. B. als Backup oder zum Übertragen auf eine andere Instanz.
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- Modals -->
    <RecipeImportExportModal
      v-if="activeModal === 'recipes'"
      :is-admin="false"
      @close="activeModal = null"
      @imported="handleImported"
    />

    <PantryImportExportModal
      v-if="activeModal === 'pantry'"
      :is-admin="false"
      @close="activeModal = null"
      @imported="handleImported"
    />

    <MealPlanImportExportModal
      v-if="activeModal === 'meal-plans'"
      @close="activeModal = null"
      @imported="handleImported"
    />

    <ShoppingListImportExportModal
      v-if="activeModal === 'shopping-lists'"
      @close="activeModal = null"
      @imported="handleImported"
    />

    <RecipeBlocksImportExportModal
      v-if="activeModal === 'recipe-blocks'"
      @close="activeModal = null"
      @imported="handleImported"
    />

    <IngredientSettingsImportExportModal
      v-if="activeModal === 'ingredient-settings'"
      @close="activeModal = null"
      @imported="handleImported"
    />

    <IngredientConversionsImportExportModal
      v-if="activeModal === 'conversions'"
      @close="activeModal = null"
      @imported="handleImported"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useApi } from '@/composables/useApi.js';
import { useRecipesStore } from '@/stores/recipes.js';

import RecipeImportExportModal from '@/components/recipes/RecipeImportExportModal.vue';
import PantryImportExportModal from '@/components/pantry/PantryImportExportModal.vue';
import MealPlanImportExportModal from '@/components/mealplan/MealPlanImportExportModal.vue';
import ShoppingListImportExportModal from '@/components/shopping/ShoppingListImportExportModal.vue';
import RecipeBlocksImportExportModal from '@/components/recipes/RecipeBlocksImportExportModal.vue';
import IngredientSettingsImportExportModal from '@/components/shopping/IngredientSettingsImportExportModal.vue';
import IngredientConversionsImportExportModal from '@/components/recipes/IngredientConversionsImportExportModal.vue';

import {
  BookOpen,
  Warehouse,
  Calendar,
  ShoppingCart,
  Ban,
  ArrowDownUp,
  Info,
  Link2,
  Scale,
} from 'lucide-vue-next';

const api = useApi();
const recipesStore = useRecipesStore();

const loading = ref(true);
const activeModal = ref(null);

const counts = ref({
  recipes: 0,
  pantry: 0,
  mealPlans: 0,
  shoppingLists: 0,
  recipeBlocks: 0,
  ingredientSettings: 0,
  conversions: 0,
});

const dataCategories = computed(() => [
  {
    key: 'recipes',
    emoji: '📦',
    label: 'Rezepte',
    description: 'Alle deine Rezepte inkl. Zutaten, Schritte, Kategorien und optionalen Bildern als JSON exportieren.',
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
    description: 'Deine Vorratsartikel inkl. Ablaufdatum, Kategorien und Mengen exportieren/importieren.',
    icon: Warehouse,
    bgClass: 'bg-teal-50 dark:bg-teal-900/30',
    iconClass: 'text-teal-600 dark:text-teal-400',
    count: counts.value.pantry,
    action: () => { activeModal.value = 'pantry'; },
  },
  {
    key: 'meal-plans',
    emoji: '📅',
    label: 'Wochenpläne',
    description: 'Deine Wochenpläne inkl. aller Einträge exportieren/importieren.',
    icon: Calendar,
    bgClass: 'bg-indigo-50 dark:bg-indigo-900/30',
    iconClass: 'text-indigo-600 dark:text-indigo-400',
    count: counts.value.mealPlans,
    action: () => { activeModal.value = 'meal-plans'; },
  },
  {
    key: 'shopping-lists',
    emoji: '🛒',
    label: 'Einkaufslisten',
    description: 'Deine Einkaufslisten inkl. aller Artikel exportieren/importieren.',
    icon: ShoppingCart,
    bgClass: 'bg-cyan-50 dark:bg-cyan-900/30',
    iconClass: 'text-cyan-600 dark:text-cyan-400',
    count: counts.value.shoppingLists,
    action: () => { activeModal.value = 'shopping-lists'; },
  },
  {
    key: 'recipe-blocks',
    emoji: '🚫',
    label: 'Rezept-Sperren',
    description: 'Deine temporären Rezept-Sperren für die Wochenplan-Generierung exportieren/importieren.',
    icon: Ban,
    bgClass: 'bg-red-50 dark:bg-red-900/30',
    iconClass: 'text-red-600 dark:text-red-400',
    count: counts.value.recipeBlocks,
    action: () => { activeModal.value = 'recipe-blocks'; },
  },
  {
    key: 'ingredient-settings',
    emoji: '🔗',
    label: 'Zutaten-Einstellungen',
    description: 'Deine Zutaten-Zusammenfassungen (Aliase) und blockierte Zutaten exportieren/importieren.',
    icon: Link2,
    bgClass: 'bg-violet-50 dark:bg-violet-900/30',
    iconClass: 'text-violet-600 dark:text-violet-400',
    count: counts.value.ingredientSettings,
    action: () => { activeModal.value = 'ingredient-settings'; },
  },
  {
    key: 'conversions',
    emoji: '⚖️',
    label: 'Umrechnungen',
    description: 'Deine Einheiten-Umrechnungen (z.B. 1 Stk Zwiebel = 80 g) exportieren/importieren.',
    icon: Scale,
    bgClass: 'bg-amber-50 dark:bg-amber-900/30',
    iconClass: 'text-amber-600 dark:text-amber-400',
    count: counts.value.conversions,
    action: () => { activeModal.value = 'conversions'; },
  },
]);

function handleImported() {
  activeModal.value = null;
  fetchCounts();
}

async function fetchCounts() {
  try {
    const [pantryData, mealPlanData, shoppingData, blocksData, aliasData, blockedData, conversionsData] = await Promise.all([
      api.get('/pantry').catch(() => ({ items: [] })),
      api.get('/mealplan/history').catch(() => ({ plans: [] })),
      api.get('/shopping/lists').catch(() => ({ lists: [] })),
      api.get('/recipe-blocks?includeExpired=true').catch(() => ({ blocks: [] })),
      api.get('/ingredient-aliases').catch(() => ({ aliases: [] })),
      api.get('/ingredient-aliases/blocked').catch(() => ({ blocked: [] })),
      api.get('/ingredient-conversions').catch(() => ({ conversions: [] })),
    ]);

    counts.value = {
      recipes: recipesStore.totalRecipes || 0,
      pantry: pantryData.items?.length || 0,
      mealPlans: mealPlanData.plans?.length || 0,
      shoppingLists: shoppingData.lists?.length || 0,
      recipeBlocks: blocksData.blocks?.length || 0,
      ingredientSettings: (aliasData.aliases?.length || 0) + (blockedData.blocked?.length || 0),
      conversions: conversionsData.conversions?.length || 0,
    };
  } catch {
    // Ignorieren
  }
}

onMounted(async () => {
  try {
    // Rezepte laden falls noch nicht geschehen
    if (!recipesStore.recipes.length) {
      await recipesStore.fetchRecipes();
    }
    await fetchCounts();
  } finally {
    loading.value = false;
  }
});
</script>
