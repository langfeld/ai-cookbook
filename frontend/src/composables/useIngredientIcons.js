/**
 * ============================================
 * useIngredientIcons Composable
 * ============================================
 * Lädt Zutaten-Emoji-Mappings und bietet Lookup-Funktion.
 * Cached die Mappings für die gesamte App-Sitzung.
 */

import { ref } from 'vue';
import { useApi } from '@/composables/useApi.js';

/** Globaler Cache — wird einmal geladen, dann wiederverwendet */
const icons = ref([]);
const loaded = ref(false);
const loading = ref(false);

export function useIngredientIcons() {
  const api = useApi();

  /** Mappings vom Server laden (nur beim ersten Aufruf) */
  async function loadIcons() {
    if (loaded.value || loading.value) return;
    loading.value = true;
    try {
      const data = await api.get('/ingredient-icons');
      icons.value = data.icons || [];
      loaded.value = true;
    } catch {
      // Stille Fehlerbehandlung — App funktioniert auch ohne Icons
    } finally {
      loading.value = false;
    }
  }

  /** Cache invalidieren (nach Admin-Änderungen) */
  function invalidate() {
    loaded.value = false;
    icons.value = [];
  }

  /**
   * Emoji für eine Zutat finden (Fuzzy-Matching)
   * 1. Exakter Match
   * 2. Keyword ist Teilstring des Zutatennamens ("tomate" in "Kirschtomaten")
   * 3. Zutatenname ist Teilstring eines Keywords
   * 4. Fallback: null
   */
  function getEmoji(ingredientName) {
    if (!ingredientName || !icons.value.length) return null;
    const name = ingredientName.trim().toLowerCase();

    // 1. Exakter Match
    const exact = icons.value.find(i => i.keyword === name);
    if (exact) return exact.emoji;

    // 2. Keyword ist Teilstring des Zutatennamens (längste zuerst für Präzision)
    const sorted = [...icons.value].sort((a, b) => b.keyword.length - a.keyword.length);
    const partial = sorted.find(i => name.includes(i.keyword));
    if (partial) return partial.emoji;

    // 3. Zutatenname ist Teilstring eines Keywords
    const reverse = sorted.find(i => i.keyword.includes(name));
    if (reverse) return reverse.emoji;

    return null;
  }

  return {
    icons,
    loaded,
    loading,
    loadIcons,
    invalidate,
    getEmoji,
  };
}
