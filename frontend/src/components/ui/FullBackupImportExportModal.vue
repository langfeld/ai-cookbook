<!--
  ============================================
  Full Backup Import/Export Modal
  ============================================
  Komplett-Export und -Import aller Benutzerdaten
  in einer einzigen JSON-Datei.

  Props:
  - isAdmin: Zeigt Admin-spezifische Optionen (User-Auswahl)
  - users: Admin-User-Liste für Ziel-Auswahl
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
            💾 Komplett-Backup – Export / Import
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
              {{ isAdmin ? 'Kompletter Export aller Benutzerdaten' : 'Alle deine Daten' }} als eine JSON-Datei herunterladen.
              Enthält Rezepte, Sammlungen, Vorratsschrank, Wochenpläne, Einkaufslisten, Rezept-Sperren und Zutaten-Einstellungen.
            </p>

            <!-- Bilder einbetten -->
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="includeImages" class="rounded" />
              <span class="text-stone-700 dark:text-stone-300 text-sm">Rezeptbilder einbetten (größere Datei)</span>
            </label>

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
              {{ exporting ? 'Exportiere...' : 'Komplett-Backup exportieren' }}
            </button>
          </div>

          <!-- ═══════ IMPORT TAB ═══════ -->
          <div v-if="activeTab === 'import'" class="space-y-4">
            <p class="text-stone-500 dark:text-stone-400 text-sm">
              Daten aus einer Komplett-Backup-Datei importieren.
              Bestehende Daten werden <strong class="text-stone-700 dark:text-stone-200">nicht</strong> gelöscht — Duplikate werden übersprungen oder aktualisiert.
            </p>

            <!-- Sicherheitshinweis -->
            <div class="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              <ShieldAlert class="mt-0.5 w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p class="text-amber-700 dark:text-amber-300 text-xs">
                Import nur aus vertrauenswürdigen Quellen! IDs werden ignoriert — alle Daten werden deinem Konto zugeordnet.
                Einkaufslisten werden inaktiv importiert.
              </p>
            </div>

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
                <span class="font-medium text-primary-600">Backup-Datei auswählen</span> oder hierher ziehen
              </p>
              <p class="mt-1 text-stone-400 text-xs">.json</p>
              <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleFileSelect" />
            </div>

            <!-- Datei-Vorschau -->
            <div v-if="filePreview" class="bg-stone-50 dark:bg-stone-700/50 p-4 rounded-lg">
              <div class="flex justify-between items-start mb-3">
                <span class="font-medium text-stone-700 dark:text-stone-200 text-sm">{{ selectedFile?.name }}</span>
                <button @click="clearFile" class="text-stone-400 hover:text-stone-600 text-xs">✕</button>
              </div>
              <div class="gap-2 grid grid-cols-2 text-xs">
                <div v-for="item in previewItems" :key="item.label" class="flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
                  <span>{{ item.icon }}</span>
                  <span>{{ item.count }} {{ item.label }}</span>
                </div>
              </div>
              <p v-if="filePreview.exported_at" class="mt-2 text-stone-400 text-xs">
                📅 Exportiert: {{ formatDate(filePreview.exported_at) }}
              </p>
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
              {{ importing ? 'Importiere...' : 'Komplett-Backup importieren' }}
            </button>

            <!-- Ergebnis -->
            <div v-if="importResult" class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-sm">
              <p class="mb-2 font-medium text-green-700 dark:text-green-300">{{ importResult.message }}</p>
              <div v-if="importResult.details" class="space-y-1 text-green-600 dark:text-green-400 text-xs">
                <p v-for="(detail, key) in importResult.details" :key="key">
                  <span class="font-medium">{{ detailLabels[key] || key }}:</span>
                  {{ detail.imported || 0 }} importiert
                  <template v-if="detail.updated">, {{ detail.updated }} aktualisiert</template>
                  <template v-if="detail.skipped">, {{ detail.skipped }} übersprungen</template>
                  <template v-if="detail.recipes_linked">, {{ detail.recipes_linked }} Rezepte verknüpft</template>
                  <template v-if="detail.entries_imported">, {{ detail.entries_imported }} Einträge</template>
                  <template v-if="detail.items_imported">, {{ detail.items_imported }} Artikel</template>
                </p>
              </div>
            </div>

            <!-- Fehler -->
            <div v-if="importError" class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-sm">
              <p class="font-medium text-red-700 dark:text-red-300">{{ importError }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useApi } from '@/composables/useApi.js';
import { useAuthStore } from '@/stores/auth.js';
import { useNotification } from '@/composables/useNotification.js';
import { X, Download, Upload, Loader2, ShieldAlert } from 'lucide-vue-next';

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
const includeImages = ref(false);
const dragOver = ref(false);
const selectedFile = ref(null);
const filePreview = ref(null);
const importResult = ref(null);
const importError = ref(null);
const selectedUserId = ref(null);
const importUserId = ref(null);

const detailLabels = {
  recipes: '📦 Rezepte',
  collections: '📂 Sammlungen',
  pantry: '🗄️ Vorratsschrank',
  meal_plans: '📅 Wochenpläne',
  shopping_lists: '🛒 Einkaufslisten',
  recipe_blocks: '🚫 Rezept-Sperren',
  ingredient_aliases: '🔗 Zutaten-Aliase',
  blocked_ingredients: '🚫 Geblockte Zutaten',
};

const previewItems = computed(() => {
  if (!filePreview.value?.summary) return [];
  const s = filePreview.value.summary;
  return [
    { icon: '📦', count: s.recipes || 0, label: 'Rezepte' },
    { icon: '📂', count: s.collections || 0, label: 'Sammlungen' },
    { icon: '🗄️', count: s.pantry_items || 0, label: 'Vorräte' },
    { icon: '📅', count: s.meal_plans || 0, label: 'Wochenpläne' },
    { icon: '🛒', count: s.shopping_lists || 0, label: 'Einkaufslisten' },
    { icon: '🚫', count: s.recipe_blocks || 0, label: 'Sperren' },
    { icon: '🔗', count: s.ingredient_aliases || 0, label: 'Aliase' },
    { icon: '⛔', count: s.blocked_ingredients || 0, label: 'Geblockte' },
  ].filter(i => i.count > 0);
});

// ── Export ──
async function handleExport() {
  exporting.value = true;
  try {
    let url;
    if (props.isAdmin) {
      url = '/api/admin/backup/export-json';
      if (selectedUserId.value) url += `?user_id=${selectedUserId.value}`;
      if (includeImages.value) url += `${selectedUserId.value ? '&' : '?'}include_images=true`;
    } else {
      url = '/api/backup/export';
      if (includeImages.value) url += '?include_images=true';
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (!response.ok) throw new Error('Export fehlgeschlagen');
    const blob = await response.blob();
    const date = new Date().toISOString().split('T')[0];
    downloadBlob(blob, `zauberjournal-backup-${date}.json`);
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
  importError.value = null;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // Validiere dass es ein Zauberjournal-Backup ist
      if (data.source !== 'Zauberjournal') {
        filePreview.value = null;
        importError.value = 'Diese Datei ist kein gültiges Zauberjournal-Backup.';
        return;
      }
      if (data.type !== 'full_backup' && data.type !== 'admin_full_backup') {
        filePreview.value = null;
        importError.value = 'Diese Datei ist kein Komplett-Backup. Bitte nutze den jeweiligen Einzel-Import.';
        return;
      }

      // Summary extrahieren
      let summary;
      if (data.type === 'full_backup') {
        summary = data.summary || {};
      } else if (data.type === 'admin_full_backup' && Array.isArray(data.users)) {
        // Summen über alle User
        summary = {};
        for (const u of data.users) {
          const d = u.data || {};
          summary.recipes = (summary.recipes || 0) + (d.recipes?.length || 0);
          summary.collections = (summary.collections || 0) + (d.collections?.length || 0);
          summary.pantry_items = (summary.pantry_items || 0) + (d.pantry?.length || 0);
          summary.meal_plans = (summary.meal_plans || 0) + (d.meal_plans?.length || 0);
          summary.shopping_lists = (summary.shopping_lists || 0) + (d.shopping_lists?.length || 0);
          summary.recipe_blocks = (summary.recipe_blocks || 0) + (d.recipe_blocks?.length || 0);
          summary.ingredient_aliases = (summary.ingredient_aliases || 0) + (d.ingredient_aliases?.length || 0);
          summary.blocked_ingredients = (summary.blocked_ingredients || 0) + (d.blocked_ingredients?.length || 0);
        }
      }

      filePreview.value = {
        summary,
        exported_at: data.exported_at,
        user_count: data.user_count,
      };
    } catch {
      filePreview.value = null;
      importError.value = 'Datei konnte nicht gelesen werden — ungültiges JSON.';
    }
  };
  reader.readAsText(file);
}

function clearFile() {
  selectedFile.value = null;
  filePreview.value = null;
  importResult.value = null;
  importError.value = null;
}

async function handleImport() {
  if (!selectedFile.value) return;
  if (props.isAdmin && !importUserId.value) return;

  importing.value = true;
  importResult.value = null;
  importError.value = null;

  try {
    const formData = new FormData();
    formData.append('file', selectedFile.value);
    if (props.isAdmin && importUserId.value) {
      formData.append('user_id', importUserId.value);
    }

    const url = props.isAdmin ? '/admin/backup/import-json' : '/backup/import';
    const result = await api.upload(url, formData);
    importResult.value = result;
    emit('imported');
  } catch (err) {
    importError.value = err.message || 'Import fehlgeschlagen';
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
