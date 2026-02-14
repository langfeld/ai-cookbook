<!--
  ============================================
  RecipeImportExportModal
  ============================================
  Modal zum Exportieren und Importieren von Rezepten.
  Unterstützt sowohl User-Modus als auch Admin-Modus.
-->
<template>
  <Teleport to="body">
    <div class="z-50 fixed inset-0 flex justify-center items-center p-4" @click.self="$emit('close')">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')"></div>

      <!-- Modal -->
      <div class="z-10 relative bg-white dark:bg-stone-900 shadow-2xl rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <!-- Header -->
        <div class="flex justify-between items-center p-5 border-stone-200 dark:border-stone-700 border-b">
          <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-xl">
            {{ isAdmin ? '📦 Admin Export/Import' : '📦 Rezepte Export/Import' }}
          </h2>
          <button
            @click="$emit('close')"
            class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg transition-colors"
          >
            <X class="w-5 h-5 text-stone-500" />
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex border-stone-200 dark:border-stone-700 border-b">
          <button
            @click="activeTab = 'export'"
            :class="[
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'export'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            ]"
          >
            <Download class="inline -mt-0.5 mr-1.5 w-4 h-4" />
            Exportieren
          </button>
          <button
            @click="activeTab = 'import'"
            :class="[
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'import'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            ]"
          >
            <Upload class="inline -mt-0.5 mr-1.5 w-4 h-4" />
            Importieren
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 max-h-[60vh] overflow-y-auto">

          <!-- EXPORT TAB -->
          <div v-if="activeTab === 'export'" class="space-y-4">
            <p class="text-stone-600 dark:text-stone-400 text-sm">
              {{ isAdmin ? 'Exportiere alle Rezepte als JSON-Datei.' : 'Exportiere deine Rezepte als JSON-Datei.' }}
            </p>

            <!-- Admin: User-Filter -->
            <div v-if="isAdmin && users.length" class="space-y-2">
              <label class="font-medium text-stone-700 dark:text-stone-300 text-sm">Benutzer filtern</label>
              <select
                v-model="exportUserId"
                class="bg-stone-50 dark:bg-stone-800 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg w-full text-sm"
              >
                <option :value="null">Alle Benutzer</option>
                <option v-for="u in users" :key="u.id" :value="u.id">
                  {{ u.username }} ({{ u.recipe_count }} Rezepte)
                </option>
              </select>
            </div>

            <!-- Bilder einbetten -->
            <label class="flex items-center gap-3 bg-stone-50 dark:bg-stone-800 p-3 rounded-lg cursor-pointer">
              <input v-model="includeImages" type="checkbox" class="rounded w-4 h-4 text-primary-600" />
              <div>
                <span class="font-medium text-stone-700 dark:text-stone-300 text-sm">Bilder einbetten</span>
                <p class="text-stone-500 dark:text-stone-400 text-xs">
                  Bettet Rezeptbilder als Base64 in die JSON-Datei ein. Macht die Datei deutlich größer.
                </p>
              </div>
            </label>

            <!-- Export Button -->
            <button
              @click="handleExport"
              :disabled="exporting"
              class="flex justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-3 rounded-lg w-full font-medium text-white text-sm transition-colors"
            >
              <Loader2 v-if="exporting" class="w-4 h-4 animate-spin" />
              <Download v-else class="w-4 h-4" />
              {{ exporting ? 'Exportiere...' : 'Rezepte exportieren' }}
            </button>
          </div>

          <!-- IMPORT TAB -->
          <div v-if="activeTab === 'import'" class="space-y-4">
            <p class="text-stone-600 dark:text-stone-400 text-sm">
              Importiere Rezepte aus einer zuvor exportierten JSON-Datei.
            </p>

            <!-- Admin: Ziel-User -->
            <div v-if="isAdmin && users.length" class="space-y-2">
              <label class="font-medium text-stone-700 dark:text-stone-300 text-sm">Importieren für Benutzer</label>
              <select
                v-model="importUserId"
                class="bg-stone-50 dark:bg-stone-800 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg w-full text-sm"
              >
                <option v-for="u in users" :key="u.id" :value="u.id">
                  {{ u.username }}
                </option>
              </select>
            </div>

            <!-- Datei-Upload -->
            <div
              @dragover.prevent="isDragging = true"
              @dragleave="isDragging = false"
              @drop.prevent="handleDrop"
              :class="[
                'border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer',
                isDragging
                  ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-stone-300 dark:border-stone-600 hover:border-primary-400',
              ]"
              @click="$refs.fileInput.click()"
            >
              <input
                ref="fileInput"
                type="file"
                accept=".json,application/json"
                class="hidden"
                @change="handleFileSelect"
              />

              <div v-if="!selectedFile">
                <FileJson class="mx-auto mb-2 w-10 h-10 text-stone-400 dark:text-stone-500" />
                <p class="font-medium text-stone-600 dark:text-stone-400 text-sm">
                  JSON-Datei hierher ziehen
                </p>
                <p class="mt-1 text-stone-400 dark:text-stone-500 text-xs">
                  oder klicken zum Auswählen
                </p>
              </div>

              <div v-else class="flex justify-center items-center gap-2">
                <FileJson class="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <span class="font-medium text-stone-700 dark:text-stone-300 text-sm">
                  {{ selectedFile.name }}
                </span>
                <span class="text-stone-400 text-xs">({{ formatSize(selectedFile.size) }})</span>
                <button @click.stop="selectedFile = null; filePreview = null" class="hover:bg-stone-200 dark:hover:bg-stone-700 ml-2 p-1 rounded">
                  <X class="w-3 h-3 text-stone-500" />
                </button>
              </div>
            </div>

            <!-- Datei-Vorschau -->
            <div v-if="filePreview" class="bg-stone-50 dark:bg-stone-800 p-3 rounded-lg">
              <p class="mb-1 font-medium text-stone-700 dark:text-stone-300 text-sm">
                📋 Vorschau
              </p>
              <p class="text-stone-500 dark:text-stone-400 text-xs">
                {{ filePreview.recipe_count }} Rezept(e) gefunden
                <span v-if="filePreview.exported_at"> · Exportiert am {{ formatDate(filePreview.exported_at) }}</span>
                <span v-if="filePreview.source"> · Quelle: {{ filePreview.source }}</span>
              </p>
              <div v-if="filePreview.sample_titles?.length" class="space-y-1 mt-2">
                <p v-for="title in filePreview.sample_titles" :key="title" class="text-stone-600 dark:text-stone-400 text-xs">
                  • {{ title }}
                </p>
                <p v-if="filePreview.recipe_count > 5" class="text-stone-400 text-xs italic">
                  ... und {{ filePreview.recipe_count - 5 }} weitere
                </p>
              </div>
            </div>

            <!-- Import Button -->
            <button
              @click="handleImport"
              :disabled="!selectedFile || importing"
              class="flex justify-center items-center gap-2 disabled:opacity-50 px-4 py-3 rounded-lg w-full font-medium text-white text-sm transition-colors bg-accent-600 hover:bg-accent-700 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="importing" class="w-4 h-4 animate-spin" />
              <Upload v-else class="w-4 h-4" />
              {{ importing ? 'Importiere...' : 'Rezepte importieren' }}
            </button>

            <!-- Ergebnis -->
            <div v-if="importResult" :class="[
              'p-3 rounded-lg text-sm',
              importResult.skipped > 0
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
                : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
            ]">
              <p class="font-medium">{{ importResult.message }}</p>
              <ul v-if="importResult.errors?.length" class="space-y-1 mt-2 text-xs">
                <li v-for="(err, i) in importResult.errors" :key="i">⚠️ {{ err }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';
import { X, Download, Upload, FileJson, Loader2 } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth.js';
import { useRecipesStore } from '@/stores/recipes.js';
import { useNotification } from '@/composables/useNotification.js';
import { useApi } from '@/composables/useApi.js';

const props = defineProps({
  isAdmin: { type: Boolean, default: false },
  users: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'imported']);

const authStore = useAuthStore();
const recipesStore = useRecipesStore();
const api = useApi();
const { showSuccess, showError } = useNotification();

const activeTab = ref('export');
const includeImages = ref(false);
const exporting = ref(false);
const importing = ref(false);
const selectedFile = ref(null);
const filePreview = ref(null);
const importResult = ref(null);
const isDragging = ref(false);

// Admin-spezifische States
const exportUserId = ref(null);
const importUserId = ref(props.users[0]?.id || null);

// ============================================
// EXPORT
// ============================================
async function handleExport() {
  exporting.value = true;
  try {
    if (props.isAdmin) {
      // Admin-Export
      const params = new URLSearchParams();
      if (includeImages.value) params.set('include_images', 'true');
      if (exportUserId.value) params.set('user_id', exportUserId.value);

      const response = await fetch(`/api/admin/export?${params}`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      });
      if (!response.ok) throw new Error('Export fehlgeschlagen');
      const blob = await response.blob();
      downloadBlob(blob, `admin-rezepte-export-${new Date().toISOString().split('T')[0]}.json`);
    } else {
      // User-Export
      await recipesStore.exportRecipes(includeImages.value);
    }
    showSuccess('Rezepte erfolgreich exportiert!');
  } catch (err) {
    showError(err.message || 'Export fehlgeschlagen');
  } finally {
    exporting.value = false;
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// IMPORT
// ============================================
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) processFile(file);
}

function handleDrop(event) {
  isDragging.value = false;
  const file = event.dataTransfer.files[0];
  if (file) processFile(file);
}

async function processFile(file) {
  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    showError('Bitte eine JSON-Datei auswählen.');
    return;
  }

  selectedFile.value = file;
  importResult.value = null;

  // Vorschau generieren
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.recipes?.length) {
      filePreview.value = {
        recipe_count: data.recipes.length,
        exported_at: data.exported_at,
        source: data.source,
        sample_titles: data.recipes.slice(0, 5).map(r => r.title),
      };
    } else {
      filePreview.value = null;
      showError('Keine Rezepte in der Datei gefunden.');
    }
  } catch {
    filePreview.value = null;
    showError('Ungültiges JSON-Format.');
  }
}

async function handleImport() {
  if (!selectedFile.value) return;
  importing.value = true;
  importResult.value = null;

  try {
    if (props.isAdmin) {
      // Admin-Import mit User-Zuweisung
      const formData = new FormData();
      formData.append('file', selectedFile.value);
      if (importUserId.value) {
        formData.append('user_id', importUserId.value);
      }
      const data = await api.upload('/admin/import', formData);
      importResult.value = data;
    } else {
      // User-Import
      const data = await recipesStore.importRecipes(selectedFile.value);
      importResult.value = data;
    }

    showSuccess(importResult.value.message);
    emit('imported', importResult.value);
  } catch (err) {
    showError(err.message || 'Import fehlgeschlagen');
  } finally {
    importing.value = false;
  }
}

// ============================================
// HELPERS
// ============================================
function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>
