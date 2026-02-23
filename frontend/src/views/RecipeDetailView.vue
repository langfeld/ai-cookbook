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
          <div class="space-y-2 mt-6">
            <!-- Haupt-Aktionen: Kochen & Planen -->
            <div class="sm:flex sm:flex-wrap gap-2 grid grid-cols-2">
              <button
                v-if="recipe.steps?.length"
                @click="showCookingMode = true"
                class="flex justify-center items-center gap-2 bg-stone-800 hover:bg-stone-700 dark:bg-stone-700 dark:hover:bg-stone-600 px-4 py-2.5 rounded-lg font-medium text-white text-sm transition-colors"
              >
                <Maximize class="w-4 h-4" />
                Kochmodus
              </button>
              <button
                @click="markCooked"
                class="flex justify-center items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-white text-sm transition-colors bg-accent-600 hover:bg-accent-700"
              >
                <ChefHat class="w-4 h-4" />
                <span class="hidden sm:inline">Als gekocht markieren</span>
                <span class="sm:hidden">Gekocht ✓</span>
              </button>
              <button
                @click="plannerServings = adjustedServings; showPlannerModal = true"
                class="flex justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 px-4 py-2.5 rounded-lg font-medium text-white text-sm transition-colors"
              >
                <CalendarPlus class="w-4 h-4" />
                Zum Planer
              </button>
            </div>
            <!-- Sekundäre Aktionen: Verwalten -->
            <div class="flex flex-wrap gap-1.5">
              <AddToCollection v-if="recipe?.id" :recipe-id="recipe.id" />
              <router-link
                :to="'/recipes/new?edit=' + recipe.id"
                class="flex items-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 px-3 py-1.5 rounded-lg text-stone-500 dark:text-stone-400 text-sm transition-colors"
              >
                <Pencil class="w-3.5 h-3.5" />
                Bearbeiten
              </router-link>
              <button
                @click="showDeleteDialog = true"
                class="flex items-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg text-stone-400 hover:text-red-600 dark:hover:text-red-400 dark:text-stone-500 text-sm transition-colors"
              >
                <Trash2 class="w-3.5 h-3.5" />
                Löschen
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Portionsrechner + Zutaten -->
      <div class="bg-white dark:bg-stone-900 p-4 sm:p-6 border border-stone-200 dark:border-stone-800 rounded-xl">
        <div class="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-3 mb-4">
          <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">
            🥕 Zutaten
          </h2>
          <div class="flex items-center gap-3">
            <!-- Ansichts-Toggle (nur bei echten Gruppen) -->
            <div v-if="hasGroups" class="flex bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg">
              <button
                @click="ingredientView = 'all'"
                :class="[
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  ingredientView === 'all'
                    ? 'bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 shadow-sm'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
                ]"
                title="Alle Zutaten"
              >
                <List class="w-3.5 h-3.5" />
                Alle
              </button>
              <button
                @click="ingredientView = 'grouped'"
                :class="[
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  ingredientView === 'grouped'
                    ? 'bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 shadow-sm'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
                ]"
                title="Nach Schritten gruppiert"
              >
                <Layers class="w-3.5 h-3.5" />
                Gruppiert
              </button>
            </div>
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
        </div>

        <!-- Zutaten-Liste: Alle (flach, zusammengeführt) -->
        <ul v-if="ingredientView === 'all' || !hasGroups" class="space-y-2">
          <li
            v-for="ing in flatIngredients"
            :key="ing.id"
            class="flex items-center gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <span class="w-5 text-base text-center shrink-0" :title="ing.name">{{ getEmoji(ing.name) || '•' }}</span>
            <span class="w-20 font-medium text-stone-800 dark:text-stone-200 text-sm text-right">
              {{ scaleAmount(ing.amount) }} {{ ing.unit }}
            </span>
            <span class="flex-1 text-stone-700 dark:text-stone-300 text-sm">
              {{ ing.name }}
              <span v-if="getConversion(ing)"
                    class="ml-1.5 text-stone-400 dark:text-stone-500 text-xs"
                    :title="getConversion(ing).rule">
                ≈ {{ getConversion(ing).amount }}&nbsp;{{ getConversion(ing).unit }}
              </span>
              <span v-if="ing.is_optional" class="ml-1 text-stone-400 text-xs">(optional)</span>
              <span v-if="ing.notes" class="ml-1 text-stone-400 text-xs">– {{ ing.notes }}</span>
            </span>
          </li>
        </ul>

        <!-- Zutaten-Liste: Gruppiert nach Schritten -->
        <div v-else class="space-y-4">
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
                <span class="w-5 text-base text-center shrink-0" :title="ing.name">{{ getEmoji(ing.name) || '•' }}</span>
                <span class="w-20 font-medium text-stone-800 dark:text-stone-200 text-sm text-right">
                  {{ scaleAmount(ing.amount) }} {{ ing.unit }}
                </span>
                <span class="flex-1 text-stone-700 dark:text-stone-300 text-sm">
                  {{ ing.name }}
                  <span v-if="getConversion(ing)"
                        class="ml-1.5 text-stone-400 dark:text-stone-500 text-xs"
                        :title="getConversion(ing).rule">
                    ≈ {{ getConversion(ing).amount }}&nbsp;{{ getConversion(ing).unit }}
                  </span>
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

    <!-- ═══════════════════ WOCHENPLANER MODAL ═══════════════════ -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showPlannerModal" class="z-50 fixed inset-0 flex justify-center items-center bg-black/40 p-4" @click.self="showPlannerModal = false">
          <div class="bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-700 rounded-2xl w-full max-w-md overflow-hidden">
            <!-- Header -->
            <div class="flex justify-between items-center p-5 border-stone-200 dark:border-stone-700 border-b">
              <h3 class="font-bold text-stone-800 dark:text-stone-100 text-lg">📅 Zum Wochenplaner</h3>
              <button @click="showPlannerModal = false"
                class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-full transition-colors">
                <X class="w-5 h-5 text-stone-500" />
              </button>
            </div>

            <div class="space-y-5 p-5">
              <!-- Wochen-Navigation -->
              <div>
                <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Woche</label>
                <div class="flex items-center gap-2">
                  <button @click="plannerWeekOffset--"
                    class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg transition-colors">
                    <ChevronLeft class="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  </button>
                  <span class="flex-1 font-medium text-stone-700 dark:text-stone-300 text-sm text-center">
                    {{ plannerWeekLabel }}
                  </span>
                  <button @click="plannerWeekOffset++"
                    class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg transition-colors">
                    <ChevronRight class="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  </button>
                </div>
              </div>

              <!-- Tag auswählen -->
              <div>
                <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Tag</label>
                <div class="gap-1.5 grid grid-cols-7">
                  <button v-for="(day, idx) in plannerWeekDays" :key="idx"
                    @click="plannerDay = idx"
                    :class="[
                      'flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-medium transition-colors',
                      plannerDay === idx
                        ? 'bg-primary-600 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                    ]">
                    <span>{{ day.short }}</span>
                    <span class="opacity-75 text-[10px]">{{ day.date }}</span>
                  </button>
                </div>
              </div>

              <!-- Slot auswählen -->
              <div>
                <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Mahlzeit</label>
                <div class="gap-2 grid grid-cols-2">
                  <button v-for="mt in plannerMealTypes" :key="mt.key"
                    @click="plannerSlot = mt.key"
                    :class="[
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      plannerSlot === mt.key
                        ? 'bg-primary-600 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                    ]">
                    <span>{{ mt.icon }}</span> {{ mt.label }}
                  </button>
                </div>
              </div>

              <!-- Portionen -->
              <div>
                <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Portionen</label>
                <div class="flex items-center gap-3">
                  <button @click="plannerServings = Math.max(1, plannerServings - 1)"
                    class="flex justify-center items-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-full w-9 h-9 transition-colors">
                    <Minus class="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  </button>
                  <span class="w-16 font-semibold text-stone-700 dark:text-stone-300 text-center">{{ plannerServings }}</span>
                  <button @click="plannerServings++"
                    class="flex justify-center items-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-full w-9 h-9 transition-colors">
                    <Plus class="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  </button>
                </div>
              </div>

              <!-- Hinzufügen Button -->
              <button @click="addToPlan" :disabled="addingToPlan"
                class="flex justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 shadow-sm px-4 py-3 rounded-xl w-full font-medium text-white transition-colors">
                <CalendarPlus v-if="!addingToPlan" class="w-5 h-5" />
                <div v-else class="border-2 border-white/30 border-t-white rounded-full w-5 h-5 animate-spin" />
                {{ addingToPlan ? 'Wird hinzugefügt…' : 'Zum Wochenplan hinzufügen' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Kochmodus (Vollbild) -->
    <CookingMode
      v-if="recipe"
      v-model="showCookingMode"
      :recipe="recipe"
      :adjusted-servings="adjustedServings"
      :conversion-map="conversionMap"
      @finished="handleCookingFinished"
    />

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
import { useMealPlanStore } from '@/stores/mealplan.js';
import { useNotification } from '@/composables/useNotification.js';
import { Star, Clock, Users, ChefHat, Pencil, Plus, Minus, Trash2, List, Layers, CalendarPlus, X, ChevronLeft, ChevronRight, Maximize } from 'lucide-vue-next';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import AddToCollection from '@/components/collections/AddToCollection.vue';
import CookingMode from '@/components/recipes/CookingMode.vue';
import { useIngredientIcons } from '@/composables/useIngredientIcons.js';
import { apiRaw } from '@/composables/useApi.js';
import { formatAmount } from '@/utils/formatAmount.js';

const route = useRoute();
const router = useRouter();
const recipesStore = useRecipesStore();
const mealPlanStore = useMealPlanStore();
const { showSuccess } = useNotification();
const { loadIcons, getEmoji } = useIngredientIcons();

const recipe = computed(() => recipesStore.currentRecipe);
const adjustedServings = ref(4);
const showDeleteDialog = ref(false);
const deleting = ref(false);
const ingredientView = ref('all');
const showCookingMode = ref(false);
const conversionMap = ref(new Map());

// ─── Wochenplaner-Modal ───
const showPlannerModal = ref(false);
const addingToPlan = ref(false);
const plannerWeekOffset = ref(0);
const plannerDay = ref((() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })());
const plannerSlot = ref('mittag');
const plannerServings = ref(4);

const plannerMealTypes = [
  { key: 'fruehstueck', label: 'Frühstück', icon: '🌅' },
  { key: 'mittag', label: 'Mittag', icon: '☀️' },
  { key: 'abendessen', label: 'Abend', icon: '🌙' },
  { key: 'snack', label: 'Snack', icon: '🍎' },
];

const plannerWeekStart = computed(() => {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1) + plannerWeekOffset.value * 7);
  return monday.toISOString().split('T')[0];
});

const plannerWeekDays = computed(() => {
  const [y, m, d] = plannerWeekStart.value.split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  return ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((short, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return { short, date: `${dt.getDate()}.${dt.getMonth() + 1}.` };
  });
});

const plannerWeekLabel = computed(() => {
  const [y, m, d] = plannerWeekStart.value.split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt) => `${dt.getDate()}.${dt.getMonth() + 1}.`;
  return `${fmt(monday)} – ${fmt(sunday)}${sunday.getFullYear()}`;
});

async function addToPlan() {
  addingToPlan.value = true;
  try {
    const result = await mealPlanStore.addRecipeToPlan(
      recipe.value.id,
      plannerDay.value,
      plannerSlot.value,
      plannerWeekStart.value,
      plannerServings.value,
    );
    showPlannerModal.value = false;
    const dayLabel = plannerWeekDays.value[plannerDay.value]?.short || '';
    const slotLabel = plannerMealTypes.find(mt => mt.key === plannerSlot.value)?.label || '';
    const icon = result.replaced ? '🔄' : '📅';
    showSuccess(`${result.message || 'Zum Wochenplan hinzugefügt'} (${dayLabel}, ${slotLabel}) ${icon}`);
  } catch {
    // Fehler wird von useApi angezeigt
  } finally {
    addingToPlan.value = false;
  }
}

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

// Gibt es echte Gruppen? (Toggle nur anzeigen wenn ja)
const hasGroups = computed(() => {
  const keys = Object.keys(groupedIngredients.value);
  return keys.length > 1 || (keys.length === 1 && keys[0] !== 'default');
});

// Flache Zutatenliste — gleiche Zutat+Einheit zusammenführen
const flatIngredients = computed(() => {
  const ingredients = recipe.value?.ingredients || [];
  const merged = new Map();
  for (const ing of ingredients) {
    const key = `${ing.name.toLowerCase()}::${(ing.unit || '').toLowerCase()}`;
    if (merged.has(key)) {
      const existing = merged.get(key);
      existing.amount = (existing.amount || 0) + (ing.amount || 0);
      // Optional/Notes zusammenführen
      if (ing.notes && !existing.notes?.includes(ing.notes)) {
        existing.notes = [existing.notes, ing.notes].filter(Boolean).join(', ');
      }
    } else {
      merged.set(key, { ...ing });
    }
  }
  return [...merged.values()];
});

// Portionsrechner: Menge umrechnen (Rohwert für Berechnungen)
function scaleAmountRaw(amount) {
  if (!amount || !recipe.value?.servings) return 0;
  return (amount / recipe.value.servings) * adjustedServings.value;
}

// Formatierte Anzeige mit Unicode-Brüchen (½, ¼, ¾ …)
function scaleAmount(amount) {
  const raw = scaleAmountRaw(amount);
  return raw ? formatAmount(raw) : '';
}

// Umgerechnete Menge für eine Zutat (z. B. 2 Stk → ≈ 160 g)
function getConversion(ing) {
  if (!ing.unit || !ing.amount) return null;
  const key = `${ing.name.toLowerCase()}|${ing.unit.toLowerCase()}`;
  const conv = conversionMap.value.get(key);
  if (!conv) return null;
  const scaled = scaleAmountRaw(ing.amount);
  if (!scaled) return null;
  return {
    amount: formatAmount(scaled * conv.to_amount),
    unit: conv.to_unit,
    rule: `1 ${ing.unit} ≈ ${formatAmount(conv.to_amount)} ${conv.to_unit}`,
  };
}

// Zutat-Farbe bestimmen (anhand des Namens) – nur Fallback für "•"
// Wird nicht mehr benötigt, da jetzt Emojis verwendet werden.

// Zutaten im Kochschritt-Text hervorheben (mit Emoji-Prefix)
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

  // Map für schnelles Emoji-Lookup (escaped name → original name)
  const nameMap = new Map();
  uniqueNames.forEach((n, i) => nameMap.set(escapedNames[i].toLowerCase(), n));

  const combined = new RegExp('\\b(' + escapedNames.join('|') + ')\\b', 'gi');
  result = result.replace(combined, (match) => {
    const emoji = getEmoji(nameMap.get(match.toLowerCase()) || match);
    const prefix = emoji ? emoji + ' ' : '';
    return '<span class="ingredient-highlight">' + prefix + match + '</span>';
  });

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

async function handleCookingFinished() {
  await markCooked();
}

async function deleteRecipe() {
  deleting.value = true;
  try {
    await recipesStore.deleteRecipe(recipe.value.id);
    showDeleteDialog.value = false;
    showSuccess('Rezept gelöscht! 🗑️');
    router.push('/recipes');
  } catch {
    // Fehler wird von useApi angezeigt
  } finally {
    deleting.value = false;
  }
}

async function loadConversions() {
  try {
    const data = await apiRaw('/ingredient-conversions');
    const map = new Map();
    for (const c of data.conversions || []) {
      map.set(`${c.ingredient_name.toLowerCase()}|${c.from_unit.toLowerCase()}`, {
        to_amount: c.to_amount,
        to_unit: c.to_unit,
      });
    }
    conversionMap.value = map;
  } catch { /* Umrechnungen sind optional */ }
}

onMounted(async () => {
  await loadIcons();
  await Promise.all([
    recipesStore.fetchRecipe(route.params.id),
    loadConversions(),
  ]);
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
