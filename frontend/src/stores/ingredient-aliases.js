/**
 * ============================================
 * Ingredient Aliases Store
 * ============================================
 * Verwaltet Zutaten-Zusammenfassungen (Aliases).
 * z.B. "Gurke Mini" und "Gurke-Mini" → "Gurke Mini"
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useApi } from '@/composables/useApi.js';

export const useIngredientAliasStore = defineStore('ingredient-aliases', () => {
  const aliases = ref([]);
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

  return {
    aliases,
    loading,
    fetchAliases,
    createAlias,
    deleteAlias,
    mergeItems
  };
});
