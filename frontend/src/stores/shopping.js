/**
 * ============================================
 * Shopping Store - Einkaufsliste
 * ============================================
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '@/composables/useApi.js';
import { useAuthStore } from '@/stores/auth.js';

export const useShoppingStore = defineStore('shopping', () => {
  const currentList = ref(null);
  const items = ref([]);
  const reweMatches = ref([]);
  const loading = ref(false);

  // REWE-Matching Fortschritt
  const reweProgress = ref(null); // null = kein Matching aktiv

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
  // Items mit REWE-Produktzuordnung (für "Bei REWE bestellen")
  const reweLinkedItems = computed(() =>
    items.value.filter(i => i.rewe_product?.url && !i.is_checked)
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

  /** REWE-Produkte matchen (mit SSE-Fortschritt) */
  async function matchWithRewe(listId) {
    const authStore = useAuthStore();
    const id = listId || currentList.value?.id;
    if (!id) throw new Error('Keine aktive Einkaufsliste');
    loading.value = true;
    reweProgress.value = { current: 0, total: 0, itemName: '', matchedCount: 0, matched: false, productName: null, price: null };

    try {
      const response = await fetch('/api/rewe/match-shopping-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({ listId: id }),
      });

      if (!response.ok) {
        throw new Error(`REWE-Matching fehlgeschlagen (${response.status})`);
      }

      // SSE-Stream lesen
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let doneData = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE-Events parsen (Format: "data: {...}\n\n")
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Letztes (unvollständiges) Element behalten

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'progress') {
              reweProgress.value = { ...data };
            } else if (data.type === 'done') {
              doneData = data;
            }
          } catch { /* ungültige JSON-Zeile ignorieren */ }
        }
      }

      // Liste neu laden, damit die in der DB gespeicherten REWE-Preise angezeigt werden
      await fetchActiveList();
      return doneData || {};
    } finally {
      loading.value = false;
      // Progress nach kurzem Delay ausblenden (damit man das Ergebnis noch sieht)
      setTimeout(() => { reweProgress.value = null; }, 1500);
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

  /** Item von der Einkaufsliste löschen */
  async function deleteItem(itemId) {
    await api.del(`/shopping/item/${itemId}`);
    items.value = items.value.filter(i => i.id !== itemId);
  }

  /** REWE-Produkte für eine Zutat suchen (für Produkt-Picker) */
  async function searchReweProducts(query) {
    return await api.get(`/rewe/search-ingredient?q=${encodeURIComponent(query)}`);
  }

  /** REWE-Produkt für ein Item manuell setzen/ändern (speichert auch Präferenz) */
  async function setReweProduct(itemId, product) {
    const data = await api.put(`/shopping/item/${itemId}/rewe-product`, {
      productId: product.id,
      productName: product.name,
      price: product.price,
      packageSize: product.packageSize,
    });
    // Lokales Item sofort aktualisieren
    const item = items.value.find(i => i.id === itemId);
    if (item) {
      item.rewe_product_id = product.id;
      item.rewe_product_name = product.name;
      item.rewe_price = product.price;
      item.rewe_package_size = product.packageSize;
      item.rewe_product = data.rewe_product;
    }
    return data;
  }

  /** Gespeicherte REWE Produkt-Präferenzen laden */
  async function fetchPreferences() {
    return await api.get('/rewe/preferences');
  }

  /** Einzelne Produkt-Präferenz löschen */
  async function deletePreference(prefId) {
    return await api.del(`/rewe/preferences/${prefId}`);
  }

  /** Alle Produkt-Präferenzen löschen */
  async function clearAllPreferences() {
    return await api.del('/rewe/preferences');
  }

  return {
    currentList, items, activeList, reweMatches, loading, reweProgress,
    openItemsCount, estimatedTotal, reweLinkedItems,
    generateList, fetchActiveList, toggleItem, matchWithRewe, completePurchase, addItem, deleteItem,
    searchReweProducts, setReweProduct, fetchPreferences, deletePreference, clearAllPreferences,
  };
});
