/**
 * ============================================
 * Recipe Blocks Store – Rezept-Sperren
 * ============================================
 * Verwaltet temporäre Sperren von Rezepten
 * für die Wochenplan-Generierung.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '@/composables/useApi.js';

export const useRecipeBlocksStore = defineStore('recipeBlocks', () => {
  const blocks = ref([]);
  const loading = ref(false);
  const api = useApi();

  /** Nur aktive (nicht abgelaufene) Sperren */
  const activeBlocks = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return blocks.value.filter(b => b.blocked_until >= today);
  });

  /** Set der gesperrten Rezept-IDs (für schnelle Lookups) */
  const blockedRecipeIds = computed(() => new Set(activeBlocks.value.map(b => b.recipe_id)));

  /** Alle Sperren laden */
  async function fetchBlocks() {
    loading.value = true;
    try {
      const data = await api.get('/recipe-blocks');
      blocks.value = data.blocks;
    } finally {
      loading.value = false;
    }
  }

  /** Rezept für X Wochen sperren */
  async function blockRecipe(recipeId, weeks, reason = '') {
    const data = await api.post('/recipe-blocks', {
      recipe_id: recipeId,
      weeks,
      reason: reason || undefined,
    });
    // Lokal hinzufügen/aktualisieren
    const existing = blocks.value.findIndex(b => b.recipe_id === recipeId);
    if (existing !== -1) {
      blocks.value[existing] = { ...blocks.value[existing], ...data.block };
    } else {
      blocks.value.push(data.block);
    }
    return data;
  }

  /** Sperre aufheben per Block-ID */
  async function unblockById(blockId) {
    await api.del(`/recipe-blocks/${blockId}`);
    blocks.value = blocks.value.filter(b => b.id !== blockId);
  }

  /** Sperre aufheben per Rezept-ID */
  async function unblockByRecipeId(recipeId) {
    await api.del(`/recipe-blocks/recipe/${recipeId}`);
    blocks.value = blocks.value.filter(b => b.recipe_id !== recipeId);
  }

  /** Prüfen ob ein Rezept gesperrt ist */
  function isBlocked(recipeId) {
    return blockedRecipeIds.value.has(recipeId);
  }

  return {
    blocks,
    activeBlocks,
    blockedRecipeIds,
    loading,
    fetchBlocks,
    blockRecipe,
    unblockById,
    unblockByRecipeId,
    isBlocked,
  };
});
