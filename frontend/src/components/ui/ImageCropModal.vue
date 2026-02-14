<!--
  ============================================
  ImageCropModal - Bildzuschnitt
  ============================================
  Modal zum Zuschneiden von Rezeptbildern.
  Unterstützt verschiedene Seitenverhältnisse:
  - 4:3 (Rezeptkarte)
  - 1:1 (Quadrat/Thumbnail)
  - 16:9 (Banner)
  - Frei (beliebig)
-->
<template>
  <Teleport to="body">
    <div class="z-50 fixed inset-0 flex justify-center items-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="$emit('cancel')" />

      <!-- Modal -->
      <div class="relative flex flex-col bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slide-up">
        <!-- Header -->
        <div class="flex justify-between items-center px-5 py-4 border-stone-200 dark:border-stone-800 border-b shrink-0">
          <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">
            ✂️ Bild zuschneiden
          </h2>
          <button @click="$emit('cancel')" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg transition-colors">
            <X class="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <!-- Seitenverhältnis-Auswahl -->
        <div class="flex items-center gap-2 px-5 py-3 border-stone-200 dark:border-stone-800 border-b overflow-x-auto shrink-0">
          <span class="text-stone-500 dark:text-stone-400 text-xs shrink-0">Format:</span>
          <button
            v-for="ratio in aspectRatios"
            :key="ratio.label"
            type="button"
            @click="setAspectRatio(ratio)"
            :class="[
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border',
              activeRatio === ratio.label
                ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-400 dark:hover:border-stone-500'
            ]"
          >
            {{ ratio.icon }} {{ ratio.label }}
          </button>
        </div>

        <!-- Cropper -->
        <div class="relative flex-1 bg-stone-950 min-h-0">
          <Cropper
            ref="cropperRef"
            class="cropper"
            :src="imageSrc"
            :stencil-props="stencilProps"
            :default-size="defaultSize"
            image-restriction="stencil"
            :canvas="{
              maxWidth: 2048,
              maxHeight: 2048,
            }"
          />
        </div>

        <!-- Footer mit Aktionen -->
        <div class="flex justify-between items-center gap-3 px-5 py-4 border-stone-200 dark:border-stone-800 border-t shrink-0">
          <!-- Drehen-Buttons -->
          <div class="flex gap-1">
            <button
              type="button"
              @click="rotate(-90)"
              class="flex items-center gap-1 hover:bg-stone-100 dark:hover:bg-stone-800 px-3 py-2 rounded-lg text-stone-600 dark:text-stone-400 text-xs transition-colors"
              title="90° nach links drehen"
            >
              <RotateCcw class="w-4 h-4" />
            </button>
            <button
              type="button"
              @click="rotate(90)"
              class="flex items-center gap-1 hover:bg-stone-100 dark:hover:bg-stone-800 px-3 py-2 rounded-lg text-stone-600 dark:text-stone-400 text-xs transition-colors"
              title="90° nach rechts drehen"
            >
              <RotateCw class="w-4 h-4" />
            </button>
          </div>

          <!-- Hauptaktionen -->
          <div class="flex gap-2">
            <button
              type="button"
              @click="$emit('cancel')"
              class="hover:bg-stone-100 dark:hover:bg-stone-800 px-4 py-2 rounded-lg text-stone-600 dark:text-stone-400 text-sm transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              @click="applyCrop"
              class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 px-5 py-2 rounded-lg font-medium text-white text-sm transition-colors"
            >
              <Crop class="w-4 h-4" />
              Zuschneiden
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * Props:
 *   imageSrc  – Object-URL oder Base64 des Quellbilds
 *   fileName  – Originaler Dateiname (für Blob-Erstellung)
 *
 * Emits:
 *   cropped(file: File, previewUrl: string) – zugeschnittenes Bild
 *   cancel – Modal schließen ohne Änderung
 */
import { ref, computed } from 'vue';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import { X, RotateCcw, RotateCw, Crop } from 'lucide-vue-next';

const props = defineProps({
  imageSrc: { type: String, required: true },
  fileName: { type: String, default: 'recipe.jpg' },
});

const emit = defineEmits(['cropped', 'cancel']);

const cropperRef = ref(null);
const activeRatio = ref('4:3');

// Verfügbare Seitenverhältnisse
const aspectRatios = [
  { label: '4:3',  icon: '🖼️', value: 4 / 3 },
  { label: '1:1',  icon: '⬜', value: 1 },
  { label: '16:9', icon: '🎬', value: 16 / 9 },
  { label: 'Frei', icon: '✏️', value: null },
];

// Stencil-Konfiguration basierend auf aktivem Ratio
const stencilProps = computed(() => {
  const ratio = aspectRatios.find(r => r.label === activeRatio.value);
  if (!ratio || ratio.value === null) {
    return { aspectRatio: undefined };
  }
  return { aspectRatio: ratio.value };
});

function defaultSize({ imageSize }) {
  return {
    width: Math.min(imageSize.width, imageSize.height * (4 / 3)),
    height: Math.min(imageSize.height, imageSize.width / (4 / 3)),
  };
}

function setAspectRatio(ratio) {
  activeRatio.value = ratio.label;
}

function rotate(degrees) {
  if (cropperRef.value) {
    cropperRef.value.rotate(degrees);
  }
}

function applyCrop() {
  if (!cropperRef.value) return;

  const { canvas } = cropperRef.value.getResult();
  if (!canvas) return;

  canvas.toBlob((blob) => {
    if (!blob) return;

    // Dateinamen mit .webp Endung erzeugen (Backend konvertiert ohnehin)
    const baseName = props.fileName.replace(/\.[^.]+$/, '');
    const file = new File([blob], `${baseName}-cropped.jpg`, {
      type: 'image/jpeg',
    });

    const previewUrl = URL.createObjectURL(blob);
    emit('cropped', file, previewUrl);
  }, 'image/jpeg', 0.92);
}
</script>

<style scoped>
.cropper {
  height: 100%;
  min-height: 300px;
  max-height: 60vh;
}

/* Cropper-Overlay-Farben anpassen */
:deep(.vue-advanced-cropper__background) {
  background-color: var(--color-stone-950);
}

:deep(.vue-advanced-cropper__foreground) {
  background-color: var(--color-stone-950);
}
</style>
