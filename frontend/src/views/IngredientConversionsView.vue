<!--
  ============================================
  Zutat-Umrechnungen verwalten
  ============================================
  Zutat-spezifische Einheiten-Umrechnungen (z.B. 1 Stk Zwiebel = 80g).
  Ermöglicht manuelles Erstellen/Bearbeiten/Löschen und KI-Generierung.
-->
<template>
  <div class="mx-auto p-4 sm:p-6 lg:p-8 max-w-5xl">
    <!-- Header -->
    <div class="flex sm:flex-row flex-col sm:items-center gap-4 mb-6 sm:mb-8">
      <div class="flex-1">
        <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl sm:text-3xl">
          Einheiten-Umrechnung
        </h1>
        <p class="mt-1 text-stone-500 dark:text-stone-400 text-sm">
          Zutat-spezifische Umrechnungen · {{ conversions.length }} Einträge
        </p>
      </div>
      <div class="flex gap-2">
        <button
          @click="startAIGeneration"
          :disabled="generating"
          class="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-4 py-2.5 rounded-lg font-medium text-white text-sm transition-colors"
        >
          <Sparkles class="w-4 h-4" :class="{ 'animate-pulse': generating }" />
          {{ generating ? 'Generiert...' : 'KI-Vorschläge' }}
        </button>
        <button
          @click="openAdd"
          class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 px-4 py-2.5 rounded-lg font-medium text-white text-sm transition-colors"
        >
          <PlusCircle class="w-4 h-4" />
          Neue Umrechnung
        </button>
      </div>
    </div>

    <!-- Suche -->
    <div class="relative mb-4">
      <Search class="top-1/2 left-3 absolute w-4 h-4 text-stone-400 -translate-y-1/2" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Zutat suchen..."
        class="bg-white dark:bg-stone-800 py-2.5 pr-4 pl-10 border border-stone-200 focus:border-primary-400 dark:border-stone-700 dark:focus:border-primary-500 rounded-lg outline-none w-full text-sm transition-colors"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 rounded-full w-8 h-8 animate-spin"></div>
    </div>

    <!-- Tabelle -->
    <template v-else>
      <div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700 border-b text-left">
                <th class="px-4 py-3 font-semibold text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Zutat</th>
                <th class="px-4 py-3 w-24 font-semibold text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Von</th>
                <th class="px-4 py-3 w-20 font-semibold text-stone-500 dark:text-stone-400 text-xs text-center uppercase tracking-wider">→</th>
                <th class="px-4 py-3 w-24 font-semibold text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Menge</th>
                <th class="px-4 py-3 w-24 font-semibold text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Einheit</th>
                <th class="px-4 py-3 w-28 font-semibold text-stone-500 dark:text-stone-400 text-xs text-right uppercase tracking-wider">Aktionen</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-100 dark:divide-stone-800">
              <tr
                v-for="conv in filteredConversions"
                :key="conv.id"
                class="hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors"
              >
                <td class="px-4 py-3 font-medium text-stone-700 dark:text-stone-300 text-sm">{{ conv.ingredient_name }}</td>
                <td class="px-4 py-3 text-stone-500 dark:text-stone-400 text-sm">
                  <span class="bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded text-xs">1 {{ conv.from_unit }}</span>
                </td>
                <td class="px-4 py-3 text-stone-400 text-sm text-center">→</td>
                <td class="px-4 py-3 font-mono text-stone-700 dark:text-stone-300 text-sm">{{ conv.to_amount }}</td>
                <td class="px-4 py-3 text-stone-500 dark:text-stone-400 text-sm">
                  <span class="bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded text-primary-700 dark:text-primary-300 text-xs">{{ conv.to_unit }}</span>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex justify-end gap-1">
                    <button
                      @click="openEdit(conv)"
                      class="hover:bg-stone-100 dark:hover:bg-stone-700 p-1.5 rounded-lg text-stone-400 hover:text-primary-600 transition-colors"
                      title="Bearbeiten"
                    >
                      <Pencil class="w-4 h-4" />
                    </button>
                    <button
                      @click="deleteConversion(conv)"
                      class="hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg text-stone-400 hover:text-red-600 transition-colors"
                      title="Löschen"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredConversions.length === 0">
                <td colspan="6" class="px-4 py-12 text-stone-400 text-sm text-center italic">
                  {{ searchQuery ? 'Keine Ergebnisse gefunden.' : 'Noch keine Umrechnungen vorhanden. Klicke auf „KI-Vorschläge", um automatisch welche zu erzeugen.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Info-Box -->
    <div class="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 mt-6 p-4 border border-blue-200 dark:border-blue-800 rounded-xl">
      <Info class="mt-0.5 w-5 h-5 text-blue-500 shrink-0" />
      <div class="text-blue-700 dark:text-blue-300 text-sm">
        <p class="mb-1 font-medium">Wie funktionieren Umrechnungen?</p>
        <ul class="space-y-1 text-blue-600 dark:text-blue-400 text-xs list-disc list-inside">
          <li><strong>Problem:</strong> Rezepte nutzen „Stk" (z.B. 2 Stk Zwiebel), der Vorrat hat aber Gramm vom Einkauf</li>
          <li><strong>Lösung:</strong> 1 Stk Zwiebel = 80g → System vergleicht automatisch 160g (2×80) mit dem Vorrat</li>
          <li><strong>Wirkt in:</strong> Vorratsschrank (Rezeptansicht), Wochenplan-Planung, Einkaufsliste</li>
        </ul>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="z-50 fixed inset-0 flex justify-center items-center p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal" />
      <div class="relative bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-md animate-slide-up">
        <div class="flex justify-between items-center p-6 border-stone-200 dark:border-stone-800 border-b">
          <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">
            {{ editId ? 'Umrechnung bearbeiten' : 'Neue Umrechnung' }}
          </h2>
          <button @click="closeModal" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1 rounded-lg">
            <X class="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div class="space-y-4 p-6">
          <!-- Zutat -->
          <div>
            <label class="block mb-1.5 font-medium text-stone-700 dark:text-stone-300 text-sm">Zutat</label>
            <input
              v-model="form.ingredient_name"
              type="text"
              placeholder="z.B. Zwiebel"
              class="bg-stone-50 dark:bg-stone-800 px-4 py-2.5 border border-stone-200 dark:border-stone-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-400 w-full text-sm"
            />
          </div>

          <!-- Von-Einheit -->
          <div>
            <label class="block mb-1.5 font-medium text-stone-700 dark:text-stone-300 text-sm">1 × Einheit</label>
            <UnitInput v-model="form.from_unit" placeholder="z.B. Stk" />
          </div>

          <!-- Ergibt -->
          <div class="flex items-end gap-3">
            <div class="flex-1">
              <label class="block mb-1.5 font-medium text-stone-700 dark:text-stone-300 text-sm">Ergibt</label>
              <input
                v-model.number="form.to_amount"
                type="number"
                step="0.1"
                min="0"
                placeholder="z.B. 80"
                class="bg-stone-50 dark:bg-stone-800 px-4 py-2.5 border border-stone-200 dark:border-stone-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-400 w-full text-sm"
              />
            </div>
            <div class="flex-1">
              <label class="block mb-1.5 font-medium text-stone-700 dark:text-stone-300 text-sm">Ziel-Einheit</label>
              <UnitInput v-model="form.to_unit" placeholder="z.B. g" />
            </div>
          </div>

          <!-- Vorschau -->
          <div v-if="form.ingredient_name && form.from_unit && form.to_amount && form.to_unit"
               class="bg-stone-50 dark:bg-stone-800 p-3 rounded-lg text-stone-600 dark:text-stone-300 text-sm text-center">
            1 {{ form.from_unit }} {{ form.ingredient_name }} = {{ form.to_amount }} {{ form.to_unit }}
          </div>
        </div>

        <div class="flex justify-end gap-3 p-6 border-stone-200 dark:border-stone-800 border-t">
          <button @click="closeModal" class="hover:bg-stone-100 dark:hover:bg-stone-800 px-4 py-2 rounded-lg text-stone-600 dark:text-stone-400 text-sm">
            Abbrechen
          </button>
          <button
            @click="saveConversion"
            :disabled="!isFormValid || saving"
            class="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors"
          >
            {{ saving ? 'Speichern...' : 'Speichern' }}
          </button>
        </div>
      </div>
    </div>

    <!-- KI-Vorschläge Modal -->
    <div v-if="showAIModal" class="z-50 fixed inset-0 flex justify-center items-center p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeAIModal" />
      <div class="relative flex flex-col bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-2xl max-h-[80vh] animate-slide-up">
        <div class="flex justify-between items-center p-6 border-stone-200 dark:border-stone-800 border-b shrink-0">
          <div>
            <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">KI-generierte Vorschläge</h2>
            <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
              {{ aiSuggestions.length }} Vorschläge · Prüfe und passe sie an, bevor du speicherst
            </p>
          </div>
          <button @click="closeAIModal" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1 rounded-lg">
            <X class="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div class="flex-1 p-6 min-h-0 overflow-y-auto">
          <!-- Alle/Keine auswählen -->
          <div class="flex items-center gap-3 mb-4">
            <button @click="selectAllSuggestions" class="font-medium text-primary-600 hover:text-primary-700 text-xs">
              Alle auswählen
            </button>
            <span class="text-stone-300">·</span>
            <button @click="deselectAllSuggestions" class="font-medium text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 text-xs">
              Keine auswählen
            </button>
            <span class="ml-auto text-stone-400 text-xs">
              {{ selectedSuggestionCount }} / {{ aiSuggestions.length }} ausgewählt
            </span>
          </div>

          <div class="space-y-2">
            <label
              v-for="(s, idx) in aiSuggestions"
              :key="idx"
              class="flex items-center gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/30 px-3 py-2.5 border border-stone-200 dark:border-stone-700 rounded-lg transition-colors cursor-pointer"
              :class="{ 'ring-2 ring-primary-400 border-primary-300 dark:border-primary-600': s.selected }"
            >
              <input type="checkbox" v-model="s.selected" class="rounded accent-primary-600" />
              <span class="flex-1 text-stone-700 dark:text-stone-300 text-sm">
                <span class="font-medium">{{ s.ingredient_name }}</span>
              </span>
              <span class="bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded text-stone-500 dark:text-stone-400 text-xs">
                1 {{ s.from_unit }}
              </span>
              <span class="text-stone-400 text-xs">→</span>
              <span class="bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded font-mono text-primary-700 dark:text-primary-300 text-xs">
                {{ s.to_amount }} {{ s.to_unit }}
              </span>
            </label>
          </div>

          <div v-if="aiSuggestions.length === 0" class="py-12 text-stone-400 text-sm text-center italic">
            Keine neuen Vorschläge. Alle Zutaten haben bereits Umrechnungen.
          </div>
        </div>

        <div class="flex justify-end gap-3 p-6 border-stone-200 dark:border-stone-800 border-t shrink-0">
          <button @click="closeAIModal" class="hover:bg-stone-100 dark:hover:bg-stone-800 px-4 py-2 rounded-lg text-stone-600 dark:text-stone-400 text-sm">
            Abbrechen
          </button>
          <button
            @click="saveAISuggestions"
            :disabled="selectedSuggestionCount === 0 || savingAI"
            class="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors"
          >
            {{ savingAI ? 'Speichern...' : `${selectedSuggestionCount} übernehmen` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useApi } from '@/composables/useApi.js';
import { useNotification } from '@/composables/useNotification.js';
import UnitInput from '@/components/ui/UnitInput.vue';
import {
  Search, PlusCircle, Pencil, Trash2, X, Info, Sparkles,
} from 'lucide-vue-next';

const api = useApi();
const { showSuccess, showError } = useNotification();

const conversions = ref([]);
const loading = ref(true);
const searchQuery = ref('');

// Add/Edit Modal
const showModal = ref(false);
const editId = ref(null);
const saving = ref(false);
const form = ref({
  ingredient_name: '',
  from_unit: '',
  to_amount: null,
  to_unit: '',
});

// AI Modal
const showAIModal = ref(false);
const generating = ref(false);
const savingAI = ref(false);
const aiSuggestions = ref([]);

const isFormValid = computed(() => {
  return form.value.ingredient_name.trim()
    && form.value.from_unit.trim()
    && form.value.to_amount > 0
    && form.value.to_unit.trim();
});

const filteredConversions = computed(() => {
  if (!searchQuery.value) return conversions.value;
  const q = searchQuery.value.toLowerCase();
  return conversions.value.filter(c =>
    c.ingredient_name.toLowerCase().includes(q)
    || c.from_unit.toLowerCase().includes(q)
    || c.to_unit.toLowerCase().includes(q)
  );
});

const selectedSuggestionCount = computed(() => {
  return aiSuggestions.value.filter(s => s.selected).length;
});

function openAdd() {
  editId.value = null;
  form.value = { ingredient_name: '', from_unit: '', to_amount: null, to_unit: '' };
  showModal.value = true;
}

function openEdit(conv) {
  editId.value = conv.id;
  form.value = {
    ingredient_name: conv.ingredient_name,
    from_unit: conv.from_unit,
    to_amount: conv.to_amount,
    to_unit: conv.to_unit,
  };
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

async function saveConversion() {
  saving.value = true;
  try {
    if (editId.value) {
      await api.put(`/ingredient-conversions/${editId.value}`, form.value);
      showSuccess('Umrechnung aktualisiert ✏️');
    } else {
      await api.post('/ingredient-conversions', form.value);
      showSuccess('Umrechnung erstellt ✨');
    }
    closeModal();
    await fetchConversions();
  } catch {
    // useApi zeigt Fehler
  } finally {
    saving.value = false;
  }
}

async function deleteConversion(conv) {
  if (!confirm(`Umrechnung für „${conv.ingredient_name}" (${conv.from_unit} → ${conv.to_unit}) wirklich löschen?`)) return;
  try {
    await api.del(`/ingredient-conversions/${conv.id}`);
    showSuccess('Umrechnung gelöscht 🗑️');
    await fetchConversions();
  } catch {
    // useApi zeigt Fehler
  }
}

async function startAIGeneration() {
  generating.value = true;
  try {
    const data = await api.post('/ingredient-conversions/generate', {});
    if (data.conversions && data.conversions.length > 0) {
      aiSuggestions.value = data.conversions.map(c => ({ ...c, selected: true }));
      showAIModal.value = true;
    } else {
      showSuccess('Keine neuen Vorschläge – alle Zutaten haben bereits Umrechnungen 👍');
    }
  } catch {
    // useApi zeigt Fehler
  } finally {
    generating.value = false;
  }
}

function selectAllSuggestions() {
  aiSuggestions.value.forEach(s => s.selected = true);
}

function deselectAllSuggestions() {
  aiSuggestions.value.forEach(s => s.selected = false);
}

function closeAIModal() {
  showAIModal.value = false;
  aiSuggestions.value = [];
}

async function saveAISuggestions() {
  const selected = aiSuggestions.value.filter(s => s.selected);
  if (!selected.length) return;

  savingAI.value = true;
  try {
    await api.post('/ingredient-conversions/bulk', {
      conversions: selected.map(({ ingredient_name, from_unit, to_amount, to_unit }) => ({
        ingredient_name,
        from_unit,
        to_amount,
        to_unit,
      })),
    });
    showSuccess(`${selected.length} Umrechnungen gespeichert ✨`);
    closeAIModal();
    await fetchConversions();
  } catch {
    // useApi zeigt Fehler
  } finally {
    savingAI.value = false;
  }
}

async function fetchConversions() {
  loading.value = true;
  try {
    const data = await api.get('/ingredient-conversions');
    conversions.value = data.conversions || [];
  } catch {
    // handled
  } finally {
    loading.value = false;
  }
}

onMounted(fetchConversions);
</script>
