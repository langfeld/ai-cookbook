<!--
  ============================================
  MealPlanView – Moderner Wochenplaner
  ============================================
  Features:
  - Funktionierende Wochen-Navigation (lädt Plan beim Wechsel)
  - Wochen-Raster (Desktop) + Tages-Ansicht (Mobile / Klick)
  - Rezeptbilder, Zubereitungszeit, Schwierigkeit
  - Drag & Drop zwischen Slots
  - Rezept tauschen mit intelligenten Vorschlägen
  - Generierungs-Dialog mit Mahlzeiten-Auswahl
  - Gekocht-Markierung (toggle)
-->
<template>
  <div class="space-y-6 animate-fade-in">

    <!-- ═══════════════════ HEADER ═══════════════════ -->
    <div class="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl">🗓️ Wochenplaner</h1>
        <p class="text-stone-500 dark:text-stone-400 text-sm">
          Intelligenter Essensplan – score-basiert &amp; per Drag&amp;Drop anpassbar
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button v-if="currentPlan" @click="confirmDeletePlan"
          class="flex items-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-950 px-3 py-2 rounded-xl text-red-500 text-sm transition-colors">
          <Trash2 class="w-4 h-4" /> Löschen
        </button>
        <button @click="showGenerateModal = true" :disabled="store.generating"
          class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 shadow-sm px-4 py-2 rounded-xl font-medium text-white text-sm transition-colors">
          <Sparkles class="w-4 h-4" :class="{ 'animate-pulse': store.generating }" />
          {{ store.generating ? 'Wird erstellt…' : 'Plan generieren' }}
        </button>
      </div>
    </div>

    <!-- ═══════════════════ WOCHEN-NAVIGATION ═══════════════════ -->
    <div class="flex flex-wrap justify-between items-center gap-3">
      <div class="flex items-center gap-1">
        <button @click="changeWeek(-1)" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg transition-colors">
          <ChevronLeft class="w-5 h-5 text-stone-600 dark:text-stone-400" />
        </button>
        <button @click="goToToday"
          class="bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 px-3 py-1.5 rounded-lg font-medium text-stone-700 dark:text-stone-300 text-sm transition-colors">
          Heute
        </button>
        <button @click="changeWeek(1)" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg transition-colors">
          <ChevronRight class="w-5 h-5 text-stone-600 dark:text-stone-400" />
        </button>
      </div>

      <span class="font-semibold text-stone-700 dark:text-stone-300 text-sm">
        {{ weekLabel }}
      </span>

      <!-- Ansicht-Toggle -->
      <div class="flex bg-stone-100 dark:bg-stone-800 rounded-lg overflow-hidden">
        <button @click="viewMode = 'week'" :class="viewToggleClass('week')">
          <LayoutGrid class="w-4 h-4" /> <span class="hidden sm:inline">Woche</span>
        </button>
        <button @click="viewMode = 'day'" :class="viewToggleClass('day')">
          <CalendarDays class="w-4 h-4" /> <span class="hidden sm:inline">Tag</span>
        </button>
      </div>
    </div>

    <!-- ═══════════════════ INHALT ═══════════════════ -->

    <!-- Laden -->
    <div v-if="store.loading || store.generating" class="flex flex-col items-center gap-3 py-16">
      <div class="border-2 border-primary-200 border-t-primary-600 rounded-full w-10 h-10 animate-spin" />
      <p class="text-stone-500 text-sm">{{ store.generating ? 'Plan wird generiert…' : 'Lade Plan…' }}</p>
    </div>

    <!-- Kein Plan -->
    <div v-else-if="!currentPlan" class="py-16 text-center">
      <div class="mb-4 text-6xl">📋</div>
      <h2 class="mb-2 font-semibold text-stone-700 dark:text-stone-300 text-xl">Kein Plan für diese Woche</h2>
      <p class="mx-auto mb-6 max-w-md text-stone-500 dark:text-stone-400 text-sm">
        Erstelle einen intelligenten Essensplan basierend auf deinen Rezepten, Kochhistorie und Vorräten.
      </p>
      <button @click="showGenerateModal = true"
        class="bg-primary-600 hover:bg-primary-700 px-6 py-3 rounded-xl font-medium text-white transition-colors">
        <Sparkles class="inline mr-2 w-4 h-4" /> Plan generieren
      </button>
    </div>

    <!-- ═══════════════════ WOCHEN-ANSICHT ═══════════════════ -->
    <div v-else-if="viewMode === 'week'" class="-mx-4 lg:mx-0 px-4 lg:px-0 overflow-x-auto">
      <div class="gap-x-2 gap-y-1.5 grid grid-cols-7 lg:min-w-0 min-w-4xl">

        <!-- ── Zeile 1: Tag-Header ── -->
        <button v-for="(day, dayIdx) in weekDays" :key="'h-'+dayIdx"
          @click="openDayView(dayIdx)" :class="dayHeaderClass(dayIdx)">
          <div class="font-semibold text-sm">{{ day.short }}</div>
          <div class="opacity-75 font-normal text-xs">{{ day.date }}</div>
        </button>

        <!-- ── Pro Mahlzeit-Typ: eine Zeile quer über alle 7 Tage ── -->
        <template v-for="mt in mealTypes" :key="mt.key">
          <div v-for="(day, dayIdx) in weekDays" :key="mt.key+'-'+dayIdx"
            class="meal-slot"
            :class="{ 'meal-slot-dragover': dragTarget?.day === dayIdx && dragTarget?.meal === mt.key }"
            @dragover.prevent="onDragOver(dayIdx, mt.key)"
            @dragleave="onDragLeave"
            @drop.prevent="onDrop(dayIdx, mt.key)">

            <div class="mb-0.5 text-[0.65rem] text-stone-400 dark:text-stone-500 uppercase tracking-wide">
              {{ mt.icon }} {{ mt.label }}
            </div>

            <!-- Gefüllter Slot -->
            <div v-if="getMeal(dayIdx, mt.key)" class="group meal-card"
              :class="{ 'meal-card--cooked': getMeal(dayIdx, mt.key).is_cooked }"
              draggable="true"
              @dragstart="onDragStart($event, getMeal(dayIdx, mt.key))"
              @dragend="onDragEnd"
              @click="selectMeal(getMeal(dayIdx, mt.key))">

              <!-- Rezeptbild -->
              <div class="relative rounded-lg aspect-4/3 overflow-hidden">
                <img v-if="getMeal(dayIdx, mt.key).image_url"
                  :src="getMeal(dayIdx, mt.key).image_url"
                  :alt="getMeal(dayIdx, mt.key).recipe_title"
                  class="w-full h-full object-cover"
                  loading="lazy" />
                <div v-else class="flex justify-center items-center bg-stone-100 dark:bg-stone-800 w-full h-full">
                  <UtensilsCrossed class="w-6 h-6 text-stone-300 dark:text-stone-600" />
                </div>
                <!-- Gekocht-Badge -->
                <div v-if="getMeal(dayIdx, mt.key).is_cooked"
                  class="top-1 right-1 absolute place-items-center grid rounded-full w-5 h-5 bg-accent-500">
                  <Check class="w-3 h-3 text-white" />
                </div>
                <!-- Schwierigkeit -->
                <span v-if="getMeal(dayIdx, mt.key).difficulty"
                  class="bottom-1 left-1 absolute bg-black/50 px-1.5 py-0.5 rounded text-[0.6rem] text-white">
                  {{ getMeal(dayIdx, mt.key).difficulty }}
                </span>
              </div>
              <!-- Titel + Info -->
              <div class="mt-1.5">
                <div class="font-medium text-stone-800 dark:text-stone-200 text-xs line-clamp-2 leading-tight">
                  {{ getMeal(dayIdx, mt.key).recipe_title }}
                </div>
                <div v-if="getMeal(dayIdx, mt.key).total_time" class="flex items-center gap-1 mt-0.5 text-[0.6rem] text-stone-400">
                  <Clock class="w-3 h-3" /> {{ getMeal(dayIdx, mt.key).total_time }} min
                </div>
              </div>
            </div>

            <!-- Leerer Slot -->
            <button v-else class="meal-card-empty"
              @click="openSwapModal({ day_of_week: dayIdx, meal_type: mt.key, _isNew: true })"
              @dragover.prevent="onDragOver(dayIdx, mt.key)"
              @drop.prevent="onDrop(dayIdx, mt.key)">
              <Plus class="w-4 h-4 text-stone-300 dark:text-stone-600" />
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- ═══════════════════ TAGES-ANSICHT ═══════════════════ -->
    <div v-else-if="viewMode === 'day'" class="space-y-3">
      <!-- Tag-Navigation -->
      <div class="flex gap-1.5 pb-2 overflow-x-auto">
        <button v-for="(day, idx) in weekDays" :key="idx"
          @click="selectedDayIdx = idx"
          :class="[
            'shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            idx === selectedDayIdx
              ? 'bg-primary-600 text-white'
              : isToday(idx)
                ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
          ]">
          <div>{{ day.short }}</div>
          <div class="opacity-75 text-[0.65rem]">{{ day.date }}</div>
        </button>
      </div>

      <!-- Mahlzeiten des Tages -->
      <div class="space-y-4">
        <div v-for="mt in mealTypes" :key="mt.key">
          <h3 class="mb-2 font-semibold text-stone-600 dark:text-stone-400 text-sm">{{ mt.icon }} {{ mt.label }}</h3>

          <div v-if="getMeal(selectedDayIdx, mt.key)" class="group day-meal-card"
            :class="{ 'day-meal-card--cooked': getMeal(selectedDayIdx, mt.key).is_cooked }">
            <div class="flex gap-4">
              <!-- Bild -->
              <div class="relative rounded-xl w-28 sm:w-36 h-20 sm:h-24 overflow-hidden shrink-0">
                <img v-if="getMeal(selectedDayIdx, mt.key).image_url"
                  :src="getMeal(selectedDayIdx, mt.key).image_url"
                  class="w-full h-full object-cover" loading="lazy" />
                <div v-else class="flex justify-center items-center bg-stone-100 dark:bg-stone-800 w-full h-full">
                  <UtensilsCrossed class="w-8 h-8 text-stone-300 dark:text-stone-600" />
                </div>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <h4 class="font-semibold text-stone-800 dark:text-stone-100 text-base truncate">
                  {{ getMeal(selectedDayIdx, mt.key).recipe_title }}
                </h4>
                <div class="flex flex-wrap items-center gap-3 mt-1 text-stone-500 dark:text-stone-400 text-xs">
                  <span v-if="getMeal(selectedDayIdx, mt.key).total_time" class="flex items-center gap-1">
                    <Clock class="w-3.5 h-3.5" /> {{ getMeal(selectedDayIdx, mt.key).total_time }} min
                  </span>
                  <span v-if="getMeal(selectedDayIdx, mt.key).difficulty" class="flex items-center gap-1">
                    <ChefHat class="w-3.5 h-3.5" /> {{ getMeal(selectedDayIdx, mt.key).difficulty }}
                  </span>
                  <span v-if="getMeal(selectedDayIdx, mt.key).is_cooked"
                    class="flex items-center gap-1 font-medium text-accent-600">
                    <Check class="w-3.5 h-3.5" /> Gekocht
                  </span>
                </div>

                <!-- Aktionen -->
                <div class="flex flex-wrap gap-2 mt-3">
                  <button @click="toggleCooked(getMeal(selectedDayIdx, mt.key))"
                    class="day-action-btn" :class="getMeal(selectedDayIdx, mt.key).is_cooked ? 'day-action-btn--active' : ''">
                    <Check class="w-3.5 h-3.5" />
                    {{ getMeal(selectedDayIdx, mt.key).is_cooked ? 'Rückgängig' : 'Gekocht' }}
                  </button>
                  <button @click="openSwapModal(getMeal(selectedDayIdx, mt.key))" class="day-action-btn">
                    <RefreshCw class="w-3.5 h-3.5" /> Tauschen
                  </button>
                  <router-link :to="`/recipes/${getMeal(selectedDayIdx, mt.key).recipe_id}`" class="day-action-btn">
                    <Eye class="w-3.5 h-3.5" /> Rezept
                  </router-link>
                  <button @click="removeEntry(getMeal(selectedDayIdx, mt.key))" class="day-action-btn day-action-btn--danger">
                    <X class="w-3.5 h-3.5" /> Entfernen
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Leerer Slot -->
          <div v-else class="day-meal-empty">
            <span class="text-stone-400 text-sm">Keine Mahlzeit geplant</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════ GENERIEREN-MODAL ═══════════════════ -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showGenerateModal" class="z-50 fixed inset-0 flex justify-center items-center bg-black/40 p-4" @click.self="showGenerateModal = false">
          <div class="bg-white dark:bg-stone-900 shadow-2xl p-6 border border-stone-200 dark:border-stone-700 rounded-2xl w-full max-w-md">
            <h2 class="flex items-center gap-2 mb-4 font-bold text-stone-800 dark:text-stone-100 text-lg">
              <Sparkles class="w-5 h-5 text-primary-500" /> Plan generieren
            </h2>

            <!-- Mahlzeiten auswählen -->
            <div class="mb-4">
              <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Welche Mahlzeiten?</label>
              <div class="gap-2 grid grid-cols-2">
                <label v-for="mt in allMealTypes" :key="mt.key"
                  :class="['flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors',
                    genMealTypes.includes(mt.key)
                      ? 'border-primary-400 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300'
                      : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800']">
                  <input type="checkbox" :value="mt.key" v-model="genMealTypes" class="accent-primary-600" />
                  {{ mt.icon }} {{ mt.label }}
                </label>
              </div>
            </div>

            <!-- Personen -->
            <div class="mb-6">
              <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Personen</label>
              <div class="flex items-center gap-3">
                <button @click="genPersons = Math.max(1, genPersons - 1)"
                  class="place-items-center grid bg-stone-100 dark:bg-stone-800 rounded-lg w-8 h-8 font-bold text-stone-600 dark:text-stone-400">−</button>
                <span class="w-8 font-semibold text-stone-800 dark:text-stone-100 text-lg text-center">{{ genPersons }}</span>
                <button @click="genPersons = Math.min(20, genPersons + 1)"
                  class="place-items-center grid bg-stone-100 dark:bg-stone-800 rounded-lg w-8 h-8 font-bold text-stone-600 dark:text-stone-400">+</button>
              </div>
            </div>

            <div class="flex justify-end gap-2">
              <button @click="showGenerateModal = false"
                class="hover:bg-stone-100 dark:hover:bg-stone-800 px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 text-sm transition-colors">
                Abbrechen
              </button>
              <button @click="doGenerate" :disabled="store.generating || !genMealTypes.length"
                class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 rounded-xl font-medium text-white text-sm transition-colors">
                <Sparkles class="w-4 h-4" /> Generieren
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ═══════════════════ TAUSCH-MODAL ═══════════════════ -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="swapModal.show" class="z-50 fixed inset-0 flex justify-center items-center bg-black/40 p-4" @click.self="closeSwapModal">
          <div class="flex flex-col bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-700 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div class="flex justify-between items-center p-5 border-stone-200 dark:border-stone-800 border-b">
              <h2 class="font-bold text-stone-800 dark:text-stone-100 text-lg">
                <RefreshCw v-if="!swapModal.entry?._isNew" class="inline mr-2 w-5 h-5 text-primary-500" />
                <Plus v-else class="inline mr-2 w-5 h-5 text-primary-500" />
                {{ swapModal.entry?._isNew ? 'Rezept hinzufügen' : 'Rezept tauschen' }}
              </h2>
              <button @click="closeSwapModal" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1 rounded-lg">
                <X class="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <div class="flex-1 p-5 overflow-y-auto">
              <p v-if="swapModal.loading" class="py-8 text-stone-500 text-sm text-center">Vorschläge werden geladen…</p>
              <p v-else-if="!swapModal.suggestions.length" class="py-8 text-stone-400 text-sm text-center">
                Keine passenden Rezepte für diesen Slot gefunden.<br>
                <span class="text-xs">Lege mehr Rezepte mit passenden Kategorien an.</span>
              </p>
              <div v-else class="space-y-2">
                <button v-for="s in swapModal.suggestions" :key="s.id"
                  @click="doSwap(s.id)"
                  class="group swap-suggestion">
                  <div class="relative rounded-lg w-16 h-12 overflow-hidden shrink-0">
                    <img v-if="s.image_url" :src="s.image_url" class="w-full h-full object-cover" loading="lazy" />
                    <div v-else class="flex justify-center items-center bg-stone-100 dark:bg-stone-800 w-full h-full">
                      <UtensilsCrossed class="w-4 h-4 text-stone-300" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-stone-800 dark:text-stone-200 text-sm truncate">{{ s.title }}</div>
                    <div class="flex items-center gap-2 text-stone-400 text-xs">
                      <span v-if="s.total_time"><Clock class="inline w-3 h-3" /> {{ s.total_time }} min</span>
                      <span v-if="s.difficulty">{{ s.difficulty }}</span>
                      <span class="text-primary-500">{{ s.reason }}</span>
                    </div>
                  </div>
                  <Star v-if="s.is_favorite" class="fill-amber-400 w-4 h-4 text-amber-400 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ═══════════════════ MEAL DETAIL POPUP (Wochen-Klick) ═══════════════════ -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="selectedMeal" class="z-50 fixed inset-0 flex justify-center items-center bg-black/40 p-4" @click.self="selectedMeal = null">
          <div class="bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-700 rounded-2xl w-full max-w-sm overflow-hidden">
            <!-- Bild -->
            <div class="relative bg-stone-100 dark:bg-stone-800 h-48">
              <img v-if="selectedMeal.image_url" :src="selectedMeal.image_url"
                class="w-full h-full object-cover" />
              <div v-else class="flex justify-center items-center w-full h-full">
                <UtensilsCrossed class="w-12 h-12 text-stone-300 dark:text-stone-600" />
              </div>
              <button @click="selectedMeal = null"
                class="top-3 right-3 absolute bg-black/40 hover:bg-black/60 p-1.5 rounded-full text-white transition-colors">
                <X class="w-4 h-4" />
              </button>
            </div>
            <div class="space-y-3 p-5">
              <h3 class="font-bold text-stone-800 dark:text-stone-100 text-lg">{{ selectedMeal.recipe_title }}</h3>
              <div class="flex flex-wrap items-center gap-3 text-stone-500 text-sm">
                <span v-if="selectedMeal.total_time" class="flex items-center gap-1">
                  <Clock class="w-4 h-4" /> {{ selectedMeal.total_time }} min
                </span>
                <span v-if="selectedMeal.difficulty" class="flex items-center gap-1">
                  <ChefHat class="w-4 h-4" /> {{ selectedMeal.difficulty }}
                </span>
              </div>
              <div class="flex flex-wrap gap-2 pt-2">
                <button @click="toggleCooked(selectedMeal); selectedMeal = null;"
                  class="action-pill" :class="selectedMeal.is_cooked ? 'action-pill--active' : ''">
                  <Check class="w-4 h-4" /> {{ selectedMeal.is_cooked ? 'Rückgängig' : 'Gekocht' }}
                </button>
                <button @click="openSwapModal(selectedMeal); selectedMeal = null;" class="action-pill">
                  <RefreshCw class="w-4 h-4" /> Tauschen
                </button>
                <router-link :to="`/recipes/${selectedMeal.recipe_id}`" class="action-pill" @click="selectedMeal = null">
                  <Eye class="w-4 h-4" /> Rezept
                </router-link>
                <button @click="removeEntry(selectedMeal); selectedMeal = null;" class="action-pill action-pill--danger">
                  <X class="w-4 h-4" /> Entfernen
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useMealPlanStore } from '@/stores/mealplan.js';
import { useNotification } from '@/composables/useNotification.js';
import {
  Sparkles, ChevronLeft, ChevronRight, Check, Eye, RefreshCw,
  X, Clock, ChefHat, UtensilsCrossed, Plus, Star, Trash2,
  LayoutGrid, CalendarDays,
} from 'lucide-vue-next';

const store = useMealPlanStore();
const { showSuccess } = useNotification();

// ─── State ───
const weekOffset = ref(0);
const viewMode = ref('week');
const selectedDayIdx = ref(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1); // heute
const selectedMeal = ref(null);
const showGenerateModal = ref(false);
const genMealTypes = ref(['fruehstueck', 'mittag', 'abendessen']);
const genPersons = ref(4);

const swapModal = ref({ show: false, entry: null, suggestions: [], loading: false });
const dragSource = ref(null);
const dragTarget = ref(null);

// ─── Meal-Types ───
const allMealTypes = [
  { key: 'fruehstueck', label: 'Frühstück', icon: '🌅' },
  { key: 'mittag', label: 'Mittag', icon: '☀️' },
  { key: 'abendessen', label: 'Abend', icon: '🌙' },
  { key: 'snack', label: 'Snack', icon: '🍎' },
];
const mealTypes = computed(() => allMealTypes.filter(mt => {
  // In der Wochenansicht alle anzeigen, in der Tagesansicht nur die mit Inhalt + alle
  return true;
}));

// ─── Computed ───
const currentPlan = computed(() => store.currentPlan);

/** Montag der aktuellen Anzeige-Woche als YYYY-MM-DD */
const currentWeekStart = computed(() => {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay();
  monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1) + weekOffset.value * 7);
  return monday.toISOString().split('T')[0];
});

const weekDays = computed(() => {
  const [y, m, d] = currentWeekStart.value.split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  return ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((short, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return {
      short,
      date: dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      fullDate: dt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
      dateObj: dt,
    };
  });
});

const weekLabel = computed(() => {
  if (!weekDays.value.length) return '';
  return `${weekDays.value[0].date} – ${weekDays.value[6].date}`;
});

// ─── Wochen-Navigation: Plan laden bei Wechsel ───
watch(currentWeekStart, async (ws) => {
  await store.fetchCurrentPlan(ws);
}, { immediate: false });

function changeWeek(offset) {
  weekOffset.value += offset;
}
function goToToday() {
  weekOffset.value = 0;
  selectedDayIdx.value = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
}

// ─── Helpers ───
function isToday(dayIdx) {
  return weekDays.value[dayIdx]?.dateObj.toDateString() === new Date().toDateString();
}

function getMeal(dayIdx, mealType) {
  if (!currentPlan.value?.entries) return null;
  return currentPlan.value.entries.find(e => e.day_of_week === dayIdx && e.meal_type === mealType);
}

function dayHeaderClass(dayIdx) {
  const base = 'w-full text-center py-2 rounded-lg transition-colors cursor-pointer';
  if (isToday(dayIdx)) return `${base} bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/60`;
  return `${base} bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700`;
}

function viewToggleClass(mode) {
  const base = 'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors';
  if (viewMode.value === mode) return `${base} bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 shadow-sm rounded-lg`;
  return `${base} text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300`;
}

function openDayView(dayIdx) {
  selectedDayIdx.value = dayIdx;
  viewMode.value = 'day';
}

function selectMeal(meal) {
  selectedMeal.value = meal;
}

// ─── Generierung ───
async function doGenerate() {
  showGenerateModal.value = false;
  try {
    await store.generatePlan({
      weekStart: currentWeekStart.value,
      mealTypes: genMealTypes.value,
      personCount: genPersons.value,
    });
    showSuccess('Wochenplan erstellt! 🗓️');
  } catch {
    // Fehler von useApi
  }
}

// ─── Gekocht-Toggle ───
async function toggleCooked(meal) {
  try {
    const data = await store.markCooked(meal.meal_plan_id, meal.id);
    showSuccess(data.is_cooked ? 'Als gekocht markiert ✅' : 'Markierung entfernt');
  } catch { /* useApi */ }
}

// ─── Tausch ───
async function openSwapModal(entry) {
  swapModal.value = { show: true, entry, suggestions: [], loading: true };
  try {
    // Nur das aktuelle Rezept ausschließen (nicht alle im Plan), damit es Vorschläge gibt
    const excludeIds = entry.recipe_id ? [entry.recipe_id] : [];
    const suggestions = await store.fetchSuggestions({
      dayIdx: entry.day_of_week,
      mealType: entry.meal_type,
      excludeRecipeIds: excludeIds,
    });
    swapModal.value.suggestions = suggestions || [];
  } finally {
    swapModal.value.loading = false;
  }
}

function closeSwapModal() {
  swapModal.value = { show: false, entry: null, suggestions: [], loading: false };
}

async function doSwap(newRecipeId) {
  const entry = swapModal.value.entry;
  closeSwapModal();
  try {
    if (entry._isNew) {
      // Neuen Eintrag in leerem Slot erstellen
      await store.addEntry(currentPlan.value.id, newRecipeId, entry.day_of_week, entry.meal_type);
      showSuccess('Rezept hinzugefügt! ✨');
    } else {
      // Bestehendes Rezept tauschen
      await store.swapRecipe(currentPlan.value.id, entry.id, newRecipeId);
      showSuccess('Rezept getauscht! 🔄');
    }
  } catch { /* useApi */ }
}

// ─── Entfernen ───
async function removeEntry(meal) {
  try {
    await store.removeEntry(meal.meal_plan_id, meal.id);
    showSuccess('Eintrag entfernt');
  } catch { /* useApi */ }
}

// ─── Plan löschen ───
async function confirmDeletePlan() {
  if (!currentPlan.value) return;
  if (!confirm('Wochenplan wirklich löschen?')) return;
  try {
    await store.deletePlan(currentPlan.value.id);
    showSuccess('Wochenplan gelöscht');
  } catch { /* useApi */ }
}

// ─── Drag & Drop ───
function onDragStart(event, meal) {
  dragSource.value = meal;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', meal.id.toString());
}
function onDragEnd() {
  dragSource.value = null;
  dragTarget.value = null;
}
function onDragOver(dayIdx, mealKey) {
  dragTarget.value = { day: dayIdx, meal: mealKey };
}
function onDragLeave() {
  dragTarget.value = null;
}
async function onDrop(dayIdx, mealKey) {
  const source = dragSource.value;
  dragTarget.value = null;
  dragSource.value = null;
  if (!source || !currentPlan.value) return;
  // Nur verschieben wenn sich der Slot tatsächlich ändert
  if (source.day_of_week === dayIdx && source.meal_type === mealKey) return;
  try {
    await store.moveEntry(currentPlan.value.id, source.id, dayIdx, mealKey);
    showSuccess('Mahlzeit verschoben! ↕️');
  } catch { /* useApi */ }
}

// ─── Init ───
onMounted(async () => {
  await store.fetchCurrentPlan(currentWeekStart.value);
  store.fetchHistory();
});
</script>

<style scoped>
/* ─── Meal Slot ─── */
.meal-slot {
  display: flex;
  flex-direction: column;
  padding: calc(var(--spacing) * 1.5);
  border-radius: var(--radius-lg);
  background-color: var(--color-stone-50);
  transition: background-color 0.15s ease;
}
:is(.dark .meal-slot) {
  background-color: var(--color-stone-950);
}
.meal-slot-dragover {
  background-color: var(--color-primary-50);
  outline: 2px dashed var(--color-primary-400);
  outline-offset: -2px;
}
:is(.dark .meal-slot-dragover) {
  background-color: color-mix(in srgb, var(--color-primary-900) 30%, transparent);
}

/* ─── Meal Card (Wochenansicht) ─── */
.meal-card {
  cursor: grab;
  border-radius: var(--radius-lg);
  transition: transform 0.1s ease, box-shadow 0.15s ease;
}
.meal-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.meal-card:active { cursor: grabbing; }
.meal-card--cooked { opacity: 0.55; }

/* ─── Leerer Slot ─── */
.meal-card-empty {
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
  min-height: calc(var(--spacing) * 14);
  border: 2px dashed var(--color-stone-200);
  border-radius: var(--radius-lg);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
:is(.dark .meal-card-empty) { border-color: var(--color-stone-800); }
.meal-card-empty:hover {
  border-color: var(--color-primary-300);
  background-color: var(--color-primary-50);
}
:is(.dark .meal-card-empty:hover) {
  border-color: var(--color-primary-700);
  background-color: color-mix(in srgb, var(--color-primary-900) 20%, transparent);
}

/* ─── Tages-Ansicht Karten ─── */
.day-meal-card {
  background-color: white;
  padding: calc(var(--spacing) * 4);
  border: 1px solid var(--color-stone-200);
  border-radius: var(--radius-xl);
  transition: border-color 0.15s ease;
}
.day-meal-card:hover { border-color: var(--color-primary-300); }
:is(.dark .day-meal-card) { background-color: var(--color-stone-900); border-color: var(--color-stone-800); }
:is(.dark .day-meal-card:hover) { border-color: var(--color-primary-700); }
.day-meal-card--cooked { opacity: 0.6; }

.day-meal-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: calc(var(--spacing) * 6) 0;
  border: 2px dashed var(--color-stone-200);
  border-radius: var(--radius-xl);
}
:is(.dark .day-meal-empty) { border-color: var(--color-stone-800); }

/* ─── Tages-Aktions-Buttons ─── */
.day-action-btn {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2.5);
  border-radius: var(--radius-lg);
  font-size: 0.75rem;
  font-weight: 500;
  background-color: var(--color-stone-100);
  color: var(--color-stone-600);
  transition: background-color 0.15s ease, color 0.15s ease;
  text-decoration: none;
}
.day-action-btn:hover { background-color: var(--color-stone-200); color: var(--color-stone-800); }
:is(.dark .day-action-btn) { background-color: var(--color-stone-800); color: var(--color-stone-400); }
:is(.dark .day-action-btn:hover) { background-color: var(--color-stone-700); color: var(--color-stone-200); }
.day-action-btn--active { background-color: var(--color-accent-100); color: var(--color-accent-700); }
:is(.dark .day-action-btn--active) { background-color: color-mix(in srgb, var(--color-accent-900) 40%, transparent); color: var(--color-accent-400); }
.day-action-btn--danger:hover { background-color: var(--color-red-100); color: var(--color-red-600); }
:is(.dark .day-action-btn--danger:hover) { background-color: color-mix(in srgb, var(--color-red-900) 40%, transparent); color: var(--color-red-400); }

/* ─── Action Pills (Popup) ─── */
.action-pill {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
  border-radius: var(--radius-xl);
  font-size: 0.8rem;
  font-weight: 500;
  background-color: var(--color-stone-100);
  color: var(--color-stone-600);
  transition: background-color 0.15s ease, color 0.15s ease;
  text-decoration: none;
}
.action-pill:hover { background-color: var(--color-stone-200); color: var(--color-stone-800); }
:is(.dark .action-pill) { background-color: var(--color-stone-800); color: var(--color-stone-400); }
:is(.dark .action-pill:hover) { background-color: var(--color-stone-700); color: var(--color-stone-200); }
.action-pill--active { background-color: var(--color-accent-100); color: var(--color-accent-700); }
:is(.dark .action-pill--active) { background-color: color-mix(in srgb, var(--color-accent-900) 40%, transparent); color: var(--color-accent-400); }
.action-pill--danger:hover { background-color: var(--color-red-100); color: var(--color-red-600); }
:is(.dark .action-pill--danger:hover) { background-color: color-mix(in srgb, var(--color-red-900) 40%, transparent); color: var(--color-red-400); }

/* ─── Swap Vorschlag ─── */
.swap-suggestion {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 3);
  padding: calc(var(--spacing) * 2.5);
  border: 1px solid var(--color-stone-200);
  border-radius: var(--radius-lg);
  width: 100%;
  text-align: left;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.swap-suggestion:hover {
  border-color: var(--color-primary-400);
  background-color: var(--color-primary-50);
}
:is(.dark .swap-suggestion) { border-color: var(--color-stone-800); }
:is(.dark .swap-suggestion:hover) {
  border-color: var(--color-primary-700);
  background-color: color-mix(in srgb, var(--color-primary-900) 20%, transparent);
}

/* ─── Modal Transition ─── */
.modal-enter-active { transition: opacity 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
