<!--
  ============================================
  MealPlanImportExportModal
  ============================================
  Modal zum Exportieren und Importieren von Wochenplänen.
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
            {{ isAdmin ? '📅 Admin Wochenpläne' : '📅 Wochenpläne Export/Import' }}
          </h2>
          <button @click="$emit('close')" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg transition-colors">
            <X class="w-5 h-5 text-stone-500" />
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex border-stone-200 dark:border-stone-700 border-b">
          <button
            @click="activeTab = 'export'"
            :class="['flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'export'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300']"
          >
            <Download class="inline -mt-0.5 mr-1.5 w-4 h-4" />
            Exportieren
          </button>
          <button
            @click="activeTab = 'import'"
            :class="['flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'import'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300']"
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
              {{ isAdmin ? 'Exportiere alle Wochenpläne als JSON-Datei.' : 'Exportiere deine Wochenpläne als JSON-Datei.' }}
            </p>

            <!-- Admin: User-Filter -->
            <div v-if="isAdmin && users.length" class="space-y-2">
              <label class="font-medium text-stone-700 dark:text-stone-300 text-sm">Benutzer filtern</label>
              <select v-model="exportUserId" class="bg-stone-50 dark:bg-stone-800 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg w-full text-sm">
                <option :value="null">Alle Benutzer</option>
                <option v-for="u in users" :key="u.id" :value="u.id">{{ u.username }}</option>
              </select>
            </div>

            <button
              @click="handleExport"
              :disabled="exporting"
              class="flex justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-3 rounded-lg w-full font-medium text-white text-sm transition-colors"
            >
              <Loader2 v-if="exporting" class="w-4 h-4 animate-spin" />
              <Download v-else class="w-4 h-4" />
              {{ exporting ? 'Exportiere...' : 'Wochenpläne exportieren' }}
            </button>
          </div>

          <!-- IMPORT TAB -->
          <div v-if="activeTab === 'import'" class="space-y-4">
            <p class="text-stone-600 dark:text-stone-400 text-sm">
              Importiere Wochenpläne aus einer JSON-Datei. Bereits vorhandene Wochen werden übersprungen.
            </p>

            <!-- Admin: Ziel-User -->
            <div v-if="isAdmin && users.length" class="space-y-2">
              <label class="font-medium text-stone-700 dark:text-stone-300 text-sm">Ziel-Benutzer</label>
              <select v-model="importUserId" class="bg-stone-50 dark:bg-stone-800 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg w-full text-sm">
                <option v-for="u in users" :key="u.id" :value="u.id">{{ u.username }}</option>
              </select>
            </div>

            <!-- Datei-Upload -->
            <div
              :class="['border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer',
                isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30' : 'border-stone-300 dark:border-stone-600 hover:border-primary-400']"
              @dragover.prevent="isDragging = true"
              @dragleave="isDragging = false"
              @drop.prevent="handleDrop"
              @click="$refs.fileInput.click()"
            >
              <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleFileSelect" />
              <Upload class="mx-auto mb-2 w-8 h-8 text-stone-400" />
              <p class="font-medium text-stone-600 dark:text-stone-300 text-sm">JSON-Datei hier ablegen oder klicken</p>
              <p class="mt-1 text-stone-400 text-xs">Unterstützt AI Cookbook Export-Dateien</p>
            </div>

            <!-- Vorschau -->
            <div v-if="filePreview" class="bg-stone-50 dark:bg-stone-800 p-4 rounded-lg">
              <h4 class="mb-2 font-semibold text-stone-700 dark:text-stone-200 text-sm">📋 Vorschau</h4>
              <div class="space-y-1 text-stone-600 dark:text-stone-400 text-sm">
                <p>{{ filePreview.plan_count }} Wochenpläne</p>
                <p v-if="filePreview.exported_at">Exportiert: {{ formatDate(filePreview.exported_at) }}</p>
                <div v-if="filePreview.sample_weeks?.length" class="mt-2">
                  <p class="text-stone-500 text-xs">Beispiel-Wochen:</p>
                  <p v-for="w in filePreview.sample_weeks" :key="w" class="text-xs">• KW {{ w }}</p>
                </div>
              </div>
            </div>

            <!-- Import Button -->
            <button
              v-if="selectedFile"
              @click="handleImport"
              :disabled="importing"
              class="flex justify-center items-center gap-2 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 px-4 py-3 rounded-lg w-full font-medium text-white text-sm transition-colors"
            >
              <Loader2 v-if="importing" class="w-4 h-4 animate-spin" />
              <Upload v-else class="w-4 h-4" />
              {{ importing ? 'Importiere...' : 'Wochenpläne importieren' }}
            </button>

            <!-- Ergebnis -->
            <div v-if="importResult" class="bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800 rounded-lg">
              <p class="font-medium text-green-700 dark:text-green-300 text-sm">✅ {{ importResult.message }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth.js';
import { useNotification } from '@/composables/useNotification.js';
import { useApi } from '@/composables/useApi.js';
import { X, Download, Upload, Loader2 } from 'lucide-vue-next';

const props = defineProps({
  isAdmin: { type: Boolean, default: false },
  users: { type: Array, default: () => [] },
});
const emit = defineEmits(['close', 'imported']);

const authStore = useAuthStore();
const api = useApi();
const { showSuccess, showError } = useNotification();

const activeTab = ref('export');
const exporting = ref(false);
const importing = ref(false);
const selectedFile = ref(null);
const filePreview = ref(null);
const importResult = ref(null);
const isDragging = ref(false);
const exportUserId = ref(null);
const importUserId = ref(props.users[0]?.id || null);

async function handleExport() {
  exporting.value = true;
  try {
    const base = props.isAdmin ? '/api/admin/export/meal-plans' : '/api/mealplan/export';
    const params = new URLSearchParams();
    if (props.isAdmin && exportUserId.value) params.set('user_id', exportUserId.value);

    const response = await fetch(`${base}?${params}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (!response.ok) throw new Error('Export fehlgeschlagen');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wochenplaene-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Wochenpläne erfolgreich exportiert!');
  } catch (err) {
    showError(err.message || 'Export fehlgeschlagen');
  } finally {
    exporting.value = false;
  }
}

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
  if (!file.name.endsWith('.json')) {
    showError('Bitte eine JSON-Datei auswählen.');
    return;
  }
  selectedFile.value = file;
  importResult.value = null;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.plans?.length) {
      filePreview.value = {
        plan_count: data.plans.length,
        exported_at: data.exported_at,
        sample_weeks: data.plans.slice(0, 5).map(p => p.week_start),
      };
    } else {
      filePreview.value = null;
      showError('Keine Wochenpläne in der Datei gefunden.');
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
    const base = props.isAdmin ? '/admin/import/meal-plans' : '/mealplan/import';
    const formData = new FormData();
    formData.append('file', selectedFile.value);
    if (props.isAdmin && importUserId.value) {
      formData.append('user_id', importUserId.value);
    }
    const data = await api.upload(base, formData);
    importResult.value = data;
    showSuccess(data.message);
    emit('imported', data);
  } catch {
    // Fehler wird von useApi angezeigt
  } finally {
    importing.value = false;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
</script>
