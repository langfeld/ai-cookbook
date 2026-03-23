<template>
  <div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden suggestion-box">
    <!-- Header mit Toggle -->
    <button
      @click="collapsed = !collapsed"
      class="flex justify-between items-center hover:bg-stone-50 dark:hover:bg-stone-800/50 px-4 py-3 w-full text-left transition-colors"
    >
      <h3 class="flex items-center gap-2 font-semibold text-stone-800 dark:text-stone-100 text-sm">
        <Lightbulb class="w-4 h-4 text-amber-500" />
        Rezeptvorschläge
      </h3>
      <ChevronDown
        class="w-4 h-4 text-stone-400 transition-transform duration-200"
        :class="{ 'rotate-180': !collapsed }"
      />
    </button>

    <!-- Inhalt (einklappbar) -->
    <Transition name="suggestion-expand">
      <div v-if="!collapsed" class="px-4 pb-4">
        <!-- Tab-Leiste -->
        <div class="flex gap-1 mb-3 border-stone-200 dark:border-stone-700 border-b">
          <button
            @click="activeTab = 'lastWeek'"
            class="suggestion-tab"
            :class="{ 'suggestion-tab--active': activeTab === 'lastWeek' }"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            Letzte Woche
          </button>
          <button
            v-if="showHouseholdTab"
            @click="activeTab = 'household'"
            class="suggestion-tab"
            :class="{ 'suggestion-tab--active': activeTab === 'household' }"
          >
            <Flame class="w-3.5 h-3.5" />
            Haushalt
          </button>
        </div>

        <!-- Tab: Letzte Woche -->
        <div v-if="activeTab === 'lastWeek'">
          <div v-if="lastWeekRecipes.length" class="gap-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <div
              v-for="recipe in lastWeekRecipes"
              :key="recipe.id"
              class="group suggestion-card"
              :draggable="isDraggable"
              @dragstart="onDragStart($event, recipe)"
              @dragend="onDragEnd"
              @click="$router.push(`/recipes/${recipe.id}`)"
            >
              <div class="relative bg-stone-100 dark:bg-stone-800 mb-1.5 rounded-lg aspect-video overflow-hidden">
                <img v-if="recipe.image_url" :src="recipe.image_url" :alt="recipe.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                <div v-else class="flex justify-center items-center w-full h-full text-2xl">🍽️</div>
                <!-- Drag-Hinweis auf Desktop -->
                <div v-if="isDraggable" class="absolute inset-0 flex justify-center items-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none drag-hint">
                  <GripVertical class="w-5 h-5 text-white" />
                </div>
              </div>
              <p class="font-medium text-stone-700 dark:group-hover:text-primary-400 dark:text-stone-300 group-hover:text-primary-600 text-xs truncate transition-colors">{{ recipe.title }}</p>
              <p v-if="recipe.total_time" class="text-[10px] text-stone-400 truncate">
                {{ recipe.total_time }} Min.
                <span v-if="recipe.difficulty"> · {{ recipe.difficulty }}</span>
              </p>
            </div>
          </div>
          <p v-else class="py-4 text-stone-400 dark:text-stone-500 text-sm text-center">
            Kein Wochenplan für die letzte Woche vorhanden
          </p>
        </div>

        <!-- Tab: Haushalt-Vorschläge -->
        <div v-if="activeTab === 'household'">
          <div v-if="householdSuggestions.length" class="gap-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <div
              v-for="s in householdSuggestions"
              :key="s.id"
              class="group suggestion-card"
              :draggable="isDraggable"
              @dragstart="onDragStart($event, s)"
              @dragend="onDragEnd"
              @click="$router.push(`/recipes/${s.id}`)"
            >
              <div class="relative bg-stone-100 dark:bg-stone-800 mb-1.5 rounded-lg aspect-video overflow-hidden">
                <img v-if="s.image_url" :src="s.image_url" :alt="s.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                <div v-else class="flex justify-center items-center w-full h-full text-2xl">🍽️</div>
                <div v-if="isDraggable" class="absolute inset-0 flex justify-center items-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none drag-hint">
                  <GripVertical class="w-5 h-5 text-white" />
                </div>
              </div>
              <p class="font-medium text-stone-700 dark:group-hover:text-primary-400 dark:text-stone-300 group-hover:text-primary-600 text-xs truncate transition-colors">{{ s.title }}</p>
              <p class="text-[10px] text-stone-400 truncate">{{ s.reason }}</p>
            </div>
          </div>
          <p v-else class="py-4 text-stone-400 dark:text-stone-500 text-sm text-center">
            Keine Vorschläge verfügbar
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { Lightbulb, Flame, RotateCcw, ChevronDown, GripVertical } from 'lucide-vue-next';

const props = defineProps({
  lastWeekRecipes: { type: Array, default: () => [] },
  householdSuggestions: { type: Array, default: () => [] },
  showHouseholdTab: { type: Boolean, default: false },
  currentPlan: { type: Object, default: null },
  isLocked: { type: Boolean, default: false },
});

const emit = defineEmits(['suggestion-drag-start', 'suggestion-drag-end']);

// Eingeklappt wenn Plan existiert, aufgeklappt wenn nicht
const collapsed = ref(!!props.currentPlan);

// Wenn currentPlan sich ändert (z.B. Plan erstellt oder gelöscht), Collapse-State anpassen
watch(() => props.currentPlan, (newPlan, oldPlan) => {
  if (!oldPlan && newPlan) {
    // Plan wurde gerade erstellt → einklappen
    collapsed.value = true;
  } else if (oldPlan && !newPlan) {
    // Plan wurde gelöscht → aufklappen
    collapsed.value = false;
  }
});

const activeTab = ref('lastWeek');

// Desktop-Erkennung: Drag nur mit feinem Pointer (Maus)
const isDraggable = computed(() => {
  if (props.isLocked) return false;
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: fine)').matches;
});

function onDragStart(event, recipe) {
  const data = {
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    source: 'suggestion',
  };
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('application/json', JSON.stringify(data));
  event.dataTransfer.setData('text/plain', recipe.id.toString());
  // Drag-Ghost etwas transparenter
  if (event.target) {
    event.target.style.opacity = '0.5';
  }
  emit('suggestion-drag-start', data);
}

function onDragEnd(event) {
  if (event.target) {
    event.target.style.opacity = '';
  }
  emit('suggestion-drag-end');
}
</script>

<style scoped>
/* ─── Tabs ─── */
.suggestion-tab {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-stone-500);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.suggestion-tab:hover {
  color: var(--color-stone-700);
}
:is(.dark .suggestion-tab:hover) {
  color: var(--color-stone-300);
}
.suggestion-tab--active {
  color: var(--color-primary-600);
  border-bottom-color: var(--color-primary-600);
}
:is(.dark .suggestion-tab--active) {
  color: var(--color-primary-400);
  border-bottom-color: var(--color-primary-400);
}

/* ─── Suggestion Card ─── */
.suggestion-card {
  cursor: pointer;
  transition: transform 0.1s ease;
}
.suggestion-card:hover {
  transform: translateY(-1px);
}
@media (pointer: fine) {
  .suggestion-card {
    cursor: grab;
  }
  .suggestion-card:active {
    cursor: grabbing;
  }
}

/* ─── Expand Transition ─── */
.suggestion-expand-enter-active,
.suggestion-expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.suggestion-expand-enter-from,
.suggestion-expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.suggestion-expand-enter-to,
.suggestion-expand-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
