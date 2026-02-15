<!--
  ============================================
  DashboardView - Übersichtsseite
  ============================================
  Zeigt Zusammenfassung aller Bereiche:
  - Statistiken (Rezepte, Favoriten, Kochhistorie)
  - Heutiger Wochenplan
  - Einkaufsliste Quick-View
  - Bald ablaufende Vorräte
-->
<template>
  <div class="space-y-6 animate-fade-in">
    <!-- Begrüßung -->
    <div>
      <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl">
        Hallo {{ authStore.displayName }}! 👋
      </h2>
      <p class="mt-1 text-stone-500 dark:text-stone-400">
        Was kochen wir heute?
      </p>
    </div>

    <!-- Statistik-Karten -->
    <div class="gap-4 grid grid-cols-2 lg:grid-cols-4">
      <StatCard
        v-for="stat in stats"
        :key="stat.label"
        :icon="stat.icon"
        :label="stat.label"
        :value="stat.value"
        :color="stat.color"
      />
    </div>

    <div class="gap-6 grid lg:grid-cols-2">
      <!-- Heutiger Plan -->
      <div class="bg-white dark:bg-stone-900 p-6 border border-stone-200 dark:border-stone-800 rounded-xl">
        <h3 class="flex items-center gap-2 mb-4 font-semibold text-stone-800 dark:text-stone-100 text-lg">
          <Calendar class="w-5 h-5 text-primary-500" />
          Heute auf dem Plan
        </h3>
        <div v-if="todayMeals.length" class="space-y-3">
          <div
            v-for="meal in todayMeals"
            :key="meal.id"
            class="flex items-center gap-3 bg-stone-50 dark:bg-stone-800/50 p-3 rounded-lg"
          >
            <span class="text-lg">{{ mealTypeEmojis[meal.meal_type] || '🍽️' }}</span>
            <div class="flex-1">
              <p class="font-medium text-stone-800 dark:text-stone-200 text-sm">{{ meal.recipe_title }}</p>
              <p class="text-stone-500 text-xs">{{ meal.total_time }} Min. • {{ meal.difficulty }}</p>
            </div>
            <button
              v-if="!meal.is_cooked"
              @click="markMealCooked(meal)"
              class="px-3 py-1 rounded-full text-xs transition-colors bg-accent-100 text-accent-700 hover:bg-accent-200 dark:bg-accent-900/50 dark:hover:bg-accent-800 dark:text-accent-300"
            >
              Gekocht ✓
            </button>
            <span v-else class="text-xs text-accent-600 dark:text-accent-400">✓ Gekocht</span>
          </div>
        </div>
        <div v-else class="py-8 text-stone-400 text-center">
          <Calendar class="opacity-50 mx-auto mb-2 w-10 h-10" />
          <p class="text-sm">Kein Plan für heute.</p>
          <router-link to="/mealplan" class="text-primary-600 dark:text-primary-400 text-sm hover:underline">
            Wochenplan erstellen →
          </router-link>
        </div>
      </div>

      <!-- Schnellaktionen -->
      <div class="bg-white dark:bg-stone-900 p-6 border border-stone-200 dark:border-stone-800 rounded-xl">
        <h3 class="flex items-center gap-2 mb-4 font-semibold text-stone-800 dark:text-stone-100 text-lg">
          <Zap class="w-5 h-5 text-amber-500" />
          Schnellaktionen
        </h3>
        <div class="gap-3 grid grid-cols-2">
          <router-link
            v-for="action in quickActions"
            :key="action.to"
            :to="action.to"
            class="group flex flex-col items-center gap-2 hover:bg-primary-50/50 dark:hover:bg-primary-950/30 p-4 border border-stone-200 hover:border-primary-300 dark:border-stone-700 dark:hover:border-primary-700 rounded-xl transition-colors"
          >
            <component
              :is="action.icon"
              class="w-8 h-8 text-stone-400 group-hover:text-primary-500 transition-colors"
            />
            <span class="text-stone-600 dark:text-stone-400 text-xs text-center">{{ action.label }}</span>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Kürzlich gekochte Rezepte -->
    <div class="bg-white dark:bg-stone-900 p-6 border border-stone-200 dark:border-stone-800 rounded-xl">
      <h3 class="flex items-center gap-2 mb-4 font-semibold text-stone-800 dark:text-stone-100 text-lg">
        <History class="w-5 h-5 text-indigo-500" />
        Zuletzt gekocht
      </h3>
      <div v-if="recipesStore.recentRecipes.length" class="gap-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <router-link
          v-for="recipe in recipesStore.recentRecipes"
          :key="recipe.id"
          :to="`/recipes/${recipe.id}`"
          class="group"
        >
          <div class="bg-stone-100 dark:bg-stone-800 mb-2 rounded-lg aspect-video overflow-hidden">
            <img
              v-if="recipe.image_url"
              :src="recipe.image_url"
              :alt="recipe.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            <div v-else class="flex justify-center items-center w-full h-full text-3xl">🍽️</div>
          </div>
          <p class="font-medium text-stone-700 dark:group-hover:text-primary-400 dark:text-stone-300 group-hover:text-primary-600 text-sm truncate">
            {{ recipe.title }}
          </p>
        </router-link>
      </div>
      <div v-else class="py-6 text-stone-400 text-center">
        <p class="text-sm">Noch keine Rezepte vorhanden.</p>
        <router-link to="/recipes/new" class="text-primary-600 dark:text-primary-400 text-sm hover:underline">
          Erstes Rezept erstellen →
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth.js';
import { useRecipesStore } from '@/stores/recipes.js';
import { useMealPlanStore } from '@/stores/mealplan.js';
import { useShoppingStore } from '@/stores/shopping.js';
import { usePantryStore } from '@/stores/pantry.js';
import {
  Calendar, Zap, History, BookOpen, Sparkles,
  CalendarPlus, ShoppingCart, Star, Warehouse,
} from 'lucide-vue-next';
import StatCard from '@/components/dashboard/StatCard.vue';

const authStore = useAuthStore();
const recipesStore = useRecipesStore();
const mealPlanStore = useMealPlanStore();
const shoppingStore = useShoppingStore();
const pantryStore = usePantryStore();

// Emojis für Mahlzeiten-Typen
const mealTypeEmojis = {
  fruehstueck: '🌅',
  mittag: '☀️',
  abendessen: '🌙',
  snack: '🍿',
};

// Statistik-Daten
const stats = computed(() => [
  { icon: BookOpen, label: 'Rezepte', value: recipesStore.totalRecipes, color: 'primary' },
  { icon: Star, label: 'Favoriten', value: recipesStore.favoriteRecipes.length, color: 'amber' },
  { icon: ShoppingCart, label: 'Einkauf', value: `${shoppingStore.openItemsCount} Items`, color: 'accent' },
  { icon: Warehouse, label: 'Vorräte', value: pantryStore.items.length, color: 'indigo' },
]);

// Heutiger Plan
const todayMeals = computed(() => {
  if (!mealPlanStore.currentPlan?.entries) return [];
  const today = new Date().getDay();
  // JS: 0=So, unsere DB: 0=Mo -> Umrechnung
  const dayOfWeek = today === 0 ? 6 : today - 1;
  return mealPlanStore.currentPlan.entries.filter(e => e.day_of_week === dayOfWeek);
});

// Schnellaktionen
const quickActions = [
  { to: '/recipes/new', icon: BookOpen, label: 'Rezept erstellen' },
  { to: '/recipes?import=photo', icon: Sparkles, label: 'KI-Import' },
  { to: '/mealplan?generate=true', icon: CalendarPlus, label: 'Wochenplan erstellen' },
  { to: '/shopping', icon: ShoppingCart, label: 'Einkaufsliste' },
];

// Daten beim Laden der Seite abrufen
onMounted(async () => {
  // allSettled statt all: Dashboard lädt auch wenn einzelne APIs fehlschlagen
  await Promise.allSettled([
    recipesStore.fetchRecipes(),
    recipesStore.fetchCategories(),
    mealPlanStore.fetchCurrentPlan(),
    shoppingStore.fetchActiveList(),
    pantryStore.fetchItems(),
  ]);
});

async function markMealCooked(meal) {
  if (mealPlanStore.currentPlan) {
    await mealPlanStore.markCooked(mealPlanStore.currentPlan.id, meal.id);
    await mealPlanStore.fetchCurrentPlan();
  }
}
</script>
