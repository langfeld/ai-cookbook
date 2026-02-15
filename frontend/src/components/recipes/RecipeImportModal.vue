<!--
  ============================================
  RecipeImportModal - Import Dialog
  ============================================
  Ermöglicht den Import von Rezepten per Foto, Text oder URL.
  Die KI analysiert die Quelle und extrahiert das Rezept.
-->
<template>
  <div class="z-50 fixed inset-0 flex justify-center items-center p-4">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')" />

    <!-- Modal -->
    <div class="relative bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-lg animate-slide-up">
      <!-- Header -->
      <div class="flex justify-between items-center p-6 border-stone-200 dark:border-stone-800 border-b">
        <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">
          Rezept importieren
        </h2>
        <button @click="$emit('close')" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1 rounded-lg">
          <X class="w-5 h-5 text-stone-400" />
        </button>
      </div>

      <div class="p-6">
        <!-- Tab: Foto / Text / URL -->
        <div class="flex bg-stone-100 dark:bg-stone-800 mb-6 p-1 rounded-lg">
          <button
            @click="importMode = 'photo'"
            :class="tabClass(importMode === 'photo')"
          >
            <Camera class="w-4 h-4" />
            Foto
          </button>
          <button
            @click="importMode = 'url'"
            :class="tabClass(importMode === 'url')"
          >
            <Globe class="w-4 h-4" />
            URL
          </button>
          <button
            @click="importMode = 'text'"
            :class="tabClass(importMode === 'text')"
          >
            <FileText class="w-4 h-4" />
            Text
          </button>
        </div>

        <!-- Foto-Upload (mehrere Seiten möglich) -->
        <div v-if="importMode === 'photo'">
          <label
            class="flex flex-col justify-center items-center hover:bg-primary-50/50 dark:hover:bg-primary-950/30 border-2 border-stone-300 hover:border-primary-400 dark:border-stone-600 dark:hover:border-primary-600 border-dashed rounded-xl w-full min-h-48 transition-colors cursor-pointer"
          >
            <div v-if="selectedFiles.length === 0" class="text-center">
              <Upload class="mx-auto mb-2 w-10 h-10 text-stone-400" />
              <p class="text-stone-500 text-sm">Klicke oder ziehe Fotos hierhin</p>
              <p class="mt-1 text-stone-400 text-xs">Mehrere Seiten möglich · JPG, PNG, WebP bis 10 MB</p>
            </div>
            <div v-else class="flex flex-wrap justify-center gap-3 p-4 w-full">
              <div
                v-for="(preview, idx) in previewUrls"
                :key="idx"
                class="group relative"
              >
                <img :src="preview" :alt="`Seite ${idx + 1}`" class="rounded-lg h-28 object-cover" />
                <span class="top-1 left-1 absolute bg-black/60 px-1.5 py-0.5 rounded font-medium text-white text-xs">
                  {{ idx + 1 }}
                </span>
                <button
                  @click.prevent="removeFile(idx)"
                  class="top-1 right-1 absolute bg-red-500 opacity-0 group-hover:opacity-100 p-0.5 rounded-full text-white transition-opacity"
                >
                  <X class="w-3 h-3" />
                </button>
              </div>
              <div class="flex flex-col justify-center items-center border-2 border-stone-300 dark:border-stone-600 border-dashed rounded-lg w-20 h-28 text-stone-400">
                <Plus class="w-5 h-5" />
                <span class="text-xs">Seite</span>
              </div>
            </div>
            <input type="file" accept="image/*" multiple @change="handleFileSelect" class="hidden" />
          </label>
          <p v-if="selectedFiles.length > 1" class="flex items-center gap-1 mt-2 text-primary-600 dark:text-primary-400 text-xs">
            <ImageIcon class="w-3.5 h-3.5" />
            {{ selectedFiles.length }} Seiten werden als ein Rezept zusammengeführt
          </p>
        </div>

        <!-- URL-Import -->
        <div v-else-if="importMode === 'url'">
          <div class="space-y-3">
            <div>
              <input
                v-model="importUrl"
                type="url"
                placeholder="https://www.chefkoch.de/rezepte/..."
                class="bg-stone-50 dark:bg-stone-800 px-4 py-3 border border-stone-200 focus:border-primary-400 dark:border-stone-700 rounded-xl outline-none focus:ring-1 focus:ring-primary-400 w-full text-stone-700 dark:text-stone-300 text-sm"
                @keydown.enter.prevent="handleImport"
              />
            </div>
            <p class="text-stone-400 dark:text-stone-500 text-xs leading-relaxed">
              Füge einen Link zu einem Rezept ein — z.B. von Chefkoch, Lecker, EatSmarter, Kitchen Stories oder jeder anderen Rezeptseite.
            </p>
          </div>
        </div>

        <!-- Text-Import -->
        <div v-else>
          <textarea
            v-model="importText"
            rows="6"
            placeholder="Beschreibe das Rezept oder füge ein Rezept als Text ein...&#10;&#10;Beispiel: Spaghetti Carbonara für 4 Personen mit Speck, Eiern und Parmesan"
            class="bg-stone-50 dark:bg-stone-800 px-4 py-3 border border-stone-200 focus:border-primary-400 dark:border-stone-700 rounded-xl outline-none focus:ring-1 focus:ring-primary-400 w-full text-stone-700 dark:text-stone-300 text-sm resize-none"
          />
        </div>

        <!-- KI-Hinweis -->
        <div class="flex items-start gap-2 bg-indigo-50 dark:bg-indigo-950/30 mt-4 p-3 border border-indigo-200 dark:border-indigo-800 rounded-lg">
          <Sparkles class="mt-0.5 w-4 h-4 text-indigo-500 shrink-0" />
          <p class="text-indigo-700 dark:text-indigo-300 text-xs">
            Die KI erkennt automatisch Zutaten, Kochschritte, Schwierigkeitsgrad und schlägt passende Kategorien vor.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-end gap-3 p-6 border-stone-200 dark:border-stone-800 border-t">
        <button
          @click="$emit('close')"
          class="hover:bg-stone-100 dark:hover:bg-stone-800 px-4 py-2 rounded-lg font-medium text-stone-600 dark:text-stone-400 text-sm"
        >
          Abbrechen
        </button>
        <button
          @click="handleImport"
          :disabled="importDisabled"
          class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors disabled:cursor-not-allowed"
        >
          <span v-if="importing" class="flex items-center gap-2">
            <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            KI analysiert...
          </span>
          <span v-else>
            <Sparkles class="inline w-4 h-4" />
            Importieren
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { X, Camera, FileText, Globe, Upload, Sparkles, Plus, ImageIcon } from 'lucide-vue-next';
import { useRecipesStore } from '@/stores/recipes.js';

const emit = defineEmits(['close', 'imported']);

const recipesStore = useRecipesStore();

const importMode = ref('photo');
const selectedFiles = ref([]);
const previewUrls = ref([]);
const importText = ref('');
const importUrl = ref('');
const importing = ref(false);

const importDisabled = computed(() => {
  if (importing.value) return true;
  if (importMode.value === 'photo') return selectedFiles.value.length === 0;
  if (importMode.value === 'url') return !importUrl.value || !importUrl.value.startsWith('http');
  if (importMode.value === 'text') return !importText.value;
  return true;
});

function tabClass(active) {
  return [
    'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors',
    active
      ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
      : 'text-stone-500 dark:text-stone-400',
  ];
}

function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  for (const file of files) {
    selectedFiles.value.push(file);
    previewUrls.value.push(URL.createObjectURL(file));
  }
  event.target.value = '';
}

function removeFile(idx) {
  URL.revokeObjectURL(previewUrls.value[idx]);
  selectedFiles.value.splice(idx, 1);
  previewUrls.value.splice(idx, 1);
}

async function handleImport() {
  importing.value = true;
  try {
    let result;
    if (importMode.value === 'photo' && selectedFiles.value.length > 0) {
      result = await recipesStore.importFromPhoto(selectedFiles.value);
    } else if (importMode.value === 'url' && importUrl.value) {
      result = await recipesStore.importFromUrl(importUrl.value);
    } else if (importMode.value === 'text' && importText.value) {
      result = await recipesStore.importFromText(importText.value);
    }
    emit('imported', result);
  } catch {
    // Fehler wird bereits von der API-Schicht (useApi) als Notification angezeigt.
    // Rezeptliste wurde im Store-catch trotzdem aktualisiert,
    // daher Modal schließen — das Rezept ist sehr wahrscheinlich bereits importiert.
    emit('imported', null);
  } finally {
    importing.value = false;
  }
}
</script>
