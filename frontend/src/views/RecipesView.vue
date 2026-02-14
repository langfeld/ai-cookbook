<!--
  ============================================
  RecipesView - Rezeptübersicht
  ============================================
  Zeigt alle Rezepte mit Filtern, Suche und Import-Optionen.
-->
<template>
  <div class="space-y-6 animate-fade-in">
    <!-- Header mit Aktionen -->
    <div class="flex sm:flex-row flex-col sm:items-center gap-4">
      <div class="flex-1">
        <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl">
          Rezepte
        </h2>
        <p class="text-stone-500 text-sm">{{ recipesStore.totalRecipes }} Rezepte in deiner Sammlung</p>
      </div>
      <div class="flex gap-2">
        <!-- Export/Import Button -->
        <button
          @click="showExportImport = true"
          class="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-lg font-medium text-stone-700 dark:text-stone-300 text-sm transition-colors"
        >
          <ArrowDownUp class="w-4 h-4" />
          <span class="hidden sm:inline">Export/Import</span>
        </button>
        <!-- Foto-Import Button -->
        <button
          @click="showPhotoImport = true"
          class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors bg-accent-600 hover:bg-accent-700"
        >
          <Camera class="w-4 h-4" />
          <span class="hidden sm:inline">Foto importieren</span>
        </button>
        <!-- Neues Rezept -->
        <router-link
          to="/recipes/new"
          class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors"
        >
          <Plus class="w-4 h-4" />
          Neues Rezept
        </router-link>
      </div>
    </div>

    <!-- Filter-Leiste -->
    <div class="flex flex-wrap items-center gap-3 bg-white dark:bg-stone-900 p-4 border border-stone-200 dark:border-stone-800 rounded-xl">
      <!-- Suche -->
      <div class="relative flex-1 min-w-48">
        <Search class="top-1/2 left-3 absolute w-4 h-4 text-stone-400 -translate-y-1/2" />
        <input
          v-model="recipesStore.filters.search"
          @input="debouncedFetch"
          type="text"
          placeholder="Rezept suchen..."
          class="bg-stone-50 dark:bg-stone-800 py-2 pr-4 pl-9 border border-stone-200 focus:border-primary-400 dark:border-stone-700 rounded-lg outline-none w-full text-sm"
        />
      </div>

      <!-- Kategorie-Filter -->
      <select
        v-model="recipesStore.filters.category"
        @change="recipesStore.fetchRecipes()"
        class="bg-stone-50 dark:bg-stone-800 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg outline-none text-stone-700 dark:text-stone-300 text-sm"
      >
        <option value="">Alle Kategorien</option>
        <option v-for="cat in recipesStore.categories" :key="cat.id" :value="cat.name">
          {{ cat.icon }} {{ cat.name }}
        </option>
      </select>

      <!-- Schwierigkeit -->
      <select
        v-model="recipesStore.filters.difficulty"
        @change="recipesStore.fetchRecipes()"
        class="bg-stone-50 dark:bg-stone-800 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg outline-none text-stone-700 dark:text-stone-300 text-sm"
      >
        <option value="">Alle Schwierigkeiten</option>
        <option value="leicht">🟢 Leicht</option>
        <option value="mittel">🟡 Mittel</option>
        <option value="schwer">🔴 Schwer</option>
      </select>

      <!-- Favoriten-Toggle -->
      <button
        @click="toggleFavoriteFilter"
        :class="[
          'flex items-center gap-1 px-3 py-2 rounded-lg border text-sm transition-colors',
          recipesStore.filters.favorite
            ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
            : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500',
        ]"
      >
        <Star class="w-4 h-4" :class="{ 'fill-amber-400': recipesStore.filters.favorite }" />
        Favoriten
      </button>
    </div>

    <!-- Rezept-Grid -->
    <div v-if="recipesStore.recipes.length" class="gap-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <RecipeCard
        v-for="recipe in recipesStore.recipes"
        :key="recipe.id"
        :recipe="recipe"
        @toggle-favorite="recipesStore.toggleFavorite(recipe.id)"
      />
    </div>

    <!-- Leerer Zustand -->
    <div v-else-if="!recipesStore.loading" class="py-16 text-center">
      <BookOpen class="mx-auto mb-4 w-16 h-16 text-stone-300 dark:text-stone-600" />
      <h3 class="mb-2 font-medium text-stone-600 dark:text-stone-400 text-lg">
        Noch keine Rezepte
      </h3>
      <p class="mx-auto mb-6 max-w-md text-stone-500 text-sm">
        Erstelle dein erstes Rezept oder importiere eines per Foto. Die KI hilft dir dabei!
      </p>
    </div>

    <!-- Laden -->
    <div v-if="recipesStore.loading" class="flex justify-center py-12">
      <div class="border-2 border-primary-200 border-t-primary-600 rounded-full w-8 h-8 animate-spin" />
    </div>

    <!-- Foto-Import Modal -->
    <RecipeImportModal
      v-if="showPhotoImport"
      @close="showPhotoImport = false"
      @imported="handleImported"
    />

    <!-- Export/Import Modal -->
    <RecipeImportExportModal
      v-if="showExportImport"
      @close="showExportImport = false"
      @imported="handleExportImportDone"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRecipesStore } from '@/stores/recipes.js';
import { Search, Camera, Plus, Star, BookOpen, ArrowDownUp } from 'lucide-vue-next';
import RecipeCard from '@/components/recipes/RecipeCard.vue';
import RecipeImportModal from '@/components/recipes/RecipeImportModal.vue';
import RecipeImportExportModal from '@/components/recipes/RecipeImportExportModal.vue';
import { useNotification } from '@/composables/useNotification.js';

const recipesStore = useRecipesStore();
const { showSuccess } = useNotification();
const showPhotoImport = ref(false);
const showExportImport = ref(false);

// Debounced Suche (300ms Verzögerung)
let searchTimeout;
function debouncedFetch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    recipesStore.fetchRecipes();
  }, 300);
}

function toggleFavoriteFilter() {
  recipesStore.filters.favorite = recipesStore.filters.favorite ? null : true;
  recipesStore.fetchRecipes();
}

function handleImported(data) {
  showPhotoImport.value = false;
  showSuccess('Rezept erfolgreich importiert!');
}

function handleExportImportDone(data) {
  showExportImport.value = false;
  recipesStore.fetchRecipes();
  showSuccess(data?.message || 'Import abgeschlossen!');
}

onMounted(() => {
  recipesStore.fetchRecipes();
  recipesStore.fetchCategories();
});
</script>
