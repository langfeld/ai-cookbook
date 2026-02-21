<script setup>
/**
 * UnitInput – Combobox für Einheiten
 * Zeigt Standard-Einheiten als Dropdown-Vorschläge, erlaubt aber Freitext.
 * Nicht-Standard-Einheiten werden farblich hervorgehoben (orange).
 */
import { computed, ref, watch, nextTick } from 'vue';

const STANDARD_UNITS = [
  { value: 'g', label: 'g', group: 'Gewicht' },
  { value: 'kg', label: 'kg', group: 'Gewicht' },
  { value: 'ml', label: 'ml', group: 'Volumen' },
  { value: 'l', label: 'l', group: 'Volumen' },
  { value: 'TL', label: 'TL', group: 'Löffel' },
  { value: 'EL', label: 'EL', group: 'Löffel' },
  { value: 'Stk', label: 'Stk', group: 'Zählbar' },
  { value: 'Bund', label: 'Bund', group: 'Zählbar' },
  { value: 'Dose', label: 'Dose', group: 'Zählbar' },
  { value: 'Pkg', label: 'Pkg', group: 'Zählbar' },
  { value: 'Becher', label: 'Becher', group: 'Zählbar' },
  { value: 'Prise', label: 'Prise', group: 'Sonstige' },
  { value: 'Scheibe', label: 'Scheibe', group: 'Sonstige' },
  { value: 'Zehe', label: 'Zehe', group: 'Sonstige' },
];

const STANDARD_SET = new Set(STANDARD_UNITS.map(u => u.value.toLowerCase()));

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Einheit' },
  inputClass: { type: String, default: '' },
  compact: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const inputRef = ref(null);
const open = ref(false);
const filterText = ref('');
const highlightIndex = ref(-1);

const localValue = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const isNonStandard = computed(() => {
  const val = localValue.value?.trim();
  if (!val) return false;
  return !STANDARD_SET.has(val.toLowerCase());
});

const filteredUnits = computed(() => {
  const q = filterText.value.toLowerCase();
  if (!q) return STANDARD_UNITS;
  return STANDARD_UNITS.filter(u =>
    u.value.toLowerCase().includes(q) ||
    u.label.toLowerCase().includes(q) ||
    u.group.toLowerCase().includes(q)
  );
});

function onFocus() {
  filterText.value = '';
  highlightIndex.value = -1;
  open.value = true;
}

function onBlur() {
  // Delay, damit der Klick auf eine Option noch registriert wird
  setTimeout(() => { open.value = false; }, 150);
}

function onInput(e) {
  localValue.value = e.target.value;
  filterText.value = e.target.value;
  highlightIndex.value = -1;
  open.value = true;
}

function selectUnit(unit) {
  localValue.value = unit.value;
  open.value = false;
  filterText.value = '';
  inputRef.value?.blur();
}

function onKeydown(e) {
  if (!open.value) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      open.value = true;
      e.preventDefault();
      return;
    }
    return;
  }

  const list = filteredUnits.value;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightIndex.value = Math.min(highlightIndex.value + 1, list.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightIndex.value = Math.max(highlightIndex.value - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (highlightIndex.value >= 0 && highlightIndex.value < list.length) {
      selectUnit(list[highlightIndex.value]);
    } else {
      open.value = false;
    }
  } else if (e.key === 'Escape') {
    open.value = false;
  }
}
</script>

<template>
  <div class="relative">
    <input
      ref="inputRef"
      type="text"
      :value="localValue"
      :placeholder="placeholder"
      :class="[
        props.inputClass || 'form-input',
        isNonStandard ? 'text-amber-600 dark:text-amber-400' : '',
        compact ? 'text-center' : '',
      ]"
      autocomplete="off"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <!-- Warnung für Nicht-Standard -->
    <span
      v-if="isNonStandard && localValue"
      class="top-1/2 right-2 absolute text-[10px] text-amber-500 -translate-y-1/2"
      title="Nicht-Standard-Einheit"
    >⚠</span>
    <!-- Dropdown -->
    <Transition name="dropdown">
      <div
        v-if="open && filteredUnits.length"
        class="z-50 absolute bg-white dark:bg-stone-800 shadow-lg mt-1 py-1 border border-stone-200 dark:border-stone-700 rounded-lg min-w-36 max-h-48 overflow-y-auto"
        :class="compact ? 'right-0' : 'left-0'"
      >
        <button
          v-for="(unit, idx) in filteredUnits"
          :key="unit.value"
          type="button"
          :class="[
            'w-full px-3 py-1.5 text-left text-sm transition-colors flex items-center justify-between gap-3',
            highlightIndex === idx
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700/50'
          ]"
          @mousedown.prevent="selectUnit(unit)"
        >
          <span class="font-medium">{{ unit.value }}</span>
          <span class="text-stone-400 dark:text-stone-500 text-xs whitespace-nowrap">{{ unit.group }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

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

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
