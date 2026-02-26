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
    <div v-if="recipe" class="space-y-6 animate-fade-in">

      <!-- ═══════ HEADER ═══════ -->
      <div class="flex md:flex-row flex-col gap-6">
        <!-- Bild -->
        <div class="bg-stone-100 dark:bg-stone-800 rounded-xl w-full md:w-72 lg:w-80 aspect-video md:aspect-4/3 overflow-hidden shrink-0">
          <img v-if="recipe.image_url" :src="recipe.image_url" :alt="recipe.title" class="w-full h-full object-cover" />
          <div v-else class="flex justify-center items-center w-full h-full text-5xl">🍽️</div>
        </div>
        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-start gap-2">
            <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-xl sm:text-2xl leading-tight">{{ recipe.title }}</h1>
            <button @click="recipesStore.toggleFavorite(recipe.id)" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg shrink-0">
              <Star class="w-5 h-5" :class="recipe.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-stone-300'" />
            </button>
          </div>
          <p v-if="recipe.description" class="mt-1.5 text-stone-500 dark:text-stone-400 text-sm line-clamp-2">{{ recipe.description }}</p>

          <!-- Meta -->
          <div class="flex flex-wrap items-center gap-2 mt-4">
            <span class="meta-badge"><Clock class="w-3.5 h-3.5" /> {{ recipe.total_time }} Min.</span>
            <span class="meta-badge"><Users class="w-3.5 h-3.5" /> {{ recipe.servings }} Port.</span>
            <span class="meta-badge" :class="difficultyColor">{{ difficultyEmoji }} {{ recipe.difficulty }}</span>
            <span v-if="recipe.times_cooked" class="meta-badge"><ChefHat class="w-3.5 h-3.5" /> {{ recipe.times_cooked }}×</span>
          </div>

          <!-- Kategorien -->
          <div v-if="recipe.categories?.length" class="flex flex-wrap gap-1.5 mt-2.5">
            <span v-for="cat in recipe.categories" :key="cat.id"
              :style="{ borderColor: cat.color + '60', backgroundColor: cat.color + '15' }"
              class="px-2.5 py-0.5 border rounded-full text-xs">
              {{ cat.icon }} {{ cat.name }}
            </span>
          </div>

          <!-- Aktionen -->
          <div class="flex flex-wrap items-center gap-2 mt-4">
            <button v-if="recipe.steps?.length" @click="showCookingMode = true"
              class="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 dark:bg-stone-700 dark:hover:bg-stone-600 px-3 py-1.5 rounded-lg font-medium text-white text-sm transition-colors">
              <Maximize class="w-3.5 h-3.5" /> Kochmodus
            </button>
            <button @click="markCooked"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-white text-sm transition-colors bg-accent-600 hover:bg-accent-700">
              <ChefHat class="w-3.5 h-3.5" /> Gekocht ✓
            </button>
            <button @click="plannerServings = adjustedServings; showPlannerModal = true"
              class="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg font-medium text-white text-sm transition-colors">
              <CalendarPlus class="w-3.5 h-3.5" /> Planer
            </button>
            <AddToCollection v-if="recipe?.id" :recipe-id="recipe.id" />
            <router-link :to="'/recipes/new?edit=' + recipe.id"
              class="flex items-center gap-1 hover:bg-stone-100 dark:hover:bg-stone-800 px-2.5 py-1.5 rounded-lg text-stone-500 dark:text-stone-400 text-xs transition-colors">
              <Pencil class="w-3 h-3" /> Bearbeiten
            </router-link>
            <button @click="showDeleteDialog = true"
              class="flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-900/20 px-2.5 py-1.5 rounded-lg text-stone-400 hover:text-red-600 dark:hover:text-red-400 dark:text-stone-500 text-xs transition-colors">
              <Trash2 class="w-3 h-3" /> Löschen
            </button>
          </div>
        </div>
      </div>

      <!-- ═══════ ZWEI-SPALTEN: ZUTATEN + ZUBEREITUNG ═══════ -->
      <div class="lg:items-stretch lg:gap-6 space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[minmax(272px,320px)_1fr]">

        <!-- ── ZUTATEN (links, sticky auf Desktop) ── -->
        <div class="lg:top-4 lg:sticky lg:self-stretch bg-white dark:bg-stone-900 p-4 border border-stone-200 dark:border-stone-800 rounded-xl">
          <h2 class="mb-3 font-semibold text-stone-800 dark:text-stone-100 text-base">🥕 Zutaten</h2>

          <!-- Portionsrechner -->
          <div class="flex flex-wrap items-center gap-2 mb-3 pb-3 border-stone-100 dark:border-stone-800 border-b">
            <div class="flex items-center gap-1.5">
              <button @click="adjustedServings = Math.max(1, adjustedServings - 1)"
                class="flex justify-center items-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-full w-7 h-7 text-stone-600 dark:text-stone-400">
                <Minus class="w-3.5 h-3.5" />
              </button>
              <span class="w-14 font-medium text-stone-700 dark:text-stone-300 text-sm text-center">{{ adjustedServings }} Port.</span>
              <button @click="adjustedServings++"
                class="flex justify-center items-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-full w-7 h-7 text-stone-600 dark:text-stone-400">
                <Plus class="w-3.5 h-3.5" />
              </button>
            </div>
            <button @click="toggleAdjustmentMode"
              :class="[
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                adjustmentMode
                  ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
              ]"
              :title="adjustmentMode ? 'Mengen-Anpassung deaktivieren' : 'Einzelne Mengen anpassen'">
              <Warehouse class="w-3 h-3" />
              {{ adjustmentMode ? 'Aktiv' : 'Anpassen' }}
            </button>
            <button v-if="adjustmentMode && overrideCount > 0" @click="resetAllOverrides"
              class="flex items-center gap-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 text-xs transition-colors">
              <RotateCcw class="w-3 h-3" /> Reset ({{ overrideCount }})
            </button>
          </div>

          <!-- Zutaten-Liste -->
          <ul class="space-y-0.5">
            <li v-for="ing in flatIngredients" :key="ing.id"
              class="flex items-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-800/50 px-1.5 py-1 rounded-md transition-colors"
              :class="adjustmentMode ? 'flex-wrap' : ''">
              <span class="w-5 text-sm text-center shrink-0" :title="ing.name">{{ getEmoji(ing.name) || '•' }}</span>

              <!-- Normal -->
              <template v-if="!adjustmentMode">
                <span class="font-medium text-stone-800 dark:text-stone-200 text-sm text-right shrink-0"
                  :class="ing.amounts.length > 1 ? 'min-w-16' : 'w-16'">
                  <template v-for="(a, i) in ing.amounts" :key="i">
                    <template v-if="i > 0">, </template>
                    {{ scaleAmount(a.amount) }}&nbsp;{{ a.unit }}
                  </template>
                </span>
              </template>

              <!-- Anpassungsmodus -->
              <template v-else>
                <span class="flex items-center gap-1 shrink-0">
                  <template v-if="ing.amounts.length === 1">
                    <input type="number"
                      :value="hasOverride(ing.name) ? ingredientOverrides[ing.name.toLowerCase().trim()] : Math.round(scaleAmountRaw(ing.amounts[0].amount) * 100) / 100"
                      @change="setIngredientOverride(ing.name.toLowerCase().trim(), $event.target.value)"
                      step="any" min="0"
                      class="bg-white dark:bg-stone-800 py-0.5 pr-1 pl-1.5 border border-stone-300 focus:border-primary-400 dark:border-stone-600 rounded focus:outline-none focus:ring-1 focus:ring-primary-400 w-14 font-medium text-stone-800 dark:text-stone-200 text-sm text-right ingredient-number-input"
                      :class="hasOverride(ing.name) ? 'ring-1 ring-primary-300 dark:ring-primary-600 border-primary-300 dark:border-primary-600' : ''" />
                    <span v-if="getPantryInfo(ing.name)" class="tabular-nums text-xs whitespace-nowrap"
                      :class="
                        getPantryInfo(ing.name).isPermanent
                          ? 'text-stone-400 dark:text-stone-500'
                          : getPantryInfo(ing.name).amount >= getEffectiveAmount(ing)
                            ? 'text-stone-400 dark:text-stone-500'
                            : getPantryInfo(ing.name).amount > 0
                              ? 'text-amber-500 dark:text-amber-400'
                              : 'text-red-400 dark:text-red-400'
                      "
                    >/ <template v-if="getPantryInfo(ing.name).isPermanent">∞</template><template v-else>{{ getPantryInfo(ing.name).amount ? formatAmount(getPantryInfo(ing.name).amount) : '0' }}</template></span>
                    <span class="text-stone-500 dark:text-stone-400 text-xs">{{ ing.amounts[0].unit }}</span>
                  </template>
                  <template v-else>
                    <span class="font-medium text-stone-800 dark:text-stone-200 text-sm text-right">
                      <template v-for="(a, i) in ing.amounts" :key="i">
                        <template v-if="i > 0">, </template>
                        {{ scaleAmount(a.amount) }}&nbsp;{{ a.unit }}
                      </template>
                    </span>
                  </template>
                  <button v-if="hasOverride(ing.name)"
                    @click="resetIngredientOverride(ing.name.toLowerCase().trim())"
                    class="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors" title="Zurücksetzen">
                    <RotateCcw class="w-3 h-3" />
                  </button>
                </span>
              </template>

              <span class="text-stone-700 dark:text-stone-300 text-sm" :class="adjustmentMode ? 'basis-full sm:basis-auto sm:flex-1 pl-7 sm:pl-0 -mt-1 sm:mt-0' : 'flex-1'">
                {{ ing.name }}
                <span v-if="ing.is_optional" class="ml-1 text-stone-400 text-xs">(optional)</span>
                <span v-if="ing.notes" class="ml-1 text-stone-400 text-xs">– {{ ing.notes }}</span>
              </span>
            </li>
          </ul>
        </div>

        <!-- ── ZUBEREITUNG + HISTORIE (rechts) ── -->
        <div class="flex flex-col gap-6">
          <!-- Zubereitung -->
          <div class="flex-1 bg-white dark:bg-stone-900 p-5 border border-stone-200 dark:border-stone-800 rounded-xl">
            <h2 class="mb-5 font-semibold text-stone-800 dark:text-stone-100 text-base">👨‍🍳 Zubereitung</h2>
            <div class="space-y-8">
              <div v-for="step in recipe.steps" :key="step.id" class="flex gap-3">
                <div class="flex justify-center items-center bg-primary-100 dark:bg-primary-900/50 mt-0.5 rounded-full w-7 h-7 shrink-0">
                  <span class="font-bold text-primary-700 dark:text-primary-300 text-xs">{{ step.step_number }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <h3 v-if="step.title" class="font-medium text-stone-800 dark:text-stone-200 text-sm">{{ step.title }}</h3>
                    <span v-if="step.duration_minutes" class="flex items-center gap-1 text-stone-400 text-xs whitespace-nowrap shrink-0">
                      <Clock class="w-3 h-3" /> {{ step.duration_minutes }} Min.
                    </span>
                  </div>
                  <p class="text-stone-600 dark:text-stone-400 text-sm leading-relaxed" v-html="highlightIngredients(step.instruction)" />
                </div>
              </div>
            </div>
          </div>

          <!-- Kochhistorie -->
          <div v-if="recipe.history?.length" class="bg-white dark:bg-stone-900 p-4 border border-stone-200 dark:border-stone-800 rounded-xl">
            <h2 class="mb-3 font-semibold text-stone-800 dark:text-stone-100 text-base">📊 Kochhistorie</h2>
            <div class="space-y-1.5">
              <div v-for="entry in recipe.history" :key="entry.id"
                class="flex items-center gap-3 text-stone-600 dark:text-stone-400 text-sm">
                <span>{{ formatDate(entry.cooked_at) }}</span>
                <span v-if="entry.rating" class="text-amber-400">{{ '⭐'.repeat(entry.rating) }}</span>
                <span v-if="entry.notes" class="text-stone-400">– {{ entry.notes }}</span>
              </div>
            </div>
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

    <!-- Wochenplan-Swap-Dialog -->
    <ConfirmDialog
      v-model="showMealPlanSwapDialog"
      title="Im Wochenplan verschieben?"
      :message="pendingSwapData ? `Dieses Rezept steht für ${dayNames[pendingSwapData.dayOfWeek]} (${mealTypeLabels[pendingSwapData.mealType] || pendingSwapData.mealType}) auf dem Wochenplan. Auf heute verschieben und als erledigt markieren?` : ''"
      confirm-text="Verschieben & erledigen"
      cancel-text="Nein, nur gekocht"
      variant="info"
      @confirm="confirmMealPlanSwap"
      @cancel="pendingSwapData = null"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRecipesStore } from '@/stores/recipes.js';
import { useMealPlanStore } from '@/stores/mealplan.js';
import { usePantryStore } from '@/stores/pantry.js';
import { useNotification } from '@/composables/useNotification.js';
import { Star, Clock, Users, ChefHat, Pencil, Plus, Minus, Trash2, CalendarPlus, X, ChevronLeft, ChevronRight, Maximize, Warehouse, RotateCcw } from 'lucide-vue-next';
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
const pantryStore = usePantryStore();
const { showSuccess } = useNotification();
const { loadIcons, getEmoji } = useIngredientIcons();

const recipe = computed(() => recipesStore.currentRecipe);
const adjustedServings = ref(4);
const showDeleteDialog = ref(false);
const deleting = ref(false);
const showMealPlanSwapDialog = ref(false);
const pendingSwapData = ref(null);
const showCookingMode = ref(false);

// ─── Zutaten-Anpassungsmodus ───
const adjustmentMode = ref(false);
const ingredientOverrides = reactive({});

/** Anzahl aktiver Overrides */
const overrideCount = computed(() => Object.keys(ingredientOverrides).length);

/** Anpassungsmodus aktivieren/deaktivieren */
async function toggleAdjustmentMode() {
  adjustmentMode.value = !adjustmentMode.value;
  if (adjustmentMode.value) {
    // Verfügbare Vorratsmengen laden
    const ingredients = (recipe.value?.ingredients || []).map(ing => ({
      name: ing.name,
      amount: scaleAmountRaw(ing.amount),
      unit: ing.unit,
    }));
    await pantryStore.checkIngredients(ingredients);
  } else {
    pantryStore.clearIngredientAvailability();
  }
}

/** Override für eine Zutat setzen */
function setIngredientOverride(key, value) {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return;
  ingredientOverrides[key] = num;
}

/** Override für eine Zutat zurücksetzen */
function resetIngredientOverride(key) {
  delete ingredientOverrides[key];
}

/** Alle Overrides zurücksetzen */
function resetAllOverrides() {
  for (const key of Object.keys(ingredientOverrides)) {
    delete ingredientOverrides[key];
  }
}

/** Effektive Menge einer Zutat (mit Override oder skaliert) */
function getEffectiveAmount(ing) {
  const key = ing.name.toLowerCase().trim();
  if (key in ingredientOverrides) {
    return ingredientOverrides[key];
  }
  return scaleAmountRaw(ing.amount);
}

/** Vorrats-Info für eine Zutat abrufen */
function getPantryInfo(name) {
  return pantryStore.ingredientAvailability.get(name.toLowerCase().trim()) || null;
}

/** Hat eine Zutat einen Override? */
function hasOverride(name) {
  return name.toLowerCase().trim() in ingredientOverrides;
}

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

// ── Einheiten-Konvertierung (analog zu backend/utils/helpers.js) ──

function normalizeUnitLocal(unit) {
  if (!unit) return '';
  const cleaned = unit.trim().replace(/\.$/, '');
  const map = {
    gramm: 'g', gram: 'g', gr: 'g',
    kilogramm: 'kg', kilogram: 'kg',
    milliliter: 'ml',
    liter: 'l',
    teelöffel: 'TL', tl: 'TL',
    esslöffel: 'EL', el: 'EL',
  };
  return map[cleaned.toLowerCase()] || unit;
}

/** Konvertiert Menge in Basiseinheit (g / ml) – Standard + zutat-spezifische Umrechnungen */
function toBaseUnit(amount, unit, ingredientName) {
  if (!amount) return { amount: 0, unit: unit || '' };
  const stdConv = {
    kg:  { base: 'g',  factor: 1000 },
    l:   { base: 'ml', factor: 1000 },
    EL:  { base: 'g',  factor: 15 },
    TL:  { base: 'g',  factor: 5 },
  };
  const norm = normalizeUnitLocal(unit);

  // Bereits in Basiseinheit
  if (norm === 'g' || norm === 'ml') return { amount, unit: norm };

  // Standard-Konvertierung (kg→g, l→ml, EL→g, TL→g)
  if (stdConv[norm]) {
    return { amount: amount * stdConv[norm].factor, unit: stdConv[norm].base };
  }

  return { amount, unit: norm };
}

// Flache Zutatenliste — gleiche Zutat zusammenführen, Einheiten in Basis konvertieren
const flatIngredients = computed(() => {
  const ingredients = recipe.value?.ingredients || [];
  const merged = new Map();

  for (const ing of ingredients) {
    const key = ing.name.toLowerCase().trim();

    if (merged.has(key)) {
      const existing = merged.get(key);
      if (ing.amount) {
        // In Basiseinheit konvertieren (g/ml) soweit möglich
        const base = toBaseUnit(ing.amount, ing.unit, ing.name);
        const compat = existing.amounts.find(
          a => a.unit.toLowerCase() === base.unit.toLowerCase()
        );
        if (compat) {
          compat.amount += base.amount;
        } else {
          existing.amounts.push({ amount: base.amount, unit: base.unit });
        }
      }
      // Nur optional wenn ALLE Einträge optional sind
      if (!ing.is_optional) existing.is_optional = false;
      // Notes zusammenführen
      if (ing.notes && !existing.notes?.includes(ing.notes)) {
        existing.notes = [existing.notes, ing.notes].filter(Boolean).join(', ');
      }
    } else {
      const base = ing.amount ? toBaseUnit(ing.amount, ing.unit, ing.name) : null;
      merged.set(key, {
        ...ing,
        amounts: base ? [{ amount: base.amount, unit: base.unit }] : [],
      });
    }
  }

  // Top-Level amount/unit für Einzel-Einheit beibehalten
  const result = [...merged.values()];
  for (const ing of result) {
    if (ing.amounts.length === 1) {
      ing.amount = ing.amounts[0].amount;
      ing.unit = ing.amounts[0].unit;
    } else if (ing.amounts.length > 1) {
      ing.amount = null;
      ing.unit = null;
    }
  }
  // Alphabetisch nach Name sortieren
  result.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return result;
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

const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const mealTypeLabels = { mittag: 'Mittagessen', abendessen: 'Abendessen' };

async function markCooked() {
  // ingredientOverrides vorbereiten: nur Overrides senden, die vom skalierten Wert abweichen
  const overrides = {};
  if (Object.keys(ingredientOverrides).length) {
    for (const [key, val] of Object.entries(ingredientOverrides)) {
      overrides[key] = val;
    }
  }

  const data = await recipesStore.markAsCooked(recipe.value.id, {
    servings: adjustedServings.value,
    ingredientOverrides: Object.keys(overrides).length ? overrides : undefined,
  });
  let msg = 'Als gekocht markiert! 👨‍🍳';
  if (data?.pantryUpdated) {
    const pantryMsg = ` (${data.pantryUpdated} Vorräte angepasst)`;
    msg = data?.mealPlanUpdated
      ? `Als gekocht markiert & im Wochenplan erledigt! 👨‍🍳${pantryMsg}`
      : `Als gekocht markiert! 👨‍🍳${pantryMsg}`;
  } else if (data?.mealPlanUpdated) {
    msg = 'Als gekocht markiert & im Wochenplan erledigt! 👨‍🍳';
  }
  showSuccess(msg);
  await recipesStore.fetchRecipe(recipe.value.id);

  // Anpassungsmodus zurücksetzen
  adjustmentMode.value = false;
  resetAllOverrides();
  pantryStore.clearIngredientAvailability();

  // Rezept steht an einem anderen Tag auf dem Wochenplan → Swap anbieten
  if (data?.pendingMealPlanSync) {
    pendingSwapData.value = data.pendingMealPlanSync;
    showMealPlanSwapDialog.value = true;
  }
}

async function confirmMealPlanSwap() {
  if (!pendingSwapData.value) return;
  const { planId, entryId } = pendingSwapData.value;
  const data = await mealPlanStore.markCooked(planId, entryId);
  showMealPlanSwapDialog.value = false;
  pendingSwapData.value = null;
  const pantryMsg = data?.pantryUpdated ? ` (${data.pantryUpdated} Vorräte angepasst)` : '';
  showSuccess(`Im Wochenplan auf heute verschoben & erledigt! ✅${pantryMsg}`);
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

onMounted(async () => {
  await loadIcons();
  await recipesStore.fetchRecipe(route.params.id);
  if (recipe.value) {
    adjustedServings.value = recipe.value.servings;
  }
});

// Bei Rezept-Wechsel: Anpassungsmodus zurücksetzen
watch(() => route.params.id, () => {
  adjustmentMode.value = false;
  resetAllOverrides();
  pantryStore.clearIngredientAvailability();
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
/* Nativer Number-Spinner: dezenter und mit Abstand zur Zahl */
.ingredient-number-input::-webkit-inner-spin-button,
.ingredient-number-input::-webkit-outer-spin-button {
  opacity: 1;
  margin-left: 6px;
}
.ingredient-number-input {
  -moz-appearance: textfield;
}
</style>
