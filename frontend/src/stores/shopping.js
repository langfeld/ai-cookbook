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

  // Kombinierte aktive Liste (für Template-Zugriff via shoppingStore.activeList)
  const activeList = computed(() => {
    if (!currentList.value) return null;
    return { ...currentList.value, items: items.value };
  });

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

  /** Einkauf abschließen – abgehakte Items in den Vorratsschrank */
  async function completePurchase() {
    if (!currentList.value?.id) throw new Error('Keine aktive Einkaufsliste');
    const data = await api.post(`/shopping/${currentList.value.id}/complete`, {});
    // Liste zurücksetzen
    currentList.value = null;
    items.value = [];
    return data;
  }

  /** Manuell ein Item zur Einkaufsliste hinzufügen */
  async function addItem({ ingredient_name, amount, unit }) {
    const data = await api.post('/shopping/item/add', { ingredient_name, amount, unit });
    // Neues Item direkt in die lokale Liste einfügen
    items.value.push(data);
    // Falls vorher keine Liste existierte, Liste neu laden
    if (!currentList.value) {
      await fetchActiveList();
    }
    return data;
  }

  return {
    currentList, items, activeList, reweMatches, loading,
    openItemsCount, estimatedTotal,
    generateList, fetchActiveList, toggleItem, matchWithRewe, completePurchase, addItem,
  };
});
