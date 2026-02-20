/**
 * ============================================
 * Ingredient Settings Store
 * ============================================
 * Verwaltet Zutaten-Einstellungen:
 * - Zusammenfassungen (Aliases): z.B. "Gurke Mini" → "Gurke Mini"
 * - Geblockte Zutaten: werden bei der Einkaufslisten-Generierung ausgeschlossen
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useApi } from '@/composables/useApi.js';

export const useIngredientAliasStore = defineStore('ingredient-aliases', () => {
  const aliases = ref([]);
  const blockedIngredients = ref([]);
  const loading = ref(false);

  const api = useApi();

  /** Alle Aliases laden */
  async function fetchAliases() {
    loading.value = true;
    try {
      const data = await api.get('/ingredient-aliases');
      aliases.value = data.aliases;
    } catch (err) {
      console.error('Fehler beim Laden der Aliases:', err);
    } finally {
      loading.value = false;
    }
  }

  /** Neuen Alias erstellen */
  async function createAlias(canonicalName, aliasName) {
    const data = await api.post('/ingredient-aliases', {
      canonical_name: canonicalName,
      alias_name: aliasName
    });
    aliases.value.push(data.alias);
    return data.alias;
  }

  /** Alias löschen */
  async function deleteAlias(aliasId) {
    await api.del(`/ingredient-aliases/${aliasId}`);
    aliases.value = aliases.value.filter(a => a.id !== aliasId);
  }

  /** Mehrere Einkaufslisten-Items zusammenführen */
  async function mergeItems(sourceItemIds, targetItemId, keepName) {
    const data = await api.post('/ingredient-aliases/merge', {
      source_item_ids: sourceItemIds,
      target_item_id: targetItemId,
      canonical_name: keepName
    });
    return data;
  }

  // ============================================
  // Geblockte Zutaten
  // ============================================

  /** Alle geblockten Zutaten laden */
  async function fetchBlockedIngredients() {
    try {
      const data = await api.get('/ingredient-aliases/blocked');
      blockedIngredients.value = data.blocked;
    } catch (err) {
      console.error('Fehler beim Laden der geblockten Zutaten:', err);
    }
  }

  /** Zutat blockieren */
  async function blockIngredient(ingredientName) {
    const data = await api.post('/ingredient-aliases/blocked', {
      ingredient_name: ingredientName,
    });
    // Lokal hinzufügen
    blockedIngredients.value.push({
      id: Date.now(), // temporäre ID, wird beim nächsten Fetch ersetzt
      ingredient_name: data.ingredient_name,
      created_at: new Date().toISOString(),
    });
    return data;
  }

  /** Block aufheben */
  async function unblockIngredient(blockedId) {
    await api.del(`/ingredient-aliases/blocked/${blockedId}`);
    blockedIngredients.value = blockedIngredients.value.filter(b => b.id !== blockedId);
  }

  return {
    aliases,
    blockedIngredients,
    loading,
    fetchAliases,
    createAlias,
    deleteAlias,
    mergeItems,
    fetchBlockedIngredients,
    blockIngredient,
    unblockIngredient,
  };
});
