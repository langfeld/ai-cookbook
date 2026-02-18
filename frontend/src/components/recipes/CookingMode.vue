<!--
  ============================================
  CookingMode – Vollbild-Kochmodus
  ============================================
  Optimiert für Tablet/Smartphone in der Küche:
  - Swipe zwischen Schritten
  - Optionaler Timer pro Schritt (persistent)
  - Zutatenliste (Overlay auf Mobile, Sidebar auf Tablet)
  - Display-Wakelock (Bildschirm bleibt an)
  - Große, leserliche Typografie
  - Zutaten im Text hervorgehoben
-->
<template>
  <Teleport to="body">
    <Transition name="cooking-mode">
      <div
        v-if="modelValue"
        class="z-100 fixed inset-0 flex flex-col bg-white dark:bg-stone-950 text-stone-800 dark:text-white select-none cooking-mode-view"
        @touchstart="onTouchStart"
        @touchend="onTouchEnd"
      >
        <!-- ═══ Top-Bar ═══ -->
        <div class="flex justify-between items-center px-4 sm:px-6 py-3 border-stone-200 dark:border-stone-800 border-b shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <button @click="close" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-xl transition-colors shrink-0" title="Schließen">
              <X class="w-5 h-5" />
            </button>
            <h2 class="font-semibold text-sm sm:text-base truncate">{{ recipe.title }}</h2>
          </div>
          <div class="flex items-center gap-1 sm:gap-2 shrink-0">
            <!-- Timer-Toggle -->
            <button
              @click="toggleTimerEnabled"
              :class="[
                'p-2 rounded-xl transition-colors',
                timerEnabled ? 'bg-primary-600 text-white' : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 dark:text-stone-500'
              ]"
              :title="timerEnabled ? 'Timer deaktivieren' : 'Timer aktivieren'"
            >
              <Timer class="w-5 h-5" />
            </button>
            <!-- Zutaten-Toggle -->
            <button
              @click="showIngredients = !showIngredients"
              :class="[
                'p-2 rounded-xl transition-colors',
                showIngredients ? 'bg-primary-600 text-white' : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 dark:text-stone-500'
              ]"
              title="Zutaten anzeigen"
            >
              <UtensilsCrossed class="w-5 h-5" />
            </button>
            <!-- Wakelock-Toggle -->
            <button
              @click="toggleWakeLock"
              :class="[
                'p-2 rounded-xl transition-colors',
                wakeLockActive ? 'bg-amber-500 text-white' : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 dark:text-stone-500'
              ]"
              :title="wakeLockActive ? 'Bildschirm darf ausgehen' : 'Bildschirm anlassen'"
            >
              <Sun v-if="wakeLockActive" class="w-5 h-5" />
              <Moon v-else class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- ═══ Fortschrittsbalken ═══ -->
        <div class="bg-stone-200 dark:bg-stone-800 h-1 shrink-0">
          <div
            class="bg-primary-500 h-full transition-all duration-300"
            :style="{ width: progressPercent + '%' }"
          />
        </div>

        <!-- ═══ Hauptbereich ═══ -->
        <div class="relative flex flex-1 min-h-0 overflow-hidden">

          <!-- Zutaten-Panel -->
          <Transition :name="isMobile ? 'slide-overlay' : 'slide-sidebar'">
            <div
              v-if="showIngredients"
              :class="[
                'bg-white dark:bg-stone-900 overflow-y-auto shrink-0 z-20',
                isMobile
                  ? 'absolute inset-0'
                  : 'border-r border-stone-200 dark:border-stone-800 w-72 sm:w-80'
              ]"
            >
              <div class="p-5 sm:p-6">
                <div class="flex justify-between items-center mb-4">
                  <h3 class="flex items-center gap-2 font-semibold text-stone-700 dark:text-stone-200 text-base">
                    🥕 Zutaten
                    <span class="font-normal text-stone-400 dark:text-stone-500 text-sm">({{ adjustedServings }} Port.)</span>
                  </h3>
                  <!-- Schließen auf Mobile -->
                  <button
                    v-if="isMobile"
                    @click="showIngredients = false"
                    class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-xl transition-colors"
                  >
                    <X class="w-5 h-5 text-stone-400" />
                  </button>
                </div>

                <!-- Aktueller Schritt Zutaten -->
                <div v-if="currentStepIngredients.length" class="mb-5">
                  <p class="mb-2.5 font-semibold text-primary-600 dark:text-primary-400 text-xs uppercase tracking-wider">Für diesen Schritt</p>
                  <ul class="space-y-2">
                    <li
                      v-for="ing in currentStepIngredients"
                      :key="ing.id"
                      class="flex items-center gap-2.5 text-base cursor-pointer"
                      :class="checkedIngredients.has(ing.id) ? 'text-stone-400 dark:text-stone-600 line-through' : 'text-stone-800 dark:text-stone-100'"
                      @click="toggleIngredientCheck(ing.id)"
                    >
                      <div :class="[
                        'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                        checkedIngredients.has(ing.id)
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-stone-300 dark:border-stone-600'
                      ]">
                        <Check v-if="checkedIngredients.has(ing.id)" class="w-3.5 h-3.5" />
                      </div>
                      <span class="w-18 font-semibold tabular-nums text-right shrink-0">{{ scaleAmount(ing.amount) }} {{ ing.unit }}</span>
                      <span>
                        <span v-if="getEmoji(ing.name)" class="mr-1">{{ getEmoji(ing.name) }}</span>
                        {{ ing.name }}
                      </span>
                    </li>
                  </ul>
                </div>

                <!-- Alle Zutaten -->
                <div>
                  <p v-if="currentStepIngredients.length" class="mb-2.5 font-semibold text-stone-400 dark:text-stone-500 text-xs uppercase tracking-wider">Alle Zutaten</p>
                  <ul class="space-y-2">
                    <li
                      v-for="ing in allIngredients"
                      :key="'all-' + ing.id"
                      class="flex items-center gap-2.5 text-base cursor-pointer"
                      :class="checkedIngredients.has(ing.id) ? 'text-stone-400 dark:text-stone-600 line-through' : 'text-stone-600 dark:text-stone-300'"
                      @click="toggleIngredientCheck(ing.id)"
                    >
                      <div :class="[
                        'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                        checkedIngredients.has(ing.id)
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-stone-300 dark:border-stone-700'
                      ]">
                        <Check v-if="checkedIngredients.has(ing.id)" class="w-3.5 h-3.5" />
                      </div>
                      <span class="w-18 font-semibold tabular-nums text-right shrink-0">{{ scaleAmount(ing.amount) }} {{ ing.unit }}</span>
                      <span>
                        <span v-if="getEmoji(ing.name)" class="mr-1">{{ getEmoji(ing.name) }}</span>
                        {{ ing.name }}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </Transition>

          <!-- Schritt-Inhalt -->
          <div class="flex flex-col flex-1 justify-center items-center px-6 sm:px-12 lg:px-20 py-6 sm:py-8 min-w-0 overflow-y-auto">
            <!-- Schritt-Nummer -->
            <div class="mb-4 sm:mb-6 text-center">
              <span class="text-stone-400 dark:text-stone-500 text-sm sm:text-base tracking-wide">Schritt</span>
              <div class="font-display font-bold text-primary-500 dark:text-primary-400 text-5xl sm:text-6xl">
                {{ currentStep.step_number }}
                <span class="font-normal text-stone-300 dark:text-stone-600 text-3xl sm:text-4xl">/ {{ steps.length }}</span>
              </div>
            </div>

            <!-- Schritt-Titel -->
            <h3 v-if="currentStep.title" class="mb-4 sm:mb-5 font-semibold text-stone-700 dark:text-stone-200 text-xl sm:text-2xl lg:text-3xl text-center">
              {{ currentStep.title }}
            </h3>

            <!-- Anweisung (mit hervorgehobenen Zutaten) -->
            <p
              class="max-w-2xl text-stone-600 dark:text-stone-300 text-lg sm:text-xl lg:text-2xl text-center leading-relaxed sm:leading-relaxed lg:leading-relaxed"
              v-html="highlightedInstruction"
            />

            <!-- Timer (nur wenn aktiviert) -->
            <div v-if="timerEnabled && currentStep.duration_minutes" class="mt-6 sm:mt-8">
              <div v-if="!timerRunning && timerRemaining === null" class="text-center">
                <button
                  @click="startTimer(currentStep.duration_minutes)"
                  class="inline-flex items-center gap-3 bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-600/20 dark:shadow-primary-900/30 px-6 py-3 rounded-2xl font-medium text-white text-lg sm:text-xl transition-colors"
                >
                  <Timer class="w-6 h-6" />
                  Timer starten · {{ currentStep.duration_minutes }} Min.
                </button>
              </div>
              <div v-else class="text-center">
                <div
                  :class="[
                    'text-5xl sm:text-7xl font-mono font-bold tabular-nums',
                    timerRemaining <= 10 ? 'text-red-500 dark:text-red-400 animate-pulse' : 'text-primary-600 dark:text-primary-400'
                  ]"
                >
                  {{ formatTimer(timerRemaining) }}
                </div>
                <div class="flex justify-center gap-3 mt-4">
                  <button
                    v-if="timerRunning"
                    @click="pauseTimer"
                    class="hover:bg-stone-100 dark:hover:bg-stone-800 px-5 py-2.5 border border-stone-300 dark:border-stone-600 rounded-xl text-stone-600 dark:text-stone-300 text-sm sm:text-base transition-colors"
                  >
                    Pause
                  </button>
                  <button
                    v-else
                    @click="resumeTimer"
                    class="bg-primary-600 hover:bg-primary-700 px-5 py-2.5 rounded-xl text-white text-sm sm:text-base transition-colors"
                  >
                    Fortsetzen
                  </button>
                  <button
                    @click="resetTimer"
                    class="hover:bg-stone-100 dark:hover:bg-stone-800 px-5 py-2.5 border border-stone-300 dark:border-stone-600 rounded-xl text-stone-500 dark:text-stone-400 text-sm sm:text-base transition-colors"
                  >
                    Zurücksetzen
                  </button>
                </div>
              </div>
            </div>

            <!-- Swipe-Hinweis -->
            <p class="mt-auto pt-6 text-stone-300 dark:text-stone-700 text-xs sm:text-sm tracking-wide">
              ← Wischen oder Pfeiltasten zum Navigieren →
            </p>
          </div>
        </div>

        <!-- ═══ Bottom-Navigation ═══ -->
        <div class="flex justify-between items-center gap-4 px-4 sm:px-6 py-3 border-stone-200 dark:border-stone-800 border-t shrink-0">
          <button
            @click="prevStep"
            :disabled="currentIndex === 0"
            class="flex items-center gap-1.5 sm:gap-2 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 px-3 sm:px-4 py-2.5 rounded-xl font-medium text-sm sm:text-base transition-colors disabled:cursor-not-allowed"
          >
            <ChevronLeft class="w-5 h-5" />
            Zurück
          </button>

          <!-- Schritt-Punkte -->
          <div class="flex gap-1.5 overflow-x-auto">
            <button
              v-for="(step, idx) in steps"
              :key="step.id"
              @click="goToStep(idx)"
              :class="[
                'w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all shrink-0',
                idx === currentIndex
                  ? 'bg-primary-500 scale-125'
                  : idx < currentIndex
                    ? 'bg-primary-300 dark:bg-primary-700'
                    : 'bg-stone-300 dark:bg-stone-700 hover:bg-stone-400 dark:hover:bg-stone-600'
              ]"
              :title="`Schritt ${idx + 1}`"
            />
          </div>

          <button
            v-if="currentIndex < steps.length - 1"
            @click="nextStep"
            class="flex items-center gap-1.5 sm:gap-2 bg-primary-600 hover:bg-primary-700 px-3 sm:px-4 py-2.5 rounded-xl font-medium text-white text-sm sm:text-base transition-colors"
          >
            Weiter
            <ChevronRight class="w-5 h-5" />
          </button>
          <button
            v-else
            @click="finish"
            class="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl font-medium text-white text-sm sm:text-base transition-colors bg-accent-600 hover:bg-accent-700"
          >
            <ChefHat class="w-5 h-5" />
            Fertig!
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  X, ChevronLeft, ChevronRight, Check, Timer,
  Sun, Moon, UtensilsCrossed, ChefHat,
} from 'lucide-vue-next';
import { useIngredientIcons } from '@/composables/useIngredientIcons';

const TIMER_STORAGE_KEY = 'cooking-mode-timer-enabled';

const { loadIcons, getEmoji } = useIngredientIcons();

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  recipe: { type: Object, required: true },
  adjustedServings: { type: Number, default: 4 },
});

const emit = defineEmits(['update:modelValue', 'finished']);

// ─── State ───
const currentIndex = ref(0);
const showIngredients = ref(false);
const checkedIngredients = ref(new Set());
const wakeLockActive = ref(false);
const isMobile = ref(false);
let wakeLockSentinel = null;

// Timer
const timerEnabled = ref(loadTimerPref());
const timerRemaining = ref(null);
const timerRunning = ref(false);
let timerInterval = null;

// Touch/Swipe
let touchStartX = 0;
let touchStartY = 0;

// ─── Persistent Timer-Einstellung ───
function loadTimerPref() {
  try { return localStorage.getItem(TIMER_STORAGE_KEY) !== 'false'; } catch { return true; }
}

function toggleTimerEnabled() {
  timerEnabled.value = !timerEnabled.value;
  try { localStorage.setItem(TIMER_STORAGE_KEY, String(timerEnabled.value)); } catch { /* noop */ }
  if (!timerEnabled.value) resetTimer();
}

// ─── Computed ───
const steps = computed(() => props.recipe?.steps || []);
const currentStep = computed(() => steps.value[currentIndex.value] || {});
const progressPercent = computed(() =>
  steps.value.length ? ((currentIndex.value + 1) / steps.value.length) * 100 : 0
);

const allIngredients = computed(() => props.recipe?.ingredients || []);

// Zutaten, die zum aktuellen Schritt gehören (über group_name ↔ step title)
const currentStepIngredients = computed(() => {
  const step = currentStep.value;
  if (!step?.title) return [];
  return allIngredients.value.filter(
    i => i.group_name && i.group_name.toLowerCase() === step.title.toLowerCase()
  );
});

// Zutaten-Namen für Highlighting (längste zuerst, damit "Rote Zwiebel" vor "Zwiebel" matcht)
const ingredientNames = computed(() => {
  return allIngredients.value
    .map(i => i.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
});

// Anweisungstext mit hervorgehobenen Zutaten
const highlightedInstruction = computed(() => {
  const text = currentStep.value?.instruction || '';
  if (!text || !ingredientNames.value.length) return escapeHtml(text);

  // Zuerst escapen, dann Highlights einfügen
  const escaped = ingredientNames.value.map(n =>
    escapeHtml(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );

  // Map für Emoji-Lookup (escaped → original)
  const nameMap = new Map();
  ingredientNames.value.forEach((n, i) => nameMap.set(escaped[i].toLowerCase(), n));

  // \b = Word Boundary, damit "Salz" nicht in "gesalzenes" matcht
  const re = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

  return escapeHtml(text).replace(re, (match) => {
    const emoji = getEmoji(nameMap.get(match.toLowerCase()) || match);
    const prefix = emoji ? emoji + '\u00A0' : '';
    return `<mark class="cooking-highlight">${prefix}${match}</mark>`;
  });
});

function escapeHtml(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

// ─── Responsive ───
function checkMobile() {
  isMobile.value = window.innerWidth < 640;
}

// ─── Navigation ───
function prevStep() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    resetTimer();
  }
}

function nextStep() {
  if (currentIndex.value < steps.value.length - 1) {
    currentIndex.value++;
    resetTimer();
  }
}

function goToStep(idx) {
  currentIndex.value = idx;
  resetTimer();
}

function close() {
  resetTimer();
  releaseWakeLock();
  emit('update:modelValue', false);
}

function finish() {
  resetTimer();
  releaseWakeLock();
  emit('finished');
  emit('update:modelValue', false);
}

// ─── Portionsrechner ───
function scaleAmount(amount) {
  if (!amount || !props.recipe?.servings) return '';
  const scaled = (amount / props.recipe.servings) * props.adjustedServings;
  return Math.round(scaled * 100) / 100;
}

// ─── Zutaten-Checkbox ───
function toggleIngredientCheck(id) {
  const s = new Set(checkedIngredients.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  checkedIngredients.value = s;
}

// ─── Timer ───
function startTimer(minutes) {
  timerRemaining.value = minutes * 60;
  timerRunning.value = true;
  timerInterval = setInterval(() => {
    if (timerRemaining.value <= 0) {
      clearInterval(timerInterval);
      timerRunning.value = false;
      timerAlarm();
      return;
    }
    timerRemaining.value--;
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerRunning.value = false;
}

function resumeTimer() {
  if (timerRemaining.value === null || timerRemaining.value <= 0) return;
  timerRunning.value = true;
  timerInterval = setInterval(() => {
    if (timerRemaining.value <= 0) {
      clearInterval(timerInterval);
      timerRunning.value = false;
      timerAlarm();
      return;
    }
    timerRemaining.value--;
  }, 1000);
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning.value = false;
  timerRemaining.value = null;
}

function formatTimer(seconds) {
  if (seconds === null) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timerAlarm() {
  if ('vibrate' in navigator) {
    navigator.vibrate([300, 100, 300, 100, 300]);
  }
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start(ctx.currentTime + i * 0.4);
      osc.stop(ctx.currentTime + i * 0.4 + 0.2);
    }
  } catch {
    // Audio nicht verfügbar
  }
}

// ─── Wake Lock ───
async function toggleWakeLock() {
  if (wakeLockActive.value) {
    releaseWakeLock();
  } else {
    await requestWakeLock();
  }
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      wakeLockActive.value = true;
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockActive.value = false;
      });
    }
  } catch {
    // Wake Lock nicht verfügbar
  }
}

function releaseWakeLock() {
  if (wakeLockSentinel) {
    wakeLockSentinel.release();
    wakeLockSentinel = null;
  }
  wakeLockActive.value = false;
}

// ─── Touch/Swipe ───
function onTouchStart(e) {
  touchStartX = e.changedTouches[0].clientX;
  touchStartY = e.changedTouches[0].clientY;
}

function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
  if (dx < 0) nextStep();
  else prevStep();
}

// ─── Keyboard ───
function onKeydown(e) {
  if (!props.modelValue) return;
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextStep(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); prevStep(); }
  else if (e.key === 'Escape') close();
}

// ─── Lifecycle ───
watch(() => props.modelValue, async (val) => {
  if (val) {
    currentIndex.value = 0;
    checkedIngredients.value = new Set();
    resetTimer();
    checkMobile();
    await requestWakeLock();
    loadIcons();
    // Auf Tablets: Zutaten standardmäßig einblenden
    showIngredients.value = !isMobile.value;
  } else {
    releaseWakeLock();
    resetTimer();
  }
});

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', checkMobile);
  checkMobile();
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', checkMobile);
  releaseWakeLock();
  resetTimer();
});
</script>

<style scoped>
/* Öffnen/Schließen Transition */
.cooking-mode-enter-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.cooking-mode-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.cooking-mode-enter-from { opacity: 0; transform: translateY(100%); }
.cooking-mode-leave-to { opacity: 0; transform: translateY(100%); }

/* Sidebar Transition (Tablet+) */
.slide-sidebar-enter-active { transition: width 0.2s ease, opacity 0.2s ease; }
.slide-sidebar-leave-active { transition: width 0.15s ease, opacity 0.15s ease; }
.slide-sidebar-enter-from,
.slide-sidebar-leave-to { width: 0; opacity: 0; }

/* Overlay Transition (Mobile) */
.slide-overlay-enter-active { transition: transform 0.25s ease, opacity 0.2s ease; }
.slide-overlay-leave-active { transition: transform 0.2s ease, opacity 0.15s ease; }
.slide-overlay-enter-from { transform: translateX(-100%); opacity: 0; }
.slide-overlay-leave-to { transform: translateX(-100%); opacity: 0; }
</style>

<!-- Nicht-scoped für Highlight-Styles (scoped + Teleport + .dark bricht sonst) -->
<style>
.cooking-mode-view .cooking-highlight {
  background-color: color-mix(in oklab, var(--color-primary-500) 18%, transparent);
  color: var(--color-primary-700);
  padding-inline: 2px;
  border-radius: 3px;
  font-weight: 600;
}
.dark .cooking-mode-view .cooking-highlight {
  background-color: color-mix(in oklab, var(--color-primary-500) 22%, transparent);
  color: var(--color-primary-300);
}
</style>
