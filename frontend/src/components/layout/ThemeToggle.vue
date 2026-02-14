<!--
  ============================================
  ThemeToggle - Dark/Light Mode Schalter
  ============================================
  Animierter Toggle mit Sonne/Mond Icons.
-->
<template>
  <button
    @click="toggleTheme"
    class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg text-stone-500 dark:text-stone-400 transition-colors"
    :title="isDark ? 'Zum hellen Design wechseln' : 'Zum dunklen Design wechseln'"
  >
    <!-- Sonne (im Dark Mode) -->
    <Sun v-if="isDark" class="w-5 h-5 text-amber-400" />
    <!-- Mond (im Light Mode) -->
    <Moon v-else class="w-5 h-5 text-indigo-500" />
  </button>
</template>

<script setup>
import { Sun, Moon } from 'lucide-vue-next';
import { useTheme } from '@/composables/useTheme.js';

const { isDark, toggleTheme } = useTheme();
</script>
