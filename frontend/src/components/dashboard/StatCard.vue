<!--
  ============================================
  StatCard - Statistik-Karte für Dashboard
  ============================================
-->
<template>
  <div class="bg-white dark:bg-stone-900 p-4 border border-stone-200 dark:border-stone-800 rounded-xl">
    <div class="flex items-center gap-3">
      <div
        :class="[
          'w-10 h-10 rounded-lg flex items-center justify-center',
          colorClasses[color] || colorClasses.primary,
        ]"
      >
        <component :is="icon" class="w-5 h-5" />
      </div>
      <div>
        <p class="font-bold text-stone-800 dark:text-stone-100 text-2xl">{{ value }}</p>
        <p class="text-stone-500 dark:text-stone-400 text-xs">{{ label }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  icon: { type: [Object, Function], required: true },
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  color: { type: String, default: 'primary' },
});

const colorClasses = {
  primary: 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400',
  amber: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
  accent: 'bg-accent-100 dark:bg-accent-900/50 text-accent-600 dark:text-accent-400',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400',
};
</script>
