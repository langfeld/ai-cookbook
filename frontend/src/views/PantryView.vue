<!--
  ============================================
  PantryView - Vorratsschrank
  ============================================
  Übersicht über vorhandene Vorräte:
  - Gruppiert nach Kategorie
  - Ablaufdatum-Warnung
  - Hinzufügen / Bearbeiten / Verbrauchen
-->
<template>
  <div class="space-y-6 animate-fade-in">
    <!-- Header -->
    <div class="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl">🗄️ Vorratsschrank</h1>
        <p class="text-stone-500 dark:text-stone-400 text-sm">
          {{ pantryStore.items.length }} Artikel vorrätig
        </p>
      </div>
      <div class="flex gap-2">
        <!-- Export-Dropdown -->
        <div class="relative" ref="exportDropdownRef">
          <button
            @click="showExportMenu = !showExportMenu"
            :disabled="!pantryStore.items.length"
            class="flex items-center gap-2 bg-white hover:bg-stone-50 dark:bg-stone-800 dark:hover:bg-stone-700 disabled:opacity-40 px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl font-medium text-stone-700 dark:text-stone-300 text-sm transition-colors disabled:cursor-not-allowed"
          >
            <Download class="w-4 h-4" />
            Export
          </button>
          <div
            v-if="showExportMenu"
            class="right-0 z-10 absolute bg-white dark:bg-stone-800 shadow-lg mt-1 border border-stone-200 dark:border-stone-700 rounded-xl w-48 overflow-hidden"
          >
            <button
              @click="exportPantry('csv')"
              class="flex items-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-700 px-4 py-2.5 w-full text-stone-700 dark:text-stone-300 text-sm text-left"
            >
              <FileSpreadsheet class="w-4 h-4 text-green-600" />
              Als CSV (Excel)
            </button>
            <button
              @click="exportPantry('json')"
              class="flex items-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-700 px-4 py-2.5 w-full text-stone-700 dark:text-stone-300 text-sm text-left"
            >
              <FileJson class="w-4 h-4 text-blue-600" />
              Als JSON (Backup)
            </button>
          </div>
        </div>

        <!-- Import-Button -->
        <button
          @click="$refs.importFileInput.click()"
          class="flex items-center gap-2 bg-white hover:bg-stone-50 dark:bg-stone-800 dark:hover:bg-stone-700 px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl font-medium text-stone-700 dark:text-stone-300 text-sm transition-colors"
        >
          <Upload class="w-4 h-4" />
          Import
        </button>
        <input
          ref="importFileInput"
          type="file"
          accept=".json,.csv,application/json,text/csv"
          class="hidden"
          @change="handleImportFile"
        />

        <button
          @click="showAddModal = true"
          class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-xl font-medium text-white text-sm transition-colors"
        >
          <Plus class="w-4 h-4" />
          Vorrat hinzufügen
        </button>
      </div>
    </div>

    <!-- Ablaufende Artikel Warnung -->
    <div v-if="expiringItems.length" class="bg-amber-50 dark:bg-amber-900/20 p-4 border border-amber-200 dark:border-amber-800 rounded-xl">
      <div class="flex items-center gap-2 mb-2">
        <AlertTriangle class="w-5 h-5 text-amber-500" />
        <span class="font-medium text-amber-700 dark:text-amber-400 text-sm">Bald ablaufend</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="item in expiringItems"
          :key="item.id"
          class="bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded-lg text-amber-700 dark:text-amber-300 text-xs"
        >
          {{ item.ingredient_name }} – {{ formatDate(item.expiry_date) }}
        </span>
      </div>
    </div>

    <!-- Filter -->
    <div class="flex gap-2">
      <input
        v-model="search"
        type="text"
        placeholder="Vorrat suchen..."
        class="flex-1 bg-white dark:bg-stone-800 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 text-sm"
      />
    </div>

    <!-- Vorrats-Liste (gruppiert) -->
    <div v-if="filteredGrouped && Object.keys(filteredGrouped).length" class="space-y-6">
      <div v-for="(items, category) in filteredGrouped" :key="category">
        <h3 class="flex items-center gap-2 mb-3 font-semibold text-stone-500 dark:text-stone-400 text-sm">
          {{ categoryIcon(category) }} {{ category }}
          <span class="font-normal text-xs">({{ items.length }})</span>
        </h3>
        <div class="gap-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="item in items"
            :key="item.id"
            class="bg-white dark:bg-stone-900 p-4 border border-stone-200 hover:border-primary-300 dark:border-stone-800 dark:hover:border-primary-700 rounded-xl transition-colors"
          >
            <div class="flex justify-between items-start">
              <div>
                <h4 class="flex items-center gap-1.5 font-medium text-stone-800 dark:text-stone-200 text-sm">
                  {{ item.ingredient_name }}
                  <span v-if="item.is_permanent" class="inline-flex items-center gap-0.5 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full text-[10px] text-blue-600 dark:text-blue-400" title="Dauerhaft verfügbar">
                    <Infinity class="w-3 h-3" />
                  </span>
                </h4>
                <p v-if="!item.is_permanent" class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                  {{ item.amount }} {{ item.unit }}
                </p>
                <p v-else class="mt-0.5 text-blue-500 dark:text-blue-400 text-xs">
                  Immer verfügbar
                </p>
              </div>
              <div class="flex gap-1">
                <button
                  v-if="!item.is_permanent"
                  @click="openUseModal(item)"
                  class="p-1.5 rounded-lg text-accent-600 hover:bg-accent-50 dark:hover:bg-accent-900/20"
                  title="Verbrauchen"
                >
                  <Minus class="w-3.5 h-3.5" />
                </button>
                <button
                  @click="removeItem(item)"
                  class="hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg text-red-500"
                  title="Entfernen"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <!-- Ablaufdatum -->
            <div v-if="item.expiry_date && !item.is_permanent" class="mt-2">
              <span :class="[
                'text-xs px-2 py-0.5 rounded-full',
                isExpiringSoon(item.expiry_date)
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
              ]">
                MHD: {{ formatDate(item.expiry_date) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Leerer Zustand -->
    <div v-else-if="!pantryStore.loading" class="py-16 text-center">
      <div class="mb-4 text-6xl">🗄️</div>
      <h2 class="mb-2 font-semibold text-stone-700 dark:text-stone-300 text-xl">Vorratsschrank ist leer</h2>
      <p class="mx-auto max-w-md text-stone-500 dark:text-stone-400">
        Füge Vorräte hinzu oder schließe einen Einkauf ab – gekaufte Artikel landen automatisch hier.
      </p>
    </div>

    <!-- Hinzufügen-Modal -->
    <Teleport to="body">
      <div v-if="showAddModal" class="z-50 fixed inset-0 flex justify-center items-center bg-black/50 p-4" @click.self="showAddModal = false">
        <div class="space-y-4 bg-white dark:bg-stone-900 p-6 rounded-2xl w-full max-w-md animate-slide-up">
          <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">Vorrat hinzufügen</h2>

          <div>
            <label class="block mb-1 text-stone-600 dark:text-stone-400 text-sm">Name *</label>
            <input v-model="addForm.name" type="text" class="form-input" placeholder="z.B. Mehl" />
          </div>
          <div v-if="!addForm.is_permanent" class="gap-3 grid grid-cols-2">
            <div>
              <label class="block mb-1 text-stone-600 dark:text-stone-400 text-sm">Menge</label>
              <input v-model.number="addForm.amount" type="number" step="0.01" class="form-input" />
            </div>
            <div>
              <label class="block mb-1 text-stone-600 dark:text-stone-400 text-sm">Einheit</label>
              <input v-model="addForm.unit" type="text" class="form-input" placeholder="kg, l, Stk." />
            </div>
          </div>
          <div>
            <label class="block mb-1 text-stone-600 dark:text-stone-400 text-sm">Kategorie</label>
            <select v-model="addForm.category" class="form-input">
              <option value="">Sonstiges</option>
              <option v-for="cat in pantryCategories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>

          <!-- Dauerhaft verfügbar Toggle -->
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <div class="relative">
              <input type="checkbox" v-model="addForm.is_permanent" class="sr-only peer" />
              <div class="bg-stone-200 dark:bg-stone-700 peer-checked:bg-blue-500 rounded-full w-10 h-5 transition-colors"></div>
              <div class="top-0.5 left-0.5 absolute bg-white rounded-full w-4 h-4 transition-transform peer-checked:translate-x-5"></div>
            </div>
            <div>
              <span class="font-medium text-stone-700 dark:text-stone-300 text-sm">Dauerhaft verfügbar</span>
              <p class="text-stone-400 dark:text-stone-500 text-xs">z.B. Wasser, Salz, Pfeffer – immer vorhanden</p>
            </div>
          </label>

          <div v-if="!addForm.is_permanent">
            <label class="block mb-1 text-stone-600 dark:text-stone-400 text-sm">MHD (optional)</label>
            <input v-model="addForm.expires_at" type="date" class="form-input" />
          </div>

          <div class="flex gap-2 pt-2">
            <button
              @click="addItem"
              :disabled="!addForm.name"
              class="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 py-2 rounded-lg font-medium text-white text-sm"
            >
              Hinzufügen
            </button>
            <button
              @click="showAddModal = false"
              class="px-4 py-2 border border-stone-300 dark:border-stone-600 rounded-lg text-stone-700 dark:text-stone-300 text-sm"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Verbrauchen-Modal -->
    <Teleport to="body">
      <div v-if="useModal.show" class="z-50 fixed inset-0 flex justify-center items-center bg-black/50 p-4" @click.self="useModal.show = false">
        <div class="space-y-4 bg-white dark:bg-stone-900 p-6 rounded-2xl w-full max-w-sm animate-slide-up">
          <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">
            {{ useModal.item?.ingredient_name }} verbrauchen
          </h2>
          <p class="text-stone-500 text-sm">
            Vorrätig: {{ useModal.item?.amount }} {{ useModal.item?.unit }}
          </p>
          <div>
            <label class="block mb-1 text-stone-600 dark:text-stone-400 text-sm">Menge verbrauchen</label>
            <input v-model.number="useModal.amount" type="number" step="0.01" min="0" class="form-input" />
          </div>
          <div class="flex gap-2">
            <button
              @click="useAmount"
              :disabled="!useModal.amount"
              class="flex-1 disabled:opacity-50 py-2 rounded-lg font-medium text-white text-sm bg-accent-600 hover:bg-accent-700"
            >
              Verbrauchen
            </button>
            <button
              @click="useModal.show = false"
              class="px-4 py-2 border border-stone-300 dark:border-stone-600 rounded-lg text-sm"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Import-Vorschau-Modal -->
    <Teleport to="body">
      <div v-if="importPreview" class="z-50 fixed inset-0 flex justify-center items-center bg-black/50 p-4" @click.self="cancelImport">
        <div class="flex flex-col space-y-4 bg-white dark:bg-stone-900 p-6 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden animate-slide-up">
          <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">
            📥 Import-Vorschau
          </h2>
          <p class="text-stone-500 dark:text-stone-400 text-sm">
            {{ importPreview.items.length }} Artikel gefunden
            <span v-if="importPreview.source"> · Quelle: {{ importPreview.source }}</span>
          </p>

          <!-- Vorschau-Liste -->
          <div class="flex-1 space-y-1 p-3 border border-stone-200 dark:border-stone-700 rounded-lg max-h-60 overflow-y-auto">
            <div
              v-for="(item, i) in importPreview.items.slice(0, 30)"
              :key="i"
              class="flex justify-between items-center py-1 border-stone-100 dark:border-stone-800 last:border-0 border-b text-sm"
            >
              <span class="text-stone-700 dark:text-stone-300 truncate">{{ item.ingredient_name }}</span>
              <span class="ml-2 text-stone-400 dark:text-stone-500 shrink-0">
                {{ item.amount }} {{ item.unit }}
                <span v-if="item.category && item.category !== 'Sonstiges'" class="text-xs"> · {{ item.category }}</span>
              </span>
            </div>
            <p v-if="importPreview.items.length > 30" class="pt-1 text-stone-400 text-xs italic">
              ... und {{ importPreview.items.length - 30 }} weitere
            </p>
          </div>

          <!-- Import-Ergebnis -->
          <div v-if="importResult" :class="[
            'p-3 rounded-lg text-sm',
            importResult.skipped > 0
              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
              : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
          ]">
            <p class="font-medium">{{ importResult.message }}</p>
            <ul v-if="importResult.errors?.length" class="space-y-1 mt-2 text-xs">
              <li v-for="(err, i) in importResult.errors.slice(0, 5)" :key="i">⚠️ {{ err }}</li>
            </ul>
          </div>

          <div class="flex gap-2 pt-2">
            <button
              v-if="!importResult"
              @click="executeImport"
              :disabled="importing"
              class="flex flex-1 justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 py-2 rounded-lg font-medium text-white text-sm"
            >
              <Loader2 v-if="importing" class="w-4 h-4 animate-spin" />
              <Upload v-else class="w-4 h-4" />
              {{ importing ? 'Importiere...' : `${importPreview.items.length} Artikel importieren` }}
            </button>
            <button
              @click="cancelImport"
              class="px-4 py-2 border border-stone-300 dark:border-stone-600 rounded-lg text-stone-700 dark:text-stone-300 text-sm"
            >
              {{ importResult ? 'Schließen' : 'Abbrechen' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { usePantryStore } from '@/stores/pantry.js';
import { useNotification } from '@/composables/useNotification.js';
import { Plus, Minus, Trash2, AlertTriangle, Download, Upload, FileSpreadsheet, FileJson, Loader2, Infinity } from 'lucide-vue-next';

const pantryStore = usePantryStore();
const { showSuccess, showError } = useNotification();

const search = ref('');
const showAddModal = ref(false);
const showExportMenu = ref(false);
const exportDropdownRef = ref(null);
const importPreview = ref(null);
const importResult = ref(null);
const importing = ref(false);
const importFile = ref(null);
const useModal = reactive({ show: false, item: null, amount: 0 });

const addForm = reactive({
  name: '',
  amount: 1,
  unit: 'Stk.',
  category: '',
  expires_at: '',
  is_permanent: false,
});

const pantryCategories = [
  'Obst & Gemüse', 'Milchprodukte', 'Fleisch & Fisch', 'Backwaren',
  'Gewürze', 'Getränke', 'Tiefkühl', 'Konserven', 'Grundzutaten',
];

// Ablaufende Artikel (< 3 Tage)
const expiringItems = computed(() => {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 3);
  return pantryStore.items.filter(i => i.expiry_date && new Date(i.expiry_date) <= threshold);
});

// Nach Suche filtern und gruppieren
const filteredGrouped = computed(() => {
  const query = search.value.toLowerCase();
  const items = pantryStore.items.filter(i => !query || i.ingredient_name.toLowerCase().includes(query));
  const groups = {};
  for (const item of items) {
    const cat = item.category || 'Sonstiges';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
});

function categoryIcon(cat) {
  const icons = {
    'Obst & Gemüse': '🥬', 'Milchprodukte': '🧀', 'Fleisch & Fisch': '🥩',
    'Backwaren': '🍞', 'Gewürze': '🧂', 'Getränke': '🥤', 'Tiefkühl': '🧊',
    'Konserven': '🥫', 'Grundzutaten': '🌾', 'Sonstiges': '📦',
  };
  return icons[cat] || '📦';
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function isExpiringSoon(dateStr) {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 3);
  return new Date(dateStr) <= threshold;
}

function openUseModal(item) {
  useModal.item = item;
  useModal.amount = item.amount;
  useModal.show = true;
}

async function addItem() {
  try {
    await pantryStore.addItem({
      ingredient_name: addForm.name,
      amount: addForm.is_permanent ? 1 : addForm.amount,
      unit: addForm.is_permanent ? '' : addForm.unit,
      category: addForm.category || undefined,
      expiry_date: addForm.is_permanent ? undefined : (addForm.expires_at || undefined),
      is_permanent: addForm.is_permanent ? 1 : 0,
    });
    showSuccess(`${addForm.name} hinzugefügt!`);
    showAddModal.value = false;
    Object.assign(addForm, { name: '', amount: 1, unit: 'Stk.', category: '', expires_at: '', is_permanent: false });
  } catch {
    // Fehler wird von useApi angezeigt
  }
}

async function useAmount() {
  try {
    await pantryStore.useAmount(useModal.item.id, useModal.amount);
    showSuccess(`${useModal.amount} ${useModal.item.unit} verbraucht`);
    useModal.show = false;
  } catch {
    // Fehler wird von useApi angezeigt
  }
}

async function removeItem(item) {
  if (!confirm(`${item.ingredient_name} wirklich entfernen?`)) return;
  try {
    await pantryStore.removeItem(item.id);
    showSuccess(`${item.ingredient_name} entfernt`);
  } catch {
    // Fehler wird von useApi angezeigt
  }
}

onMounted(() => {
  pantryStore.fetchItems();
  document.addEventListener('click', closeExportMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeExportMenu);
});

/** Export-Menü schließen bei Klick außerhalb */
function closeExportMenu(e) {
  if (exportDropdownRef.value && !exportDropdownRef.value.contains(e.target)) {
    showExportMenu.value = false;
  }
}

// ============================================
// IMPORT
// ============================================

/** Datei ausgewählt → Vorschau generieren */
function handleImportFile(event) {
  const file = event.target.files[0];
  event.target.value = ''; // Reset, damit gleiche Datei erneut wählbar
  if (!file) return;

  if (!file.name.endsWith('.json') && !file.name.endsWith('.csv')) {
    showError('Bitte eine JSON- oder CSV-Datei auswählen.');
    return;
  }

  importFile.value = file;
  importResult.value = null;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      let items;

      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        items = Array.isArray(parsed) ? parsed : parsed.items;
      } else {
        // CSV parsen
        items = parseCsvImport(text);
      }

      if (!items?.length) {
        showError('Keine Artikel in der Datei gefunden.');
        return;
      }

      importPreview.value = {
        items,
        source: file.name,
      };
    } catch {
      showError('Datei konnte nicht gelesen werden. Bitte Format prüfen.');
    }
  };
  reader.readAsText(file, 'utf-8');
}

/** CSV-Text für Vorschau parsen */
function parseCsvImport(text) {
  const clean = text.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());

  const nameIdx = headers.findIndex(h => ['zutat', 'ingredient_name', 'name', 'artikel'].includes(h));
  const amountIdx = headers.findIndex(h => ['menge', 'amount', 'anzahl'].includes(h));
  const unitIdx = headers.findIndex(h => ['einheit', 'unit'].includes(h));
  const catIdx = headers.findIndex(h => ['kategorie', 'category'].includes(h));
  const expiryIdx = headers.findIndex(h => ['mhd', 'expiry_date', 'ablaufdatum'].includes(h));
  const notesIdx = headers.findIndex(h => ['notizen', 'notes', 'bemerkung'].includes(h));
  const permanentIdx = headers.findIndex(h => ['dauerhaft', 'is_permanent', 'permanent'].includes(h));

  if (nameIdx === -1) return null;

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.replace(/^"|"$/g, '').trim());
    const name = cols[nameIdx];
    if (!name) continue;
    items.push({
      ingredient_name: name,
      amount: parseFloat(cols[amountIdx]) || 1,
      unit: cols[unitIdx] || 'Stk.',
      category: cols[catIdx] || 'Sonstiges',
      expiry_date: cols[expiryIdx] || null,
      notes: cols[notesIdx] || null,
      is_permanent: permanentIdx >= 0 && ['ja', 'yes', '1', 'true'].includes((cols[permanentIdx] || '').toLowerCase()),
    });
  }
  return items;
}

/** Import ausführen */
async function executeImport() {
  if (!importFile.value) return;
  importing.value = true;
  try {
    const result = await pantryStore.importItems(importFile.value);
    importResult.value = result;
    showSuccess(result.message);
  } catch {
    // Fehler wird von useApi angezeigt
  } finally {
    importing.value = false;
  }
}

/** Import abbrechen / schließen */
function cancelImport() {
  importPreview.value = null;
  importResult.value = null;
  importFile.value = null;
  importing.value = false;
}

/** Vorratsschrank exportieren (CSV oder JSON) */
function exportPantry(format) {
  showExportMenu.value = false;
  const items = pantryStore.items;
  if (!items.length) return;

  const today = new Date().toISOString().slice(0, 10);
  let content, mimeType, extension;

  if (format === 'csv') {
    // CSV mit Semikolon (deutscher Excel-Standard), BOM für korrekte Umlaute
    const header = 'Zutat;Menge;Einheit;Kategorie;MHD;Notizen;Dauerhaft';
    const rows = items.map(i => [
      csvEscape(i.ingredient_name),
      i.amount ?? '',
      csvEscape(i.unit || ''),
      csvEscape(i.category || 'Sonstiges'),
      i.expiry_date || '',
      csvEscape(i.notes || ''),
      i.is_permanent ? 'Ja' : 'Nein',
    ].join(';'));
    content = '\uFEFF' + [header, ...rows].join('\r\n');
    mimeType = 'text/csv;charset=utf-8';
    extension = 'csv';
  } else {
    // JSON (schönes Format für Backup/Import)
    const exportData = {
      exportedAt: new Date().toISOString(),
      itemCount: items.length,
      items: items.map(i => ({
        ingredient_name: i.ingredient_name,
        amount: i.amount,
        unit: i.unit,
        category: i.category || 'Sonstiges',
        expiry_date: i.expiry_date || null,
        notes: i.notes || null,
        is_permanent: i.is_permanent || false,
      })),
    };
    content = JSON.stringify(exportData, null, 2);
    mimeType = 'application/json;charset=utf-8';
    extension = 'json';
  }

  // Download auslösen
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vorratsschrank-${today}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showSuccess(`Vorratsschrank als ${extension.toUpperCase()} exportiert (${items.length} Artikel)`);
}

/** CSV-Feld escapen (Semikolons, Anführungszeichen, Zeilenumbrüche) */
function csvEscape(value) {
  if (!value) return '';
  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}
</script>

<style scoped>
.form-input {
  width: 100%;
  padding-inline: calc(var(--spacing) * 3);
  padding-block: calc(var(--spacing) * 2);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-stone-200);
  background-color: white;
  color: var(--color-stone-800);
  font-size: var(--text-sm);
  line-height: var(--text-sm--line-height);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.form-input:focus {
  border-color: var(--color-primary-400);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-primary-500) 30%, transparent);
}
:is(.dark .form-input) {
  border-color: var(--color-stone-700);
  background-color: var(--color-stone-800);
  color: var(--color-stone-200);
}
</style>
