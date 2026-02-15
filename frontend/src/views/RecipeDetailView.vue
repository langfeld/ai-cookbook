<!--
  ============================================
  RecipeDetailView - Rezeptdetails
  ============================================
  Vollständige Ansicht eines Rezepts mit:
  - Zutatenliste (mit farblichen Hervorhebungen)
  - Kochschritte (unterteilt)
  - Portionsrechner
  - Favoriten, Bewertung, Kochhistorie
-->
<template>
  <div>
    <!-- Rezept-Inhalt -->
    <div v-if="recipe" class="space-y-6 mx-auto max-w-4xl animate-fade-in">
      <!-- Header -->
      <div class="flex md:flex-row flex-col gap-6">
        <!-- Bild -->
        <div class="bg-stone-100 dark:bg-stone-800 rounded-2xl w-full md:w-80 aspect-video md:aspect-square overflow-hidden shrink-0">
          <img v-if="recipe.image_url" :src="recipe.image_url" :alt="recipe.title" class="w-full h-full object-cover" />
          <div v-else class="flex justify-center items-center w-full h-full text-6xl">🍽️</div>
        </div>

        <!-- Info -->
        <div class="flex-1">
          <div class="flex justify-between items-start gap-2">
            <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl sm:text-3xl">{{ recipe.title }}</h1>
            <button
              @click="recipesStore.toggleFavorite(recipe.id)"
              class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg"
            >
              <Star class="w-6 h-6" :class="recipe.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-stone-300'" />
            </button>
          </div>
          <p class="mt-2 text-stone-500 dark:text-stone-400">{{ recipe.description }}</p>

          <!-- Meta-Badges -->
          <div class="flex flex-wrap gap-3 mt-4">
            <span class="meta-badge">
              <Clock class="w-4 h-4" />
              {{ recipe.total_time }} Min.
            </span>
            <span class="meta-badge">
              <Users class="w-4 h-4" />
              {{ recipe.servings }} Portionen
            </span>
            <span class="meta-badge" :class="difficultyColor">
              {{ difficultyEmoji }} {{ recipe.difficulty }}
            </span>
            <span v-if="recipe.times_cooked" class="meta-badge">
              <ChefHat class="w-4 h-4" />
              {{ recipe.times_cooked }}x gekocht
            </span>
          </div>

          <!-- Kategorien -->
          <div v-if="recipe.categories?.length" class="flex flex-wrap gap-2 mt-4">
            <span
              v-for="cat in recipe.categories"
              :key="cat.id"
              :style="{ borderColor: cat.color + '60', backgroundColor: cat.color + '15' }"
              class="px-3 py-1 border rounded-full text-sm"
            >
              {{ cat.icon }} {{ cat.name }}
            </span>
          </div>

          <!-- Aktionen -->
          <div class="flex flex-wrap gap-2 mt-6">
            <button
              @click="markCooked"
              class="flex sm:flex-initial flex-1 justify-center items-center gap-2 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors bg-accent-600 hover:bg-accent-700"
            >
              <ChefHat class="w-4 h-4" />
              <span class="hidden sm:inline">Als gekocht markieren</span>
              <span class="sm:hidden">Gekocht</span>
            </button>
            <router-link
              :to="'/recipes/new?edit=' + recipe.id"
              class="flex sm:flex-initial flex-1 justify-center items-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-800 px-4 py-2 border border-stone-300 dark:border-stone-600 rounded-lg text-stone-700 dark:text-stone-300 text-sm transition-colors"
            >
              <Pencil class="w-4 h-4" />
              Bearbeiten
            </router-link>
            <button
              @click="showDeleteDialog = true"
              class="flex sm:flex-initial flex-1 justify-center items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 border border-red-300 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm transition-colors"
            >
              <Trash2 class="w-4 h-4" />
              Löschen
            </button>
          </div>
        </div>
      </div>

      <!-- Portionsrechner + Zutaten -->
      <div class="bg-white dark:bg-stone-900 p-4 sm:p-6 border border-stone-200 dark:border-stone-800 rounded-xl">
        <div class="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-3 mb-4">
          <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">
            🥕 Zutaten
          </h2>
          <!-- Portionsrechner -->
          <div class="flex items-center gap-2">
            <button
              @click="adjustedServings = Math.max(1, adjustedServings - 1)"
              class="flex justify-center items-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-full w-8 h-8 text-stone-600 dark:text-stone-400"
            >
              <Minus class="w-4 h-4" />
            </button>
            <span class="w-20 font-medium text-stone-700 dark:text-stone-300 text-sm text-center">
              {{ adjustedServings }} Port.
            </span>
            <button
              @click="adjustedServings++"
              class="flex justify-center items-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-full w-8 h-8 text-stone-600 dark:text-stone-400"
            >
              <Plus class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Zutaten-Liste (gruppiert) -->
        <div class="space-y-4">
          <div v-for="(group, groupName) in groupedIngredients" :key="groupName">
            <h3 v-if="groupName !== 'default'" class="mb-2 font-medium text-stone-500 dark:text-stone-400 text-sm">
              {{ groupName }}
            </h3>
            <ul class="space-y-2">
              <li
                v-for="ing in group"
                :key="ing.id"
                class="flex items-center gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <span :class="['w-2 h-2 rounded-full shrink-0', ingredientColor(ing.name)]" />
                <span class="w-20 font-medium text-stone-800 dark:text-stone-200 text-sm text-right">
                  {{ scaleAmount(ing.amount) }} {{ ing.unit }}
                </span>
                <span class="flex-1 text-stone-700 dark:text-stone-300 text-sm">
                  {{ ing.name }}
                  <span v-if="ing.is_optional" class="ml-1 text-stone-400 text-xs">(optional)</span>
                  <span v-if="ing.notes" class="ml-1 text-stone-400 text-xs">– {{ ing.notes }}</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Kochschritte -->
      <div class="bg-white dark:bg-stone-900 p-4 sm:p-6 border border-stone-200 dark:border-stone-800 rounded-xl">
        <h2 class="mb-6 font-semibold text-stone-800 dark:text-stone-100 text-lg">
          👨‍🍳 Zubereitung
        </h2>
        <div class="space-y-6">
          <div
            v-for="step in recipe.steps"
            :key="step.id"
            class="flex gap-4"
          >
            <div class="flex justify-center items-center bg-primary-100 dark:bg-primary-900/50 rounded-full w-8 h-8 shrink-0">
              <span class="font-bold text-primary-700 dark:text-primary-300 text-sm">{{ step.step_number }}</span>
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <h3 v-if="step.title" class="font-medium text-stone-800 dark:text-stone-200">{{ step.title }}</h3>
                <span v-if="step.duration_minutes" class="flex items-center gap-1 text-stone-400 text-xs">
                  <Clock class="w-3 h-3" /> {{ step.duration_minutes }} Min.
                </span>
              </div>
              <p class="text-stone-600 dark:text-stone-400 text-sm leading-relaxed" v-html="highlightIngredients(step.instruction)" />
            </div>
          </div>
        </div>
      </div>

      <!-- Kochhistorie -->
      <div v-if="recipe.history?.length" class="bg-white dark:bg-stone-900 p-4 sm:p-6 border border-stone-200 dark:border-stone-800 rounded-xl">
        <h2 class="mb-4 font-semibold text-stone-800 dark:text-stone-100 text-lg">
          📊 Kochhistorie
        </h2>
        <div class="space-y-2">
          <div
            v-for="entry in recipe.history"
            :key="entry.id"
            class="flex items-center gap-3 text-stone-600 dark:text-stone-400 text-sm"
          >
            <span>{{ formatDate(entry.cooked_at) }}</span>
            <span v-if="entry.rating" class="text-amber-400">{{ '⭐'.repeat(entry.rating) }}</span>
            <span v-if="entry.notes" class="text-stone-400">– {{ entry.notes }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Laden -->
    <div v-else class="flex justify-center py-16">
      <div class="border-2 border-primary-200 border-t-primary-600 rounded-full w-8 h-8 animate-spin" />
    </div>

    <!-- Bestätigungs-Dialog zum Löschen -->
    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Rezept löschen?"
      :message="deleteMessage"
      confirm-text="Endgültig löschen"
      cancel-text="Abbrechen"
      variant="danger"
      :loading="deleting"
      @confirm="deleteRecipe"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRecipesStore } from '@/stores/recipes.js';
import { useNotification } from '@/composables/useNotification.js';
import { Star, Clock, Users, ChefHat, Pencil, Plus, Minus, Trash2 } from 'lucide-vue-next';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const route = useRoute();
const router = useRouter();
const recipesStore = useRecipesStore();
const { showSuccess, showError } = useNotification();

const recipe = computed(() => recipesStore.currentRecipe);
const adjustedServings = ref(4);
const showDeleteDialog = ref(false);
const deleting = ref(false);

const deleteMessage = computed(() => {
  const title = recipe.value?.title || 'dieses Rezept';
  return 'Möchtest du „' + title + '" wirklich unwiderruflich löschen? Alle Zutaten, Schritte und die Kochhistorie gehen verloren.';
});

// Schwierigkeitsgrad-Darstellung
const difficultyEmoji = computed(() => ({ leicht: '🟢', mittel: '🟡', schwer: '🔴' })[recipe.value?.difficulty] || '🟡');
const difficultyColor = computed(() => ({
  leicht: 'text-green-700 dark:text-green-400',
  mittel: 'text-amber-700 dark:text-amber-400',
  schwer: 'text-red-700 dark:text-red-400',
})[recipe.value?.difficulty] || '');

// Zutaten nach Gruppe sortieren
const groupedIngredients = computed(() => {
  const groups = {};
  for (const ing of recipe.value?.ingredients || []) {
    const group = ing.group_name || 'default';
    if (!groups[group]) groups[group] = [];
    groups[group].push(ing);
  }
  return groups;
});

// Portionsrechner: Menge umrechnen
function scaleAmount(amount) {
  if (!amount || !recipe.value?.servings) return '';
  const scaled = (amount / recipe.value.servings) * adjustedServings.value;
  return Math.round(scaled * 100) / 100;
}

// Zutat-Farbe bestimmen (anhand des Namens)
function ingredientColor(name) {
  const lower = name.toLowerCase();
  if (/fleisch|schinken|speck|huhn|rind|schwein|hack|wurst/i.test(lower)) return 'bg-red-400';
  if (/milch|sahne|käse|joghurt|butter|quark|ei/i.test(lower)) return 'bg-blue-400';
  if (/salat|tomate|paprika|zwiebel|knoblauch|kartoffel|möhre|gurke|zucchini|spinat|pilz/i.test(lower)) return 'bg-green-400';
  if (/salz|pfeffer|gewürz|oregano|basilikum|thymian|paprikapulver|zimt|curry/i.test(lower)) return 'bg-amber-400';
  if (/mehl|nudel|reis|brot|haferflocken|pasta|spaghetti/i.test(lower)) return 'bg-yellow-400';
  return 'bg-stone-400';
}

// Zutaten im Kochschritt-Text hervorheben
function highlightIngredients(text) {
  if (!text || !recipe.value?.ingredients) return escapeHtml(text || '');

  // Zuerst HTML escapen, dann Highlights einfügen
  let result = escapeHtml(text);

  // Zutatennamen deduplizieren und nach Länge sortieren (längste zuerst),
  // damit "Olivenöl" vor "Öl" matcht und kein doppeltes Wrapping entsteht
  const uniqueNames = [...new Set(recipe.value.ingredients.map(i => i.name))];
  uniqueNames.sort((a, b) => b.length - a.length);

  // Einzelne Regex mit Alternation: alle Zutaten in einem Durchlauf ersetzen
  const escapedNames = uniqueNames.map(n =>
    escapeHtml(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  if (!escapedNames.length) return result;

  const combined = new RegExp('\\b(' + escapedNames.join('|') + ')\\b', 'gi');
  result = result.replace(combined, '<span class="ingredient-highlight">$1</span>');

  return result;
}

// HTML-Entities escapen um XSS über v-html zu verhindern
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function markCooked() {
  await recipesStore.markAsCooked(recipe.value.id, { servings: adjustedServings.value });
  showSuccess('Als gekocht markiert! 👨‍🍳');
  await recipesStore.fetchRecipe(recipe.value.id);
}

async function deleteRecipe() {
  deleting.value = true;
  try {
    await recipesStore.deleteRecipe(recipe.value.id);
    showDeleteDialog.value = false;
    showSuccess('Rezept gelöscht! 🗑️');
    router.push('/recipes');
  } catch (err) {
    showError('Fehler beim Löschen: ' + err.message);
  } finally {
    deleting.value = false;
  }
}

onMounted(async () => {
  await recipesStore.fetchRecipe(route.params.id);
  if (recipe.value) {
    adjustedServings.value = recipe.value.servings;
  }
});
</script>

<style scoped>
.meta-badge {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  background-color: var(--color-stone-100);
  padding-inline: calc(var(--spacing) * 3);
  padding-block: calc(var(--spacing) * 1);
  border-radius: var(--radius-full);
  color: var(--color-stone-600);
  font-size: var(--text-sm);
  line-height: var(--text-sm--line-height);
}
:is(.dark .meta-badge) {
  background-color: var(--color-stone-800);
  color: var(--color-stone-400);
}
</style>
