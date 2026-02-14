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
            </select>
          </div>
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
import { ref, reactive, onMounted } from 'vue';
import { useApi } from '@/composables/useApi.js';
import { useNotification } from '@/composables/useNotification.js';
import {
  Settings as SettingsIcon,
  Tag,
  Wrench,
  RefreshCw,
  Trash2,
} from 'lucide-vue-next';

const api = useApi();
const { showSuccess } = useNotification();

const loading = ref(true);
const settingsMap = reactive({});
const cleanupRunning = ref(false);
const cleanupResult = ref(null);

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
</script>
