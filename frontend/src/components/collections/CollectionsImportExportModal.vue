<!--
  ============================================
  Collections Import/Export Modal
  ============================================
  Export und Import von Sammlungen als JSON.
  Unterstützt User- und Admin-Modus.
-->
<template>
  <Teleport to="body">
    <div class="z-50 fixed inset-0 flex justify-center items-center p-4 overflow-y-auto" @click.self="$emit('close')">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')" />

      <!-- Modal -->
      <div class="relative bg-white dark:bg-stone-800 shadow-2xl rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex justify-between items-center p-5 border-stone-200 dark:border-stone-700 border-b">
          <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-lg">
            📂 Sammlungen – Export / Import
          </h2>
          <button @click="$emit('close')" class="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex border-stone-200 dark:border-stone-700 border-b">
          <button
            v-for="tab in ['export', 'import']"
            :key="tab"
            @click="activeTab = tab"
            :class="[
              'flex-1 py-3 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            ]"
          >
            {{ tab === 'export' ? '📤 Export' : '📥 Import' }}
          </button>
        </div>

        <div class="p-5">
          <!-- ═══════ EXPORT TAB ═══════ -->
          <div v-if="activeTab === 'export'" class="space-y-4">
            <p class="text-stone-500 dark:text-stone-400 text-sm">
              {{ isAdmin ? 'Alle Sammlungen aller Benutzer' : 'Deine Sammlungen' }} als JSON-Datei exportieren.
              Enthält Sammlung-Metadaten und zugeordnete Rezepttitel.
            </p>

            <!-- Admin: User-Filter -->
            <div v-if="isAdmin && users.length" class="space-y-2">
              <label class="font-medium text-stone-700 dark:text-stone-300 text-sm">Benutzer filtern (optional)</label>
              <select v-model="selectedUserId" class="text-sm input">
                <option :value="null">Alle Benutzer</option>
                <option v-for="u in users" :key="u.id" :value="u.id">
                  {{ u.display_name || u.username }}
                </option>
              </select>
            </div>

            <button
              @click="handleExport"
              :disabled="exporting"
              class="flex justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2.5 rounded-lg w-full font-medium text-white text-sm transition-colors"
            >
              <Loader2 v-if="exporting" class="w-4 h-4 animate-spin" />
              <Download v-else class="w-4 h-4" />
              {{ exporting ? 'Exportiere...' : 'Sammlungen exportieren' }}
            </button>
          </div>

          <!-- ═══════ IMPORT TAB ═══════ -->
          <div v-if="activeTab === 'import'" class="space-y-4">
            <p class="text-stone-500 dark:text-stone-400 text-sm">
              Sammlungen aus einer JSON-Datei importieren.
              Bestehende Sammlungen (gleicher Name) werden aktualisiert, Rezepte per Titel zugeordnet.
            </p>

            <!-- Admin: Ziel-User -->
            <div v-if="isAdmin && users.length" class="space-y-2">
              <label class="font-medium text-stone-700 dark:text-stone-300 text-sm">Für Benutzer importieren</label>
              <select v-model="importUserId" class="text-sm input" required>
                <option :value="null" disabled>Benutzer wählen…</option>
                <option v-for="u in users" :key="u.id" :value="u.id">
                  {{ u.display_name || u.username }}
                </option>
              </select>
            </div>

            <!-- Datei-Upload -->
            <div
              @dragover.prevent="dragOver = true"
              @dragleave="dragOver = false"
              @drop.prevent="handleDrop"
              :class="[
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                dragOver
                  ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-stone-300 dark:border-stone-600 hover:border-primary-400'
              ]"
              @click="$refs.fileInput.click()"
            >
              <Upload class="mx-auto mb-2 w-8 h-8 text-stone-400" />
              <p class="text-stone-600 dark:text-stone-300 text-sm">
                <span class="font-medium text-primary-600">Datei auswählen</span> oder hierher ziehen
              </p>
              <p class="mt-1 text-stone-400 text-xs">.json</p>
              <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleFileSelect" />
            </div>

            <!-- Datei-Vorschau -->
            <div v-if="filePreview" class="bg-stone-50 dark:bg-stone-700/50 p-4 rounded-lg">
              <div class="flex justify-between items-start mb-2">
                <span class="font-medium text-stone-700 dark:text-stone-200 text-sm">{{ selectedFile?.name }}</span>
                <button @click="clearFile" class="text-stone-400 hover:text-stone-600 text-xs">✕</button>
              </div>
              <div class="space-y-1 text-stone-500 dark:text-stone-400 text-xs">
                <p>📂 {{ filePreview.collection_count }} Sammlungen</p>
                <p v-if="filePreview.exported_at">📅 Exportiert: {{ formatDate(filePreview.exported_at) }}</p>
                <div v-if="filePreview.sample_names?.length" class="mt-2">
                  <p class="mb-1 font-medium">Beispiele:</p>
                  <p v-for="name in filePreview.sample_names" :key="name" class="truncate">📁 {{ name }}</p>
                </div>
              </div>
            </div>

            <!-- Import-Button -->
            <button
              v-if="selectedFile"
              @click="handleImport"
              :disabled="importing || (isAdmin && !importUserId)"
              class="flex justify-center items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2.5 rounded-lg w-full font-medium text-white text-sm transition-colors"
            >
              <Loader2 v-if="importing" class="w-4 h-4 animate-spin" />
              <Upload v-else class="w-4 h-4" />
              {{ importing ? 'Importiere...' : 'Sammlungen importieren' }}
            </button>

            <!-- Ergebnis -->
            <div v-if="importResult" :class="[
              'p-4 rounded-lg text-sm',
              importResult.skipped > 0
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
            ]">
              <p class="font-medium">{{ importResult.message }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';
import { useApi } from '@/composables/useApi.js';
import { useAuthStore } from '@/stores/auth.js';
import { useNotification } from '@/composables/useNotification.js';
import { X, Download, Upload, Loader2 } from 'lucide-vue-next';

const props = defineProps({
  isAdmin: { type: Boolean, default: false },
  users: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'imported']);

const api = useApi();
const authStore = useAuthStore();
const { showError } = useNotification();

const activeTab = ref('export');
const exporting = ref(false);
const importing = ref(false);
const dragOver = ref(false);
const selectedFile = ref(null);
const filePreview = ref(null);
const importResult = ref(null);
const selectedUserId = ref(null);
const importUserId = ref(null);

// ── Export ──
async function handleExport() {
  exporting.value = true;
  try {
    let url = props.isAdmin ? '/api/admin/export/collections' : '/api/collections/export';
    if (props.isAdmin && selectedUserId.value) {
      url += `?user_id=${selectedUserId.value}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (!response.ok) throw new Error('Export fehlgeschlagen');
    const blob = await response.blob();
    downloadBlob(blob, `sammlungen-export-${new Date().toISOString().split('T')[0]}.json`);
  } catch (err) {
    showError(err.message || 'Export fehlgeschlagen');
  } finally {
    exporting.value = false;
  }
}

// ── Import ──
function handleDrop(e) {
  dragOver.value = false;
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  selectedFile.value = file;
  importResult.value = null;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      filePreview.value = {
        collection_count: data.collection_count || data.collections?.length || 0,
        exported_at: data.exported_at,
        sample_names: (data.collections || []).slice(0, 5).map(c => `${c.icon || '📁'} ${c.name}`),
      };
    } catch {
      filePreview.value = null;
      showError('Datei konnte nicht gelesen werden');
    }
  };
  reader.readAsText(file);
}

function clearFile() {
  selectedFile.value = null;
  filePreview.value = null;
  importResult.value = null;
}

async function handleImport() {
  if (!selectedFile.value) return;
  if (props.isAdmin && !importUserId.value) return;

  importing.value = true;
  importResult.value = null;

  try {
    const formData = new FormData();
    formData.append('file', selectedFile.value);
    if (props.isAdmin && importUserId.value) {
      formData.append('user_id', importUserId.value);
    }

    const url = props.isAdmin ? '/admin/import/collections' : '/collections/import';
    const result = await api.upload(url, formData);
    importResult.value = result;
    emit('imported');
  } catch (err) {
    importResult.value = { message: err.message || 'Import fehlgeschlagen', skipped: 1 };
  } finally {
    importing.value = false;
  }
}

// ── Helpers ──
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}
</script>
