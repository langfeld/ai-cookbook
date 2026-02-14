/**
 * ============================================
 * useTheme Composable - Dark/Light Mode
 * ============================================
 * Verwaltet das Theme mit Persistierung in localStorage.
 * Verwendet den Tailwind dark: Prefix.
 */

import { ref, watch } from 'vue';

// Theme-State (reaktiv, global geteilt)
const isDark = ref(false);

/**
 * Theme beim ersten Laden initialisieren
 * Berücksichtigt: 1. localStorage, 2. System-Präferenz
 */
function initTheme() {
  const stored = localStorage.getItem('ai-cookbook-theme');

  if (stored) {
    isDark.value = stored === 'dark';
  } else {
    // System-Präferenz als Fallback
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  applyTheme();
}

/**
 * Theme auf HTML-Element anwenden
 * Tailwind 4 erkennt die .dark Klasse auf <html>
 */
function applyTheme() {
  if (isDark.value) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Theme-Wechsel beobachten und persistieren
watch(isDark, (newVal) => {
  localStorage.setItem('ai-cookbook-theme', newVal ? 'dark' : 'light');
  applyTheme();
});

// Beim Import initialisieren
if (typeof window !== 'undefined') {
  initTheme();
}

/**
 * useTheme Composable
 */
export function useTheme() {
  /**
   * Theme umschalten
   */
  function toggleTheme() {
    isDark.value = !isDark.value;
  }

  return {
    isDark,
    toggleTheme,
  };
}
