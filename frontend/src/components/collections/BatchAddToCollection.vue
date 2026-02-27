<!--
  ============================================
  BatchAddToCollection – Mehrere Rezepte zu Sammlung hinzufügen
  ============================================
  Modal-Dialog zum Hinzufügen mehrerer ausgewählter Rezepte
  zu einer oder mehreren Sammlungen (Batch-Operation).
-->
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="z-50 fixed inset-0 flex justify-center items-center p-4">
        <!-- Backdrop -->
        <div @click="close" class="absolute inset-0 bg-black/40 backdrop-blur-sm" />

        <!-- Modal -->
        <div class="relative bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-700 rounded-2xl w-full max-w-md overflow-hidden">
          <!-- Header -->
          <div class="flex justify-between items-center px-5 py-4 border-stone-200 dark:border-stone-800 border-b">
            <div>
              <h3 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">
                Zu Sammlung hinzufügen
              </h3>
              <p class="text-stone-500 text-sm">
                {{ recipeIds.length }} Rezept{{ recipeIds.length !== 1 ? 'e' : '' }} ausgewählt
              </p>
            </div>
            <button
              @click="close"
              class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg text-stone-400 transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Sammlungen-Liste -->
          <div class="max-h-64 overflow-y-auto">
            <div v-if="loading" class="py-8 text-stone-400 text-sm text-center">Laden…</div>
            <div v-else-if="!collectionsStore.collections.length" class="py-8 text-center">
              <FolderPlus class="mx-auto mb-2 w-10 h-10 text-stone-300 dark:text-stone-600" />
              <p class="text-stone-500 text-sm">Keine Sammlungen vorhanden.</p>
              <p class="text-stone-400 text-xs">Erstelle unten eine neue Sammlung.</p>
            </div>
            <template v-else>
              <button
                v-for="col in collectionsStore.collections"
                :key="col.id"
                @click="addToCollection(col)"
                :disabled="addingTo === col.id"
                :class="[
                  'flex items-center gap-3 w-full px-5 py-3 text-left text-sm transition-colors',
                  addedTo.has(col.id)
                    ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'
                    : 'hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                ]"
              >
                <div
                  class="flex justify-center items-center rounded-lg w-8 h-8 text-base shrink-0"
                  :style="{ backgroundColor: col.color + '20' }"
                >{{ col.icon }}</div>
                <div class="flex-1 min-w-0">
                  <span class="block font-medium truncate">{{ col.name }}</span>
                  <span class="text-stone-400 dark:text-stone-500 text-xs">{{ col.recipe_count ?? 0 }} Rezepte</span>
                </div>
                <Check v-if="addedTo.has(col.id)" class="w-5 h-5 text-green-500 shrink-0" />
                <div v-else-if="addingTo === col.id" class="border-2 border-stone-200 border-t-violet-500 rounded-full w-5 h-5 animate-spin shrink-0" />
                <ChevronRight v-else class="w-4 h-4 text-stone-300 shrink-0" />
              </button>
            </template>
          </div>

          <!-- Neue Sammlung erstellen -->
          <div class="px-5 py-3 border-stone-200 dark:border-stone-800 border-t">
            <div class="flex gap-2">
              <input
                v-model="quickName"
                @keyup.enter="quickCreate"
                type="text"
                placeholder="Neue Sammlung erstellen…"
                class="flex-1 bg-stone-50 dark:bg-stone-800 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg outline-none text-sm"
              />
              <button
                @click="quickCreate"
                :disabled="!quickName.trim() || creating"
                class="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-3 py-2 rounded-lg font-medium text-white text-sm transition-colors"
              >
                <Plus class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useCollectionsStore } from '@/stores/collections.js';
import { useNotification } from '@/composables/useNotification.js';
import { X, Check, ChevronRight, FolderPlus, Plus } from 'lucide-vue-next';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  recipeIds: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue', 'added']);

const collectionsStore = useCollectionsStore();
const { showSuccess, showError } = useNotification();

const loading = ref(false);
const addingTo = ref(null);
const addedTo = ref(new Set());
const quickName = ref('');
const creating = ref(false);

watch(() => props.modelValue, async (open) => {
  if (open) {
    addedTo.value = new Set();
    addingTo.value = null;
    quickName.value = '';
    loading.value = true;
    try {
      await collectionsStore.fetchCollections();
    } finally {
      loading.value = false;
    }
  }
});

function close() {
  emit('update:modelValue', false);
}

async function addToCollection(col) {
  if (addingTo.value || addedTo.value.has(col.id)) return;
  addingTo.value = col.id;
  try {
    const result = await collectionsStore.addRecipes(col.id, props.recipeIds);
    addedTo.value = new Set([...addedTo.value, col.id]);
    const count = result?.addedCount ?? props.recipeIds.length;
    showSuccess(`${count} Rezept${count !== 1 ? 'e' : ''} zu „${col.name}" hinzugefügt! 📁`);
    emit('added', { collectionId: col.id, count });
  } catch {
    showError('Hinzufügen fehlgeschlagen.');
  } finally {
    addingTo.value = null;
  }
}

async function quickCreate() {
  if (!quickName.value.trim() || creating.value) return;
  creating.value = true;
  try {
    const data = await collectionsStore.createCollection({ name: quickName.value.trim() });
    const col = data.collection;
    // Direkt hinzufügen
    await collectionsStore.addRecipes(col.id, props.recipeIds);
    addedTo.value = new Set([...addedTo.value, col.id]);
    showSuccess(`„${quickName.value.trim()}" erstellt & Rezepte hinzugefügt! 📁`);
    quickName.value = '';
    emit('added', { collectionId: col.id, count: props.recipeIds.length });
  } catch {
    showError('Fehler beim Erstellen.');
  } finally {
    creating.value = false;
  }
}
</script>

<style scoped>
.fade-enter-active { transition: opacity 0.2s ease; }
.fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
