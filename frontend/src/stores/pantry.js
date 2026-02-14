/**
 * ============================================
 * Pantry Store - Vorratsschrank
 * ============================================
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '@/composables/useApi.js';

export const usePantryStore = defineStore('pantry', () => {
  const items = ref([]);
  const categories = ref([]);
  const expiringCount = ref(0);
  const loading = ref(false);

  const api = useApi();

  // Items nach Kategorie gruppiert
  const groupedItems = computed(() => {
    const groups = {};
    for (const item of items.value) {
      const cat = item.category || 'Sonstiges';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  });

  /** Vorräte laden */
  async function fetchItems(filter = {}) {
    loading.value = true;
    try {
      const params = new URLSearchParams();
      if (filter.category) params.set('category', filter.category);
      if (filter.expiring) params.set('expiring', 'true');
      const data = await api.get(`/pantry?${params}`);
      items.value = data.items;
      categories.value = data.categories;
      expiringCount.value = data.expiringCount;
      return data;
    } finally {
      loading.value = false;
    }
  }

  /** Vorrat hinzufügen */
  async function addItem(itemData) {
    const data = await api.post('/pantry', itemData);
    await fetchItems();
    return data;
  }

  /** Vorrat aktualisieren */
  async function updateItem(id, itemData) {
    const data = await api.put(`/pantry/${id}`, itemData);
    await fetchItems();
    return data;
  }

  /** Menge entnehmen */
  async function useAmount(id, amount) {
    const data = await api.post(`/pantry/${id}/use`, { amount });
    await fetchItems();
    return data;
  }

  /** Vorrat löschen */
  async function removeItem(id) {
    await api.del(`/pantry/${id}`);
    items.value = items.value.filter(i => i.id !== id);
  }

  return {
    items, categories, expiringCount, loading, groupedItems,
    fetchItems, addItem, updateItem, useAmount, removeItem,
  };
});
