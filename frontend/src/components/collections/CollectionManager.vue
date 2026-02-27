<!--
  ============================================
  CollectionManager – Sammlungs-Verwaltung
  ============================================
  Modaler Dialog zur CRUD-Verwaltung von Sammlungen.
  Wird z.B. aus RecipesView oder RecipeDetailView geöffnet.
-->
<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="z-50 fixed inset-0 flex justify-center items-center bg-black/40 p-4" @click.self="close">
        <div class="flex flex-col bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-700 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">

          <!-- Header -->
          <div class="flex justify-between items-center p-5 border-stone-200 dark:border-stone-800 border-b">
            <h2 class="flex items-center gap-2 font-bold text-stone-800 dark:text-stone-100 text-lg">
              <FolderOpen class="w-5 h-5 text-primary-500" />
              Sammlungen verwalten
            </h2>
            <button @click="close" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1 rounded-lg">
              <X class="w-5 h-5 text-stone-400" />
            </button>
          </div>

          <!-- Neue Sammlung erstellen -->
          <div class="p-4 border-stone-200 dark:border-stone-800 border-b">
            <div class="flex gap-2">
              <div class="flex-1">
                <input
                  v-model="newName"
                  @keyup.enter="createNew"
                  type="text"
                  placeholder="Neue Sammlung…"
                  class="bg-stone-50 dark:bg-stone-800 py-2 pr-4 pl-3 border border-stone-200 focus:border-primary-400 dark:border-stone-700 rounded-lg outline-none w-full text-sm"
                />
              </div>
              <!-- Icon Button -->
              <button
                @click="showIconPicker = !showIconPicker"
                class="bg-stone-50 dark:bg-stone-800 p-2 border border-stone-200 dark:border-stone-700 rounded-lg text-lg leading-none"
                :title="'Icon: ' + newIcon"
              >
                {{ newIcon }}
              </button>
              <!-- Color Picker -->
              <div class="relative w-10 h-10">
                <div
                  class="flex justify-center items-center border border-stone-200 dark:border-stone-700 rounded-lg w-full h-full pointer-events-none"
                  :style="{ backgroundColor: newColor }"
                >
                  <Palette class="drop-shadow-sm w-4 h-4 text-white" />
                </div>
                <input
                  v-model="newColor"
                  type="color"
                  class="z-10 absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  title="Farbe wählen"
                />
              </div>
              <button
                @click="createNew"
                :disabled="!newName.trim() || creating"
                class="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-3 py-2 rounded-lg font-medium text-white text-sm transition-colors"
              >
                <Plus class="w-4 h-4" />
              </button>
            </div>
            <!-- Inline Icon-Grid (Neu) -->
            <Transition name="fade">
              <div v-if="showIconPicker" class="mt-2 bg-stone-50 dark:bg-stone-800 p-2 border border-stone-200 dark:border-stone-700 rounded-lg">
                <div class="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  <button
                    v-for="icon in iconOptions" :key="icon"
                    @click="newIcon = icon; showIconPicker = false"
                    :class="['p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-700 text-lg transition-colors',
                      icon === newIcon ? 'bg-primary-100 dark:bg-primary-900' : '']"
                  >{{ icon }}</button>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Sammlungen-Liste -->
          <div class="flex-1 p-4 overflow-y-auto">
            <div v-if="collectionsStore.loading" class="py-8 text-stone-400 text-sm text-center">
              Laden…
            </div>
            <div v-else-if="!collectionsStore.collections.length" class="py-8 text-center">
              <div class="mb-2 text-4xl">📁</div>
              <p class="text-stone-400 text-sm">Noch keine Sammlungen erstellt.</p>
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="col in collectionsStore.collections" :key="col.id"
                class="group flex items-center gap-3 hover:bg-stone-50 dark:hover:bg-stone-800 p-3 border border-stone-200 dark:border-stone-700 rounded-xl transition-colors"
              >
                <!-- Icon & Farbe -->
                <div
                  class="flex justify-center items-center rounded-lg w-10 h-10 text-lg shrink-0"
                  :style="{ backgroundColor: col.color + '20', borderColor: col.color + '40' }"
                  style="border-width: 1px;"
                >
                  {{ col.icon }}
                </div>

                <!-- Name & Count -->
                <div class="flex-1 min-w-0">
                  <!-- Bearbeiten-Modus -->
                  <div v-if="editingId === col.id" class="space-y-2">
                    <div class="flex gap-1">
                      <input
                        v-model="editName"
                        @keyup.enter="saveEdit(col)"
                        @keyup.escape="editingId = null"
                        class="flex-1 bg-white dark:bg-stone-800 px-2 py-0.5 border border-primary-400 rounded outline-none text-sm"
                        ref="editInput"
                      />
                      <button @click="saveEdit(col)" class="p-1 text-primary-600 hover:text-primary-700">
                        <Check class="w-4 h-4" />
                      </button>
                      <button @click="editingId = null" class="p-1 text-stone-400 hover:text-stone-600">
                        <X class="w-4 h-4" />
                      </button>
                    </div>
                    <div class="flex items-center gap-2">
                      <!-- Icon-Button (Edit) -->
                      <button
                        @click="showEditIconPicker = !showEditIconPicker"
                        class="bg-stone-50 dark:bg-stone-800 p-1.5 border border-stone-200 dark:border-stone-700 rounded-lg text-base leading-none"
                        title="Icon ändern"
                      >
                        {{ editIcon }}
                      </button>
                      <!-- Color-Picker (Edit) -->
                      <div class="relative w-8 h-8">
                        <div
                          class="flex justify-center items-center border border-stone-200 dark:border-stone-700 rounded-lg w-full h-full pointer-events-none"
                          :style="{ backgroundColor: editColor }"
                        >
                          <Palette class="drop-shadow-sm w-3.5 h-3.5 text-white" />
                        </div>
                        <input
                          v-model="editColor"
                          type="color"
                          class="z-10 absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                          title="Farbe ändern"
                        />
                      </div>
                      <span class="text-stone-400 text-xs">Icon & Farbe</span>
                    </div>
                    <!-- Inline Icon-Grid (Edit) -->
                    <Transition name="fade">
                      <div v-if="showEditIconPicker" class="bg-stone-50 dark:bg-stone-800 p-2 border border-stone-200 dark:border-stone-700 rounded-lg">
                        <div class="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                          <button
                            v-for="icon in iconOptions" :key="icon"
                            @click="editIcon = icon; showEditIconPicker = false"
                            :class="['p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-700 text-lg transition-colors',
                              icon === editIcon ? 'bg-primary-100 dark:bg-primary-900' : '']"
                          >{{ icon }}</button>
                        </div>
                      </div>
                    </Transition>
                  </div>
                  <template v-else>
                    <div class="font-medium text-stone-800 dark:text-stone-200 text-sm truncate">{{ col.name }}</div>
                    <div class="text-stone-400 text-xs">{{ col.recipe_count ?? 0 }} Rezept{{ col.recipe_count !== 1 ? 'e' : '' }}</div>
                  </template>
                </div>

                <!-- Aktionen -->
                <div v-if="editingId !== col.id" class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button @click="startEdit(col)" class="hover:bg-stone-200 dark:hover:bg-stone-700 p-1.5 rounded-lg transition-colors" title="Bearbeiten">
                    <Pencil class="w-3.5 h-3.5 text-stone-400" />
                  </button>
                  <button @click="confirmDelete(col)" class="hover:bg-red-100 dark:hover:bg-red-900/30 p-1.5 rounded-lg transition-colors" title="Löschen">
                    <Trash2 class="w-3.5 h-3.5 text-stone-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
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
import { FolderOpen, X, Plus, Check, Pencil, Trash2, Palette } from 'lucide-vue-next';

const props = defineProps({ modelValue: Boolean });
const emit = defineEmits(['update:modelValue']);

const collectionsStore = useCollectionsStore();
const { showSuccess, showError } = useNotification();

const newName = ref('');
const newIcon = ref('📁');
const newColor = ref('#6366f1');
const creating = ref(false);
const showIconPicker = ref(false);
const editingId = ref(null);
const editName = ref('');
const editIcon = ref('📁');
const editColor = ref('#6366f1');
const showEditIconPicker = ref(false);

const iconOptions = [
  '📁', '📂', '⭐', '❤️', '🍳', '🥗', '🍝', '🍜', '🍲', '🥘',
  '🍕', '🍔', '🌮', '🥙', '🍣', '🍱', '🧁', '🎂', '🍪', '🥧',
  '🌿', '🌶️', '🍖', '🐟', '🥦', '🍄', '🧀', '🥐', '☕', '🍹',
  '🏠', '🎉', '💪', '🌍', '📌', '🔥', '⚡', '🎯', '💡', '🧪',
];

function close() {
  emit('update:modelValue', false);
}

async function createNew() {
  if (!newName.value.trim()) return;
  creating.value = true;
  try {
    await collectionsStore.createCollection({
      name: newName.value.trim(),
      icon: newIcon.value,
      color: newColor.value,
    });
    showSuccess(`Sammlung "${newName.value.trim()}" erstellt! 📁`);
    newName.value = '';
    newIcon.value = '📁';
    newColor.value = '#6366f1';
  } catch {
    showError('Sammlung konnte nicht erstellt werden.');
  } finally {
    creating.value = false;
  }
}

function startEdit(col) {
  editingId.value = col.id;
  editName.value = col.name;
  editIcon.value = col.icon || '📁';
  editColor.value = col.color || '#6366f1';
  showEditIconPicker.value = false;
}

async function saveEdit(col) {
  if (!editName.value.trim()) return;
  try {
    await collectionsStore.updateCollection(col.id, {
      name: editName.value.trim(),
      icon: editIcon.value,
      color: editColor.value,
    });
    showSuccess('Sammlung aktualisiert!');
  } catch {
    showError('Fehler beim Umbenennen.');
  }
  editingId.value = null;
}

async function confirmDelete(col) {
  if (!confirm(`Sammlung "${col.name}" wirklich löschen? Rezepte bleiben erhalten.`)) return;
  try {
    await collectionsStore.deleteCollection(col.id);
    showSuccess(`Sammlung "${col.name}" gelöscht.`);
  } catch {
    showError('Fehler beim Löschen.');
  }
}

// Sammlungen laden wenn Modal geöffnet wird
watch(() => props.modelValue, (open) => {
  if (open) collectionsStore.fetchCollections();
});
</script>

<style scoped>
.modal-enter-active { transition: opacity 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
