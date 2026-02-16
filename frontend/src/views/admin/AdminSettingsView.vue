<!--
  ============================================
  Admin Systemeinstellungen
  ============================================
  Globale Konfiguration: Registrierung, KI, Wartungsmodus.
  Beinhaltet auch globale Kategorienverwaltung und Cleanup-Funktion.
-->
<template>
  <div class="mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
    <!-- Header -->
    <div class="mb-6 sm:mb-8">
      <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl sm:text-3xl">
        Systemeinstellungen
      </h1>
      <p class="mt-1 text-stone-500 dark:text-stone-400 text-sm">
        Globale Konfiguration der Anwendung
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 rounded-full w-8 h-8 animate-spin"></div>
    </div>

    <template v-else>
      <!-- Allgemeine Einstellungen -->
      <section class="bg-white dark:bg-stone-800 mb-4 sm:mb-6 p-5 sm:p-6 border border-stone-200 dark:border-stone-700 rounded-xl">
        <h2 class="flex items-center gap-2 mb-5 font-display font-semibold text-stone-800 dark:text-stone-100 text-lg">
          <SettingsIcon class="w-5 h-5 text-stone-400" />
          Allgemein
        </h2>

        <div class="space-y-5">
          <!-- Registrierung -->
          <div class="flex justify-between items-center">
            <div>
              <p class="font-medium text-stone-700 dark:text-stone-200 text-sm">Registrierung erlauben</p>
              <p class="mt-0.5 text-stone-400 dark:text-stone-500 text-xs">Neue Benutzer können sich selbst registrieren</p>
            </div>
            <button
              @click="toggleSetting('registration_enabled')"
              :class="[
                'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer',
                settingsMap.registration_enabled === 'true' ? 'bg-primary-600' : 'bg-stone-300 dark:bg-stone-600'
              ]"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  settingsMap.registration_enabled === 'true' ? 'translate-x-5' : 'translate-x-0'
                ]"
              ></span>
            </button>
          </div>

          <!-- Wartungsmodus -->
          <div class="flex justify-between items-center">
            <div>
              <p class="font-medium text-stone-700 dark:text-stone-200 text-sm">Wartungsmodus</p>
              <p class="mt-0.5 text-stone-400 dark:text-stone-500 text-xs">App ist nur für Admins zugänglich</p>
            </div>
            <button
              @click="toggleSetting('maintenance_mode')"
              :class="[
                'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer',
                settingsMap.maintenance_mode === 'true' ? 'bg-red-600' : 'bg-stone-300 dark:bg-stone-600'
              ]"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  settingsMap.maintenance_mode === 'true' ? 'translate-x-5' : 'translate-x-0'
                ]"
              ></span>
            </button>
          </div>

          <!-- Max Upload-Größe -->
          <div class="flex justify-between items-center gap-4">
            <div>
              <p class="font-medium text-stone-700 dark:text-stone-200 text-sm">Max. Upload-Größe</p>
              <p class="mt-0.5 text-stone-400 dark:text-stone-500 text-xs">Maximale Dateigröße pro Upload in MB</p>
            </div>
            <input
              v-model="settingsMap.max_upload_size"
              type="number"
              min="1"
              max="100"
              class="bg-white dark:bg-stone-900 px-3 py-1.5 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-20 text-stone-800 dark:text-stone-200 text-sm text-center"
              @change="saveSetting('max_upload_size', settingsMap.max_upload_size)"
            />
          </div>

          <!-- AI Provider -->
          <div class="flex justify-between items-center gap-4">
            <div>
              <p class="font-medium text-stone-700 dark:text-stone-200 text-sm">KI-Anbieter</p>
              <p class="mt-0.5 text-stone-400 dark:text-stone-500 text-xs">Aktuell verwendeter KI-Dienst</p>
            </div>
            <select
              v-model="settingsMap.ai_provider"
              class="bg-white dark:bg-stone-900 px-3 py-1.5 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-stone-800 dark:text-stone-200 text-sm"
              @change="saveSetting('ai_provider', settingsMap.ai_provider)"
            >
              <option value="kimi">Kimi K2.5</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">Ollama (Lokal)</option>
            </select>
          </div>
        </div>
      </section>

      <!-- KI-Konfiguration -->
      <section class="bg-white dark:bg-stone-800 mb-4 sm:mb-6 p-5 sm:p-6 border border-stone-200 dark:border-stone-700 rounded-xl">
        <h2 class="flex items-center gap-2 mb-2 font-display font-semibold text-stone-800 dark:text-stone-100 text-lg">
          <BotIcon class="w-5 h-5 text-stone-400" />
          KI-Konfiguration
        </h2>
        <p class="mb-5 text-stone-400 dark:text-stone-500 text-xs">
          API-Schlüssel und Modelle. Änderungen wirken sofort — kein Neustart nötig.
        </p>

        <div class="space-y-5">
          <!-- Kimi -->
          <div v-if="settingsMap.ai_provider === 'kimi'" class="space-y-3">
            <h3 class="font-medium text-primary-600 dark:text-primary-400 text-sm">Kimi / Moonshot AI</h3>
            <SettingsInput label="API-Key" v-model="settingsMap.kimi_api_key" type="password"
              placeholder="sk-..." @save="saveSetting('kimi_api_key', settingsMap.kimi_api_key)" />
            <SettingsInput label="Base-URL" v-model="settingsMap.kimi_base_url"
              placeholder="https://api.moonshot.ai/v1" @save="saveSetting('kimi_base_url', settingsMap.kimi_base_url)" />
            <SettingsInput label="Modell" v-model="settingsMap.kimi_model"
              placeholder="kimi-k2.5" @save="saveSetting('kimi_model', settingsMap.kimi_model)" />
          </div>

          <!-- OpenAI -->
          <div v-if="settingsMap.ai_provider === 'openai'" class="space-y-3">
            <h3 class="font-medium text-primary-600 dark:text-primary-400 text-sm">OpenAI</h3>
            <SettingsInput label="API-Key" v-model="settingsMap.openai_api_key" type="password"
              placeholder="sk-..." @save="saveSetting('openai_api_key', settingsMap.openai_api_key)" />
            <SettingsInput label="Modell" v-model="settingsMap.openai_model"
              placeholder="gpt-4o" @save="saveSetting('openai_model', settingsMap.openai_model)" />
          </div>

          <!-- Anthropic -->
          <div v-if="settingsMap.ai_provider === 'anthropic'" class="space-y-3">
            <h3 class="font-medium text-primary-600 dark:text-primary-400 text-sm">Anthropic</h3>
            <SettingsInput label="API-Key" v-model="settingsMap.anthropic_api_key" type="password"
              placeholder="sk-ant-..." @save="saveSetting('anthropic_api_key', settingsMap.anthropic_api_key)" />
            <SettingsInput label="Modell" v-model="settingsMap.anthropic_model"
              placeholder="claude-sonnet-4-20250514" @save="saveSetting('anthropic_model', settingsMap.anthropic_model)" />
          </div>

          <!-- Ollama -->
          <div v-if="settingsMap.ai_provider === 'ollama'" class="space-y-3">
            <h3 class="font-medium text-primary-600 dark:text-primary-400 text-sm">Ollama (Lokal)</h3>
            <SettingsInput label="Base-URL" v-model="settingsMap.ollama_base_url"
              placeholder="http://localhost:11434" @save="saveSetting('ollama_base_url', settingsMap.ollama_base_url)" />
            <SettingsInput label="Modell" v-model="settingsMap.ollama_model"
              placeholder="llava" @save="saveSetting('ollama_model', settingsMap.ollama_model)" />
          </div>
        </div>
      </section>

      <!-- REWE-Integration -->
      <section class="bg-white dark:bg-stone-800 mb-4 sm:mb-6 p-5 sm:p-6 border border-stone-200 dark:border-stone-700 rounded-xl">
        <h2 class="flex items-center gap-2 mb-2 font-display font-semibold text-stone-800 dark:text-stone-100 text-lg">
          <ShoppingCart class="w-5 h-5 text-stone-400" />
          REWE-Integration
        </h2>
        <p class="mb-5 text-stone-400 dark:text-stone-500 text-xs">
          Produktsuche und Preise aus deinem REWE-Markt.
        </p>

        <div class="space-y-3">
          <SettingsInput label="Markt-ID" v-model="settingsMap.rewe_market_id"
            placeholder="z.B. 1234567" @save="saveSetting('rewe_market_id', settingsMap.rewe_market_id)" />
          <SettingsInput label="Postleitzahl" v-model="settingsMap.rewe_zip_code"
            placeholder="z.B. 50667" @save="saveSetting('rewe_zip_code', settingsMap.rewe_zip_code)" />
        </div>

        <!-- Markt-Finder -->
        <div class="mt-5 pt-5 border-stone-200 dark:border-stone-700 border-t">
          <h3 class="flex items-center gap-2 mb-3 font-medium text-stone-700 dark:text-stone-300 text-sm">
            <MapPin class="w-4 h-4 text-stone-400" />
            Markt-Finder
          </h3>
          <div class="flex gap-2">
            <input
              v-model="marketSearch"
              type="text"
              placeholder="PLZ oder Ort eingeben…"
              @keyup.enter="searchMarkets"
              class="flex-1 bg-stone-50 dark:bg-stone-900 px-3 py-2 border border-stone-300 focus:border-transparent dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-primary-500 text-stone-800 dark:text-stone-200 placeholder:text-stone-400 text-sm"
            />
            <button
              @click="searchMarkets"
              :disabled="!marketSearch.trim() || marketSearchLoading"
              class="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors"
            >
              <Search class="w-4 h-4" />
              {{ marketSearchLoading ? 'Suche…' : 'Suchen' }}
            </button>
          </div>

          <!-- Suchergebnisse -->
          <div v-if="marketResults.length" class="space-y-1.5 mt-3 max-h-72 overflow-y-auto">
            <button
              v-for="market in marketResults"
              :key="market.id"
              @click="selectMarket(market)"
              :class="[
                'w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm',
                settingsMap.rewe_market_id === String(market.id)
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 ring-1 ring-red-300 dark:ring-red-700'
                  : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 hover:border-red-300 dark:hover:border-red-600'
              ]"
            >
              <div class="flex justify-between items-start gap-2">
                <div class="min-w-0">
                  <span class="font-medium text-stone-800 dark:text-stone-200">{{ market.name }}</span>
                  <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                    {{ market.street }}, {{ market.zipCode }} {{ market.city }}
                  </p>
                </div>
                <div class="flex flex-col items-end gap-0.5 shrink-0">
                  <span class="bg-stone-200 dark:bg-stone-700 px-2 py-0.5 rounded font-mono text-[10px] text-stone-500 dark:text-stone-400">
                    ID: {{ market.id }}
                  </span>
                  <span v-if="market.distance != null" class="text-[10px] text-stone-400 dark:text-stone-500">
                    {{ market.distance >= 1000 ? (market.distance / 1000).toFixed(1) + ' km' : market.distance + ' m' }}
                  </span>
                </div>
              </div>
            </button>
          </div>

          <!-- Keine Ergebnisse -->
          <p v-if="marketSearchError" class="mt-3 text-amber-600 dark:text-amber-400 text-xs">
            {{ marketSearchError }}
          </p>
        </div>
      </section>

      <!-- Kategorienverwaltung -->
      <section class="bg-white dark:bg-stone-800 mb-4 sm:mb-6 p-5 sm:p-6 border border-stone-200 dark:border-stone-700 rounded-xl">
        <h2 class="flex items-center gap-2 mb-5 font-display font-semibold text-stone-800 dark:text-stone-100 text-lg">
          <Tag class="w-5 h-5 text-stone-400" />
          Standard-Kategorien
        </h2>
        <p class="mb-4 text-stone-500 dark:text-stone-400 text-sm">
          Diese Kategorien werden automatisch für neue Benutzer erstellt.
          Kategorien einzelner Benutzer können über deren Rezepte verwaltet werden.
        </p>

        <div class="flex flex-wrap gap-2 mb-4">
          <span
            v-for="cat in defaultCategories"
            :key="cat"
            class="inline-flex items-center gap-1 bg-primary-50 dark:bg-primary-900/30 px-3 py-1 rounded-full text-primary-700 dark:text-primary-300 text-sm"
          >
            {{ cat }}
          </span>
        </div>
        <p class="text-stone-400 dark:text-stone-500 text-xs italic">
          Die Standard-Kategorien werden in der Datenbank-Initialisierung definiert und können dort geändert werden.
        </p>
      </section>

      <!-- Wartung & Bereinigung -->
      <section class="bg-white dark:bg-stone-800 p-5 sm:p-6 border border-stone-200 dark:border-stone-700 rounded-xl">
        <h2 class="flex items-center gap-2 mb-5 font-display font-semibold text-stone-800 dark:text-stone-100 text-lg">
          <Wrench class="w-5 h-5 text-stone-400" />
          Wartung
        </h2>

        <div class="space-y-4">
          <!-- Verwaiste Dateien bereinigen -->
          <div class="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-3 bg-stone-50 dark:bg-stone-700/30 p-4 rounded-lg">
            <div>
              <p class="font-medium text-stone-700 dark:text-stone-200 text-sm">Verwaiste Dateien bereinigen</p>
              <p class="mt-0.5 text-stone-400 dark:text-stone-500 text-xs">
                Upload-Dateien entfernen, die keinem Rezept mehr zugeordnet sind
              </p>
            </div>
            <button
              @click="runCleanup"
              :disabled="cleanupRunning"
              class="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 px-4 py-2 rounded-lg text-white text-sm transition-colors disabled:cursor-not-allowed shrink-0"
            >
              <RefreshCw v-if="cleanupRunning" class="w-4 h-4 animate-spin" />
              <Trash2 v-else class="w-4 h-4" />
              {{ cleanupRunning ? 'Läuft...' : 'Bereinigen' }}
            </button>
          </div>

          <!-- Letzte Bereinigung -->
          <div v-if="cleanupResult" class="bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800 rounded-lg">
            <p class="text-green-700 dark:text-green-300 text-sm">
              ✅ {{ cleanupResult.deleted }} verwaiste Datei(en) entfernt.
            </p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, h } from 'vue';
import { useApi } from '@/composables/useApi.js';
import { useNotification } from '@/composables/useNotification.js';
import {
  Settings as SettingsIcon,
  Tag,
  Wrench,
  RefreshCw,
  Trash2,
  Bot as BotIcon,
  ShoppingCart,
  Eye,
  EyeOff,
  MapPin,
  Search,
} from 'lucide-vue-next';

const api = useApi();
const { showSuccess } = useNotification();

const loading = ref(true);
const settingsMap = reactive({});
const cleanupRunning = ref(false);
const cleanupResult = ref(null);

// Markt-Finder
const marketSearch = ref('');
const marketResults = ref([]);
const marketSearchLoading = ref(false);
const marketSearchError = ref('');

const defaultCategories = [
  'Frühstück', 'Mittagessen', 'Abendessen', 'Snacks',
  'Desserts', 'Getränke', 'Backen', 'Vegan',
  'Vegetarisch', 'Low Carb', 'Schnell & Einfach',
];

async function loadSettings() {
  try {
    const data = await api.get('/admin/settings');
    const settings = data.settings || data;
    // Array -> Map
    if (Array.isArray(settings)) {
      settings.forEach(s => {
        settingsMap[s.key] = s.value;
      });
    } else {
      Object.assign(settingsMap, settings);
    }
  } catch {
    // Fehler von useApi gehandelt
  } finally {
    loading.value = false;
  }
}

function toggleSetting(key) {
  const newValue = settingsMap[key] === 'true' ? 'false' : 'true';
  settingsMap[key] = newValue;
  saveSetting(key, newValue);
}

async function saveSetting(key, value) {
  try {
    await api.put('/admin/settings', {
      settings: { [key]: String(value) },
    });
    showSuccess('Einstellung gespeichert.');
  } catch {
    // Fehler von useApi gehandelt
  }
}

async function searchMarkets() {
  const q = marketSearch.value.trim();
  if (!q) return;
  marketSearchLoading.value = true;
  marketSearchError.value = '';
  marketResults.value = [];
  try {
    const data = await api.get(`/rewe/markets?search=${encodeURIComponent(q)}`);
    if (data.markets?.length) {
      marketResults.value = data.markets;
    } else {
      marketSearchError.value = data.error || 'Keine Märkte gefunden. Versuche eine andere PLZ.';
    }
  } catch {
    marketSearchError.value = 'Suche fehlgeschlagen. Bitte versuche es erneut.';
  } finally {
    marketSearchLoading.value = false;
  }
}

async function selectMarket(market) {
  settingsMap.rewe_market_id = String(market.id);
  if (market.zipCode) {
    settingsMap.rewe_zip_code = market.zipCode;
  }
  await saveSetting('rewe_market_id', market.id);
  if (market.zipCode) {
    await saveSetting('rewe_zip_code', market.zipCode);
  }
  showSuccess(`${market.name} ausgewählt (ID: ${market.id})`);
}

async function runCleanup() {
  cleanupRunning.value = true;
  cleanupResult.value = null;
  try {
    const result = await api.post('/admin/cleanup');
    cleanupResult.value = result;
    showSuccess(`Bereinigung abgeschlossen: ${result.deleted} Datei(en) entfernt.`);
  } catch {
    // Fehler von useApi gehandelt
  } finally {
    cleanupRunning.value = false;
  }
}

onMounted(loadSettings);

// ============================================
// SettingsInput — Inline-Komponente für Einstellungsfelder
// ============================================
const SettingsInput = {
  props: {
    label: String,
    modelValue: { type: String, default: '' },
    type: { type: String, default: 'text' },
    placeholder: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'save'],
  setup(props, { emit }) {
    const showPassword = ref(false);
    const inputType = ref(props.type);

    function toggleVisibility() {
      showPassword.value = !showPassword.value;
      inputType.value = showPassword.value ? 'text' : 'password';
    }

    let debounceTimer = null;
    function onInput(e) {
      emit('update:modelValue', e.target.value);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => emit('save'), 800);
    }

    return () => {
      const isPassword = props.type === 'password';
      return h('div', { class: 'flex sm:flex-row flex-col sm:justify-between sm:items-center gap-2' }, [
        h('label', { class: 'font-medium text-stone-600 dark:text-stone-300 text-sm shrink-0 w-28' }, props.label),
        h('div', { class: 'relative flex-1' }, [
          h('input', {
            type: isPassword ? inputType.value : 'text',
            value: props.modelValue || '',
            placeholder: props.placeholder,
            class: 'bg-white dark:bg-stone-900 px-3 py-1.5 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-full text-stone-800 dark:text-stone-200 text-sm' + (isPassword ? ' pr-10' : ''),
            onInput,
          }),
          isPassword ? h('button', {
            type: 'button',
            class: 'top-1/2 right-2.5 absolute text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 -translate-y-1/2',
            onClick: toggleVisibility,
          }, [h(showPassword.value ? EyeOff : Eye, { class: 'w-4 h-4' })]) : null,
        ]),
      ]);
    };
  },
};
</script>
