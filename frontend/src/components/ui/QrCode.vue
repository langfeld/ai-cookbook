<!--
  QR-Code Komponente
  Generiert einen QR-Code als Canvas-Element.
  Props: value (String), size (Number, px)
-->
<template>
  <div class="inline-flex flex-col items-center gap-2">
    <canvas ref="canvasRef" class="rounded-lg" />
    <slot />
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import QRCode from 'qrcode';

const props = defineProps({
  value: { type: String, required: true },
  size: { type: Number, default: 200 },
  dark: { type: String, default: '#1c1917' },
  light: { type: String, default: '#ffffff' },
});

const canvasRef = ref(null);

async function renderQR() {
  if (!canvasRef.value || !props.value) return;
  try {
    await QRCode.toCanvas(canvasRef.value, props.value, {
      width: props.size,
      margin: 2,
      color: {
        dark: props.dark,
        light: props.light,
      },
    });
  } catch {
    // QR-Code konnte nicht generiert werden
  }
}

onMounted(renderQR);
watch(() => [props.value, props.size], renderQR);
</script>
