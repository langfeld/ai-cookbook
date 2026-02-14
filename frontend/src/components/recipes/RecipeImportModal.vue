<!--
  ============================================
  RecipeImportModal - Foto-Import Dialog
  ============================================
  Ermöglicht den Import von Rezepten per Foto oder Text.
  Die KI analysiert das Bild und extrahiert das Rezept.
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
        <!-- Tab: Foto / Text -->
        <div class="flex bg-stone-100 dark:bg-stone-800 mb-6 p-1 rounded-lg">
          <button
            @click="importMode = 'photo'"
            :class="tabClass(importMode === 'photo')"
          >
            <Camera class="w-4 h-4" />
            Foto
          </button>
          <button
            @click="importMode = 'text'"
            :class="tabClass(importMode === 'text')"
          >
            <FileText class="w-4 h-4" />
            Text
          </button>
        </div>

        <!-- Foto-Upload -->
        <div v-if="importMode === 'photo'">
          <label
            class="flex flex-col justify-center items-center hover:bg-primary-50/50 dark:hover:bg-primary-950/30 border-2 border-stone-300 hover:border-primary-400 dark:border-stone-600 dark:hover:border-primary-600 border-dashed rounded-xl w-full h-48 transition-colors cursor-pointer"
          >
            <div v-if="!previewUrl" class="text-center">
              <Upload class="mx-auto mb-2 w-10 h-10 text-stone-400" />
              <p class="text-stone-500 text-sm">Klicke oder ziehe ein Foto hierhin</p>
              <p class="mt-1 text-stone-400 text-xs">JPG, PNG, WebP bis 10 MB</p>
            </div>
            <img v-else :src="previewUrl" alt="Vorschau" class="rounded-lg max-w-full max-h-full object-contain" />
            <input type="file" accept="image/*" @change="handleFileSelect" class="hidden" />
          </label>
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
          :disabled="importing || (!selectedFile && importMode === 'photo') || (!importText && importMode === 'text')"
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
import { ref } from 'vue';
import { X, Camera, FileText, Upload, Sparkles } from 'lucide-vue-next';
import { useRecipesStore } from '@/stores/recipes.js';
import { useNotification } from '@/composables/useNotification.js';

const emit = defineEmits(['close', 'imported']);

const recipesStore = useRecipesStore();
const { showError } = useNotification();

const importMode = ref('photo');
const selectedFile = ref(null);
const previewUrl = ref(null);
const importText = ref('');
const importing = ref(false);

function tabClass(active) {
  return [
    'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors',
    active
      ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
      : 'text-stone-500 dark:text-stone-400',
  ];
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
}

async function handleImport() {
  importing.value = true;
  try {
    let result;
    if (importMode.value === 'photo' && selectedFile.value) {
      result = await recipesStore.importFromPhoto(selectedFile.value);
    } else if (importMode.value === 'text' && importText.value) {
      result = await recipesStore.importFromText(importText.value);
    }
    emit('imported', result);
  } catch (err) {
    showError('Import fehlgeschlagen: ' + err.message);
  } finally {
    importing.value = false;
  }
}
</script>
