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
      <div class="flex flex-wrap gap-2 w-full sm:w-auto">
        <!-- Sammlungen verwalten -->
        <button
          @click="showCollectionManager = true"
          class="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg font-medium text-stone-700 dark:text-stone-300 text-sm transition-colors"
        >
          <FolderOpen class="w-4 h-4" />
          <span class="hidden sm:inline">Sammlungen</span>
        </button>
        <!-- Auswahl-Modus (nur Admin) -->
        <button
          v-if="authStore.isAdmin"
          @click="toggleSelectMode"
          :class="[
            'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
            selectMode
              ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
              : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
          ]"
        >
          <CheckSquare v-if="selectMode" class="w-4 h-4" />
          <Square v-else class="w-4 h-4" />
          <span class="hidden sm:inline">{{ selectMode ? 'Abbrechen' : 'Auswählen' }}</span>
        </button>
        <!-- Link zu Meine Daten -->
        <router-link
          to="/my-data"
          class="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-lg font-medium text-stone-700 dark:text-stone-300 text-sm transition-colors"
        >
          <ArrowDownUp class="w-4 h-4" />
          <span class="hidden sm:inline">Export/Import</span>
        </router-link>
        <!-- KI-Import Button -->
        <button
          @click="showPhotoImport = true"
          class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors bg-accent-600 hover:bg-accent-700"
        >
          <Sparkles class="w-4 h-4" />
          <span class="hidden sm:inline">KI-Import</span>
        </button>
        <!-- Neues Rezept -->
        <router-link
          to="/recipes/new"
          class="flex justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg w-full sm:w-auto font-medium text-white text-sm transition-colors"
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

      <!-- Sammlungs-Filter -->
      <select
        v-model="selectedCollectionFilter"
        @change="applyCollectionFilter"
        class="bg-stone-50 dark:bg-stone-800 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg outline-none text-stone-700 dark:text-stone-300 text-sm"
      >
        <option value="">Alle Sammlungen</option>
        <option v-for="col in collectionsStore.collections" :key="col.id" :value="col.id">
          {{ col.icon }} {{ col.name }} ({{ col.recipe_count ?? 0 }})
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
      <div
        v-for="recipe in recipesStore.recipes"
        :key="recipe.id"
        class="relative"
        :class="{ 'cursor-pointer': selectMode }"
        @click="selectMode ? toggleSelect(recipe.id) : null"
      >
        <!-- Auswahl-Checkbox Overlay -->
        <div
          v-if="selectMode"
          class="top-3 left-3 z-10 absolute"
        >
          <div
            :class="[
              'w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all shadow-sm',
              selectedIds.has(recipe.id)
                ? 'bg-red-500 border-red-500 text-white'
                : 'bg-white/90 dark:bg-stone-800/90 border-stone-300 dark:border-stone-600'
            ]"
          >
            <Check v-if="selectedIds.has(recipe.id)" class="w-4 h-4" />
          </div>
        </div>
        <!-- Auswahl-Ring -->
        <div v-if="selectMode && selectedIds.has(recipe.id)" class="z-5 absolute inset-0 rounded-xl ring-2 ring-red-500 ring-offset-2 dark:ring-offset-stone-950 pointer-events-none" />
        <RecipeCard
          :recipe="recipe"
          :class="{ 'pointer-events-none': selectMode }"
          @toggle-favorite="recipesStore.toggleFavorite(recipe.id)"
        />
      </div>
    </div>

    <!-- Floating Aktionsleiste bei Auswahl -->
    <Teleport to="body">
      <Transition name="slide-up">
        <div
          v-if="selectMode && selectedIds.size > 0"
          class="right-0 bottom-0 left-0 z-40 fixed flex justify-center items-center gap-4 bg-white/95 dark:bg-stone-900/95 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] backdrop-blur-sm px-6 py-4 border-stone-200 dark:border-stone-700 border-t"
        >
          <div class="flex items-center gap-2 text-stone-600 dark:text-stone-300 text-sm">
            <CheckSquare class="w-4 h-4" />
            <span class="font-medium">{{ selectedIds.size }}</span> ausgewählt
          </div>
          <button
            @click="selectAll"
            class="hover:bg-stone-100 dark:hover:bg-stone-800 px-3 py-1.5 border border-stone-300 dark:border-stone-600 rounded-lg text-stone-600 dark:text-stone-300 text-sm transition-colors"
          >
            Alle ({{ recipesStore.recipes.length }})
          </button>
          <button
            @click="showBatchDeleteConfirm = true"
            class="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded-lg font-medium text-white text-sm transition-colors"
          >
            <Trash2 class="w-4 h-4" />
            Löschen ({{ selectedIds.size }})
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Bestätigungs-Dialog für Batch-Löschen -->
    <ConfirmDialog
      v-model="showBatchDeleteConfirm"
      variant="danger"
      :title="`${selectedIds.size} Rezept${selectedIds.size !== 1 ? 'e' : ''} löschen?`"
      :message="`${selectedIds.size} Rezept${selectedIds.size !== 1 ? 'e' : ''} werden unwiderruflich gelöscht, inklusive aller Bilder, Zutaten und Kochschritte.`"
      confirm-text="Endgültig löschen"
      cancel-text="Abbrechen"
      :loading="batchDeleting"
      @confirm="executeBatchDelete"
    />

    <!-- Leerer Zustand -->
    <div v-if="!recipesStore.recipes.length && !recipesStore.loading" class="py-16 text-center">
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

    <!-- Sammlungen-Manager Modal -->
    <CollectionManager v-model="showCollectionManager" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRecipesStore } from '@/stores/recipes.js';
import { useAuthStore } from '@/stores/auth.js';
import { useCollectionsStore } from '@/stores/collections.js';
import { Search, Sparkles, Plus, Star, BookOpen, ArrowDownUp, CheckSquare, Square, Check, Trash2, FolderOpen } from 'lucide-vue-next';
import RecipeCard from '@/components/recipes/RecipeCard.vue';
import RecipeImportModal from '@/components/recipes/RecipeImportModal.vue';
import CollectionManager from '@/components/collections/CollectionManager.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import { useNotification } from '@/composables/useNotification.js';

const recipesStore = useRecipesStore();
const authStore = useAuthStore();
const collectionsStore = useCollectionsStore();
const { showSuccess, showError } = useNotification();
const showPhotoImport = ref(false);
const showCollectionManager = ref(false);
const selectedCollectionFilter = ref('');

// Mehrfachauswahl (Admin)
const selectMode = ref(false);
const selectedIds = ref(new Set());
const showBatchDeleteConfirm = ref(false);
const batchDeleting = ref(false);

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

function applyCollectionFilter() {
  recipesStore.filters.collectionId = selectedCollectionFilter.value || '';
  recipesStore.fetchRecipes();
}

function handleImported(data) {
  showPhotoImport.value = false;
  showSuccess('Rezept erfolgreich importiert!');
}

// Auswahl-Modus
function toggleSelectMode() {
  selectMode.value = !selectMode.value;
  selectedIds.value = new Set();
}

function toggleSelect(id) {
  const s = new Set(selectedIds.value);
  if (s.has(id)) {
    s.delete(id);
  } else {
    s.add(id);
  }
  selectedIds.value = s;
}

function selectAll() {
  selectedIds.value = new Set(recipesStore.recipes.map(r => r.id));
}

async function executeBatchDelete() {
  batchDeleting.value = true;
  try {
    const ids = [...selectedIds.value];
    const result = await recipesStore.deleteRecipesBatch(ids);
    showSuccess(`${result.deletedCount} Rezept${result.deletedCount !== 1 ? 'e' : ''} gelöscht! 🗑️`);
    showBatchDeleteConfirm.value = false;
    selectMode.value = false;
    selectedIds.value = new Set();
  } catch {
    showError('Löschen fehlgeschlagen.');
  } finally {
    batchDeleting.value = false;
  }
}

onMounted(() => {
  recipesStore.fetchRecipes();
  recipesStore.fetchCategories();
  collectionsStore.fetchCollections();
});
</script>
