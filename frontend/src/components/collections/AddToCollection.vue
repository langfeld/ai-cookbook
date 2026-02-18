<!--
  ============================================
  AddToCollection – Rezept zu Sammlung hinzufügen
  ============================================
  Dropdown-Button zum schnellen Hinzufügen eines Rezepts
  zu einer oder mehreren Sammlungen.
-->
<template>
  <div class="relative">
    <button
      @click="toggle"
      class="flex items-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-800 px-4 py-2 border border-stone-300 dark:border-stone-600 rounded-lg text-stone-700 dark:text-stone-300 text-sm transition-colors"
    >
      <FolderPlus class="w-4 h-4" />
      <span class="hidden sm:inline">Sammlung</span>
    </button>

    <Transition name="fade">
      <div v-if="open"
        class="sm:right-0 bottom-20 sm:bottom-auto z-30 fixed sm:absolute inset-x-3 sm:inset-x-auto bg-white dark:bg-stone-900 shadow-xl sm:mt-2 border border-stone-200 dark:border-stone-700 rounded-xl sm:w-64 overflow-hidden">
        <!-- Header -->
        <div class="p-3 border-stone-200 dark:border-stone-800 border-b">
          <p class="font-medium text-stone-700 dark:text-stone-300 text-xs uppercase tracking-wide">Zu Sammlung hinzufügen</p>
        </div>

        <!-- Sammlungen-Liste -->
        <div class="max-h-52 overflow-y-auto">
          <div v-if="loading" class="p-4 text-stone-400 text-sm text-center">Laden…</div>
          <div v-else-if="!collectionsStore.collections.length" class="p-4 text-center">
            <p class="text-stone-400 text-sm">Keine Sammlungen vorhanden.</p>
          </div>
          <template v-else>
            <button
              v-for="col in collectionsStore.collections" :key="col.id"
              @click="toggleCollection(col)"
              :class="[
                'flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm transition-colors',
                isInCollection(col.id)
                  ? 'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300'
                  : 'hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
              ]"
            >
              <div
                class="flex justify-center items-center rounded w-7 h-7 text-sm shrink-0"
                :style="{ backgroundColor: col.color + '20' }"
              >{{ col.icon }}</div>
              <span class="flex-1 truncate">{{ col.name }}</span>
              <Check v-if="isInCollection(col.id)" class="w-4 h-4 text-primary-500 shrink-0" />
            </button>
          </template>
        </div>

        <!-- Neue Sammlung -->
        <div class="p-2 border-stone-200 dark:border-stone-800 border-t">
          <div class="flex gap-1">
            <input
              v-model="quickName"
              @keyup.enter="quickCreate"
              type="text"
              placeholder="Neue Sammlung…"
              class="flex-1 bg-stone-50 dark:bg-stone-800 px-2.5 py-1.5 border border-stone-200 dark:border-stone-700 rounded-lg outline-none text-xs"
            />
            <button
              @click="quickCreate"
              :disabled="!quickName.trim()"
              class="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-2 py-1.5 rounded-lg text-white transition-colors"
            >
              <Plus class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Backdrop -->
    <div v-if="open" @click="open = false" class="z-20 fixed inset-0" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useCollectionsStore } from '@/stores/collections.js';
import { useNotification } from '@/composables/useNotification.js';
import { FolderPlus, Check, Plus } from 'lucide-vue-next';

const props = defineProps({
  recipeId: { type: Number, required: true },
});

const collectionsStore = useCollectionsStore();
const { showSuccess, showError } = useNotification();

const open = ref(false);
const loading = ref(false);
const recipeCollectionIds = ref(new Set());
const quickName = ref('');

async function toggle() {
  open.value = !open.value;
  if (open.value) {
    loading.value = true;
    try {
      await collectionsStore.fetchCollections();
      const cols = await collectionsStore.fetchCollectionsForRecipe(props.recipeId);
      recipeCollectionIds.value = new Set(cols.map(c => c.id));
    } finally {
      loading.value = false;
    }
  }
}

function isInCollection(colId) {
  return recipeCollectionIds.value.has(colId);
}

async function toggleCollection(col) {
  try {
    if (isInCollection(col.id)) {
      await collectionsStore.removeRecipe(col.id, props.recipeId);
      recipeCollectionIds.value.delete(col.id);
      recipeCollectionIds.value = new Set(recipeCollectionIds.value);
      showSuccess(`Aus "${col.name}" entfernt`);
    } else {
      await collectionsStore.addRecipes(col.id, [props.recipeId]);
      recipeCollectionIds.value.add(col.id);
      recipeCollectionIds.value = new Set(recipeCollectionIds.value);
      showSuccess(`Zu "${col.name}" hinzugefügt! 📁`);
    }
  } catch {
    showError('Aktion fehlgeschlagen.');
  }
}

async function quickCreate() {
  if (!quickName.value.trim()) return;
  try {
    const data = await collectionsStore.createCollection({ name: quickName.value.trim() });
    // Direkt zuordnen
    await collectionsStore.addRecipes(data.collection.id, [props.recipeId]);
    recipeCollectionIds.value.add(data.collection.id);
    recipeCollectionIds.value = new Set(recipeCollectionIds.value);
    showSuccess(`"${quickName.value.trim()}" erstellt & Rezept hinzugefügt! 📁`);
    quickName.value = '';
  } catch {
    showError('Fehler beim Erstellen.');
  }
}
</script>

<style scoped>
.fade-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.fade-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.fade-enter-from { opacity: 0; transform: translateY(-4px); }
.fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
