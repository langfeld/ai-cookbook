<!--
  ============================================
  SharedRecipeView - Geteiltes Rezept anzeigen
  ============================================
  Öffentliche Ansicht eines per Link geteilten Rezepts.
  Kein Login erforderlich zum Ansehen.
-->
<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="border-4 border-primary-200 border-t-primary-600 rounded-full w-8 h-8 animate-spin"></div>
    </div>

    <!-- Fehler -->
    <div v-else-if="error" class="py-20 text-center">
      <div class="mb-4 text-6xl">{{ errorIcon }}</div>
      <h1 class="mb-2 font-display font-bold text-stone-800 dark:text-stone-100 text-2xl">
        {{ errorTitle }}
      </h1>
      <p class="text-stone-500 dark:text-stone-400">{{ error }}</p>
    </div>

    <!-- Rezept -->
    <template v-else-if="sharedData">
      <!-- Shared-Info Banner -->
      <div class="bg-primary-50 dark:bg-primary-900/20 mb-6 p-4 border border-primary-200 dark:border-primary-800 rounded-xl">
        <p class="text-primary-700 dark:text-primary-300 text-sm">
          📩 Geteilt von <strong>{{ sharedData.shared_by }}</strong>
        </p>
      </div>

      <!-- Rezept-Header -->
      <div class="mb-6">
        <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl sm:text-3xl">
          {{ recipe.title }}
        </h1>
        <p v-if="recipe.description" class="mt-2 text-stone-500 dark:text-stone-400">
          {{ recipe.description }}
        </p>
      </div>

      <!-- Bild -->
      <div v-if="recipe.image_url" class="mb-6">
        <img
          :src="'/api/uploads/' + recipe.image_url"
          :alt="recipe.title"
          class="rounded-2xl w-full max-h-96 object-cover"
        />
      </div>

      <!-- Meta-Infos -->
      <div class="flex flex-wrap gap-4 mb-6 text-stone-600 dark:text-stone-400 text-sm">
        <span v-if="recipe.servings">🍽 {{ recipe.servings }} Portionen</span>
        <span v-if="recipe.prep_time">⏱ {{ recipe.prep_time }} Min. Vorbereitung</span>
        <span v-if="recipe.cook_time">🔥 {{ recipe.cook_time }} Min. Kochen</span>
        <span v-if="recipe.difficulty">📊 {{ difficultyLabel(recipe.difficulty) }}</span>
      </div>

      <!-- Zutaten -->
      <div v-if="recipe.ingredients?.length" class="bg-white dark:bg-stone-800 mb-6 p-5 border border-stone-200 dark:border-stone-700 rounded-2xl">
        <h2 class="mb-3 font-display font-bold text-stone-800 dark:text-stone-100 text-lg">Zutaten</h2>
        <ul class="space-y-2">
          <li v-for="(ing, i) in recipe.ingredients" :key="i" class="flex gap-2 text-stone-700 dark:text-stone-300 text-sm">
            <span class="min-w-16 font-medium text-right">{{ formatAmount(ing.amount) }} {{ ing.unit }}</span>
            <span>{{ ing.name }}</span>
            <span v-if="ing.notes" class="text-stone-400 text-xs">({{ ing.notes }})</span>
          </li>
        </ul>
      </div>

      <!-- Kochschritte -->
      <div v-if="recipe.steps?.length" class="bg-white dark:bg-stone-800 mb-6 p-5 border border-stone-200 dark:border-stone-700 rounded-2xl">
        <h2 class="mb-3 font-display font-bold text-stone-800 dark:text-stone-100 text-lg">Zubereitung</h2>
        <ol class="space-y-4">
          <li v-for="step in recipe.steps" :key="step.step_number" class="flex gap-4">
            <span class="flex justify-center items-center bg-primary-100 dark:bg-primary-900/40 rounded-full w-8 h-8 font-bold text-primary-600 text-sm shrink-0">
              {{ step.step_number }}
            </span>
            <div>
              <p v-if="step.title" class="font-semibold text-stone-800 dark:text-stone-100 text-sm">{{ step.title }}</p>
              <p class="text-stone-600 dark:text-stone-400 text-sm">{{ step.instruction }}</p>
              <span v-if="step.duration_minutes" class="text-stone-400 text-xs">~{{ step.duration_minutes }} Min.</span>
            </div>
          </li>
        </ol>
      </div>

      <!-- Import-Button (nur wenn eingeloggt) -->
      <div v-if="isLoggedIn" class="bg-primary-50 dark:bg-primary-900/20 p-5 border border-primary-200 dark:border-primary-800 rounded-2xl text-center">
        <p class="mb-3 text-stone-600 dark:text-stone-400 text-sm">
          Möchtest du dieses Rezept in deine Sammlung übernehmen?
        </p>
        <button
          @click="importRecipe"
          :disabled="importing"
          class="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-6 py-3 rounded-xl font-medium text-white text-sm transition-colors"
        >
          {{ importing ? 'Importiere...' : '📥 Rezept importieren' }}
        </button>
      </div>
      <div v-else class="bg-stone-50 dark:bg-stone-800 p-5 border border-stone-200 dark:border-stone-700 rounded-2xl text-center">
        <p class="text-stone-500 dark:text-stone-400 text-sm">
          <router-link to="/login" class="font-medium text-primary-600 hover:text-primary-700">Melde dich an</router-link>,
          um dieses Rezept in deine Sammlung zu importieren.
        </p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { apiRaw } from '@/composables/useApi.js';
import { useNotification } from '@/composables/useNotification.js';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { showSuccess, showError } = useNotification();

const loading = ref(true);
const error = ref(null);
const errorIcon = ref('🔗');
const errorTitle = ref('Nicht gefunden');
const sharedData = ref(null);
const recipe = computed(() => sharedData.value?.recipe || {});
const isLoggedIn = computed(() => authStore.isLoggedIn);
const importing = ref(false);

function formatAmount(amount) {
  if (!amount) return '';
  const n = Number(amount);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1).replace('.0', '');
}

function difficultyLabel(d) {
  const map = { easy: 'Einfach', medium: 'Mittel', hard: 'Schwer', einfach: 'Einfach', mittel: 'Mittel', schwer: 'Schwer' };
  return map[d] || d;
}

async function loadSharedRecipe() {
  try {
    const token = route.params.token;
    sharedData.value = await apiRaw(`/shared-recipes/${token}`);
  } catch (err) {
    if (err.message?.includes('abgelaufen')) {
      errorIcon.value = '⏰';
      errorTitle.value = 'Link abgelaufen';
      error.value = 'Dieser Share-Link ist nicht mehr gültig.';
    } else {
      error.value = err.message || 'Rezept nicht gefunden';
    }
  } finally {
    loading.value = false;
  }
}

async function importRecipe() {
  importing.value = true;
  try {
    const token = route.params.token;
    const result = await apiRaw(`/recipes/shared/${token}/import`, { method: 'POST' });
    showSuccess(result.message || 'Rezept importiert!');
    // Zur importierten Rezeptseite navigieren
    router.push(`/recipes/${result.recipe_id}`);
  } catch (err) {
    if (err.message?.includes('existiert bereits')) {
      showError('Du hast dieses Rezept bereits in deiner Sammlung.');
    } else {
      showError(err.message);
    }
  } finally {
    importing.value = false;
  }
}

onMounted(loadSharedRecipe);
</script>
