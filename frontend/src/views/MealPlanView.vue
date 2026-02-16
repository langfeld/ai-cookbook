<!--
  ============================================
  MealPlanView - Wochenplaner
  ============================================
  KI-gestützter Wochenplaner mit:
  - 7-Tage-Raster (Frühstück, Mittagessen, Abendessen, Snacks)
  - KI-Generierung basierend auf vorhandenen Rezepten
  - Drag-and-Drop-Umplanung (vereinfacht)
  - Als-gekocht-Markierung
-->
<template>
  <div class="space-y-6 animate-fade-in">
    <!-- Header -->
    <div class="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl">🗓️ Wochenplaner</h1>
        <p class="text-stone-500 dark:text-stone-400 text-sm">KI-optimierter Essensplan für die Woche</p>
      </div>
      <div class="flex gap-2">
        <button
          @click="generatePlan"
          :disabled="mealPlanStore.loading"
          class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 rounded-xl font-medium text-white text-sm transition-colors"
        >
          <Sparkles class="w-4 h-4" :class="{ 'animate-pulse': mealPlanStore.loading }" />
          {{ mealPlanStore.loading ? 'Plan wird erstellt...' : 'Neuen Plan generieren' }}
        </button>
      </div>
    </div>

    <!-- Wochennavigation -->
    <div class="flex items-center gap-4">
      <button @click="changeWeek(-1)" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg">
        <ChevronLeft class="w-5 h-5 text-stone-600 dark:text-stone-400" />
      </button>
      <span class="font-medium text-stone-700 dark:text-stone-300 text-sm">
        {{ weekLabel }}
      </span>
      <button @click="changeWeek(1)" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg">
        <ChevronRight class="w-5 h-5 text-stone-600 dark:text-stone-400" />
      </button>
    </div>

    <!-- Wochen-Raster -->
    <div v-if="currentPlan" class="-mx-4 lg:mx-0 px-4 lg:px-0 overflow-x-auto">
      <div class="gap-3 grid grid-cols-7 min-w-160 lg:min-w-0">
        <div v-for="(day, dayIdx) in weekDays" :key="dayIdx" class="space-y-2">
          <!-- Tag Header -->
          <div :class="[
            'text-center py-2 rounded-lg text-sm font-semibold',
            isToday(dayIdx) ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
          ]">
            <div>{{ day.short }}</div>
            <div class="font-normal text-xs">{{ day.date }}</div>
          </div>

          <!-- Mahlzeiten -->
          <div v-for="mealType in mealTypes" :key="mealType.key" class="min-h-20">
            <div class="mb-1 px-1 text-stone-400 text-xs">{{ mealType.icon }} {{ mealType.label }}</div>
            <div
              v-if="getMeal(dayIdx, mealType.key)"
              class="meal-card"
              :class="{ 'opacity-50 line-through': getMeal(dayIdx, mealType.key).is_cooked }"
            >
              <div class="font-medium text-stone-800 dark:text-stone-200 text-sm line-clamp-2">
                {{ getMeal(dayIdx, mealType.key).recipe_title }}
              </div>
              <div class="flex items-center gap-1 mt-1">
                <button
                  @click="markMealCooked(getMeal(dayIdx, mealType.key))"
                  class="text-xs text-accent-600 hover:text-accent-700"
                  title="Als gekocht markieren"
                >
                  <Check class="w-3 h-3" />
                </button>
                <router-link
                  v-if="getMeal(dayIdx, mealType.key).recipe_id"
                  :to="`/recipes/${getMeal(dayIdx, mealType.key).recipe_id}`"
                  class="text-primary-600 hover:text-primary-700 text-xs"
                >
                  <ExternalLink class="w-3 h-3" />
                </router-link>
              </div>
            </div>
            <div v-else class="meal-card-empty">
              <span class="text-stone-300 dark:text-stone-600 text-xs">Leer</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Kein Plan vorhanden -->
    <div v-else-if="!mealPlanStore.loading" class="py-16 text-center">
      <div class="mb-4 text-6xl">📋</div>
      <h2 class="mb-2 font-semibold text-stone-700 dark:text-stone-300 text-xl">Noch kein Wochenplan</h2>
      <p class="mx-auto mb-6 max-w-md text-stone-500 dark:text-stone-400">
        Lass die KI einen intelligenten Essensplan erstellen, basierend auf deinen Rezepten und was du zuletzt gekocht hast.
      </p>
      <button
        @click="generatePlan"
        :disabled="mealPlanStore.loading"
        class="bg-primary-600 hover:bg-primary-700 px-6 py-3 rounded-xl font-medium text-white transition-colors"
      >
        <Sparkles class="inline mr-2 w-4 h-4" />
        Plan generieren
      </button>
    </div>

    <!-- Laden -->
    <div v-else class="flex justify-center py-16">
      <div class="border-2 border-primary-200 border-t-primary-600 rounded-full w-8 h-8 animate-spin" />
    </div>

    <!-- Historische Pläne -->
    <div v-if="mealPlanStore.history?.length" class="mt-8">
      <h2 class="mb-4 font-semibold text-stone-800 dark:text-stone-100 text-lg">📚 Vergangene Pläne</h2>
      <div class="space-y-2">
        <div
          v-for="plan in mealPlanStore.history"
          :key="plan.id"
          class="flex justify-between items-center bg-white dark:bg-stone-900 p-3 border border-stone-200 dark:border-stone-800 rounded-lg"
        >
          <span class="text-stone-700 dark:text-stone-300 text-sm">
            KW {{ plan.week_number }} – {{ plan.year }}
          </span>
          <span class="text-stone-400 text-xs">{{ plan.entries_count }} Mahlzeiten</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useMealPlanStore } from '@/stores/mealplan.js';
import { useNotification } from '@/composables/useNotification.js';
import { Sparkles, ChevronLeft, ChevronRight, Check, ExternalLink } from 'lucide-vue-next';

const mealPlanStore = useMealPlanStore();
const { showSuccess } = useNotification();

const weekOffset = ref(0);

const mealTypes = [
  { key: 'breakfast', label: 'Frühstück', icon: '🌅' },
  { key: 'lunch', label: 'Mittag', icon: '☀️' },
  { key: 'dinner', label: 'Abend', icon: '🌙' },
  { key: 'snack', label: 'Snack', icon: '🍎' },
];

const currentPlan = computed(() => mealPlanStore.currentPlan);

const weekDays = computed(() => {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1 + weekOffset.value * 7);

  return ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((short, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      short,
      date: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      dateObj: d,
    };
  });
});

const weekLabel = computed(() => {
  if (!weekDays.value.length) return '';
  const start = weekDays.value[0].date;
  const end = weekDays.value[6].date;
  return `${start} – ${end}`;
});

function isToday(dayIdx) {
  const today = new Date();
  const day = weekDays.value[dayIdx];
  return day.dateObj.toDateString() === today.toDateString();
}

function getMeal(dayIdx, mealType) {
  if (!currentPlan.value?.entries) return null;
  const dayNum = dayIdx; // 0 = Montag
  return currentPlan.value.entries.find(e => e.day_of_week === dayNum && e.meal_type === mealType);
}

function changeWeek(offset) {
  weekOffset.value += offset;
}

async function generatePlan() {
  try {
    await mealPlanStore.generatePlan();
    showSuccess('Wochenplan erstellt! 🗓️');
  } catch {
    // Fehler wird von useApi angezeigt
  }
}

async function markMealCooked(meal) {
  try {
    await mealPlanStore.markCooked(meal.id);
    showSuccess('Mahlzeit als gekocht markiert! ✅');
  } catch {
    // Fehler wird von useApi angezeigt
  }
}

onMounted(async () => {
  await mealPlanStore.fetchCurrentPlan();
  await mealPlanStore.fetchHistory();
});
</script>

<style scoped>
.meal-card {
  background-color: white;
  padding: calc(var(--spacing) * 2);
  border: 1px solid var(--color-stone-200);
  border-radius: var(--radius-lg);
  transition: border-color 0.15s ease;
  cursor: pointer;
}
.meal-card:hover {
  border-color: var(--color-primary-300);
}
:is(.dark .meal-card) {
  background-color: var(--color-stone-900);
  border-color: var(--color-stone-800);
}
:is(.dark .meal-card:hover) {
  border-color: var(--color-primary-700);
}

.meal-card-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: calc(var(--spacing) * 2);
  border: 1px dashed var(--color-stone-200);
  border-radius: var(--radius-lg);
  min-height: calc(var(--spacing) * 10);
}
:is(.dark .meal-card-empty) {
  border-color: var(--color-stone-800);
}
</style>
