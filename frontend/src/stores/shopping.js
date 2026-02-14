/**
 * ============================================
 * Shopping Store - Einkaufsliste
 * ============================================
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '@/composables/useApi.js';

export const useShoppingStore = defineStore('shopping', () => {
  const currentList = ref(null);
  const items = ref([]);
  const reweMatches = ref([]);
  const loading = ref(false);

  const api = useApi();

  // Anzahl der noch offenen Items
  const openItemsCount = computed(() => items.value.filter(i => !i.is_checked).length);
  // Geschätzter Gesamtpreis (REWE)
  const estimatedTotal = computed(() =>
    items.value.reduce((sum, i) => sum + (i.rewe_price || 0), 0)
  );

  /** Einkaufsliste aus Wochenplan generieren */
  async function generateList(mealPlanId, name) {
    loading.value = true;
    try {
      const data = await api.post('/shopping/generate', { mealPlanId, name });
      await fetchActiveList();
      return data;
    } finally {
      loading.value = false;
    }
  }

  /** Aktive Einkaufsliste laden */
  async function fetchActiveList() {
    const data = await api.get('/shopping/list');
    currentList.value = data.list;
    items.value = data.items || [];
    return data;
  }

  /** Item abhaken */
  async function toggleItem(itemId) {
    await api.put(`/shopping/item/${itemId}/check`);
    const item = items.value.find(i => i.id === itemId);
    if (item) item.is_checked = item.is_checked ? 0 : 1;
  }

  /** REWE-Produkte matchen */
  async function matchWithRewe(listId) {
    loading.value = true;
    try {
      const data = await api.post('/rewe/match-shopping-list', { listId });
      reweMatches.value = data.matches;
      return data;
    } finally {
      loading.value = false;
    }
  }

  /** Einkauf abschließen */
  async function completePurchase(listId, purchasedItems) {
    return await api.post(`/shopping/${listId}/complete`, { purchasedItems });
  }

  return {
    currentList, items, reweMatches, loading,
    openItemsCount, estimatedTotal,
    generateList, fetchActiveList, toggleItem, matchWithRewe, completePurchase,
  };
});
