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
  const listHistory = ref([]);

  // Vorratscheck
  const pantryCheck = ref(null);
  const pantryCheckLoading = ref(false);

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
  // Geschätzter Gesamtpreis (REWE) – Preis × Anzahl Packungen
  const estimatedTotal = computed(() =>
    items.value.reduce((sum, i) => {
      const price = i.rewe_price || 0;
      const qty = i.rewe_product?.quantity || 1;
      return sum + (price * qty);
    }, 0)
  );
  // Items mit REWE-Produktzuordnung (für "Bei REWE bestellen")
  const reweLinkedItems = computed(() =>
    items.value.filter(i => i.rewe_product?.url && !i.is_checked)
  );

  /** Einkaufsliste aus Wochenplan generieren */
  async function generateList(mealPlanId, { name, excludePastDays = true } = {}) {
    loading.value = true;
    try {
      const data = await api.post('/shopping/generate', { mealPlanId, name, excludePastDays });
      await fetchActiveList();
      // Vorratscheck zurücksetzen (wird beim nächsten Aufklappen neu geladen)
      pantryCheck.value = null;
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

  /** Alle Einkaufslisten (Verlauf) laden */
  async function fetchListHistory() {
    const data = await api.get('/shopping/lists');
    listHistory.value = data.lists || [];
    return data;
  }

  /** Bestimmte Einkaufsliste laden (auch inaktive) */
  async function loadList(listId) {
    const data = await api.get(`/shopping/lists/${listId}`);
    currentList.value = data.list;
    items.value = data.items || [];
    return data;
  }

  /** Einkaufsliste (wieder) aktivieren */
  async function reactivateList(listId) {
    await api.put(`/shopping/lists/${listId}/activate`);
    await fetchActiveList();
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
  async function completePurchase({ includeAll = false } = {}) {
    if (!currentList.value?.id) throw new Error('Keine aktive Einkaufsliste');
    const data = await api.post(`/shopping/${currentList.value.id}/complete`, { includeAll });
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
    // Vorratscheck aktualisieren (falls geladen), damit „verschoben"-Status stimmt
    if (pantryCheck.value) {
      fetchPantryCheck();
    }
  }

  /** Vorratscheck laden (welche Vorräte sollten für den Wochenplan vorhanden sein?) */
  async function fetchPantryCheck() {
    pantryCheckLoading.value = true;
    try {
      const data = await api.get('/shopping/pantry-check');
      pantryCheck.value = data;
      return data;
    } finally {
      pantryCheckLoading.value = false;
    }
  }

  /** Zutat aus Vorratscheck zur Einkaufsliste verschieben */
  async function moveFromPantryToList({ ingredient_name, amount, unit, pantry_item_id }) {
    const data = await api.post('/shopping/pantry-check/move-to-list', {
      ingredient_name, amount, unit, pantry_item_id,
    });
    // Neues Item direkt in die lokale Liste einfügen
    if (data.item) {
      items.value.push(data.item);
    }
    return data;
  }

  /** Item in den Vorratsschrank verschieben */
  async function moveToPantry(itemId) {
    const data = await api.post(`/shopping/item/${itemId}/to-pantry`, {});
    items.value = items.value.filter(i => i.id !== itemId);
    return data;
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
      imageUrl: product.imageUrl || null,
    });
    // Lokales Item sofort aktualisieren
    const item = items.value.find(i => i.id === itemId);
    if (item) {
      item.rewe_product_id = product.id;
      item.rewe_product_name = product.name;
      item.rewe_price = product.price;
      item.rewe_package_size = product.packageSize;
      item.rewe_image_url = product.imageUrl || null;
      item.rewe_product = data.rewe_product; // enthält jetzt auch quantity + imageUrl
    }
    return data;
  }

  /** REWE-Packungsanzahl manuell ändern */
  async function updateReweQuantity(itemId, quantity) {
    const data = await api.put(`/shopping/item/${itemId}/rewe-quantity`, { quantity });
    const item = items.value.find(i => i.id === itemId);
    if (item && item.rewe_product) {
      item.rewe_product.quantity = data.quantity;
      item.rewe_quantity = data.quantity;
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

  /** Einzelne Produkt-Präferenz aktualisieren (bevorzugtes Produkt ändern) */
  async function updatePreference(prefId, product) {
    return await api.put(`/rewe/preferences/${prefId}`, {
      rewe_product_id: product.id,
      rewe_product_name: product.name,
      rewe_price: product.price,
      rewe_package_size: product.packageSize || null,
      rewe_image_url: product.imageUrl || null,
    });
  }

  /** Alle Produkt-Präferenzen löschen */
  async function clearAllPreferences() {
    return await api.del('/rewe/preferences');
  }

  // ============================================
  // Bring! Integration
  // ============================================

  const bringStatus = ref(null);       // { connected, email, list } oder null
  const bringLists = ref([]);          // Verfügbare Bring!-Listen
  const bringSending = ref(false);     // Wird gerade gesendet?
  const bringImporting = ref(false);   // Wird gerade importiert?

  /** Bring!-Status laden */
  async function fetchBringStatus() {
    try {
      bringStatus.value = await api.get('/bring/status');
    } catch {
      bringStatus.value = { connected: false };
    }
    return bringStatus.value;
  }

  /** Bring!-Account verbinden */
  async function connectBring(email, password, listUuid, listName) {
    const data = await api.post('/bring/connect', { email, password, listUuid, listName });
    bringStatus.value = { connected: true, email, list: data.list };
    bringLists.value = data.availableLists || [];
    return data;
  }

  /** Bring!-Listen laden */
  async function fetchBringLists() {
    const data = await api.get('/bring/lists');
    bringLists.value = data.lists || [];
    return data;
  }

  /** Standard-Liste ändern */
  async function setBringList(listUuid, listName) {
    await api.put('/bring/list', { listUuid, listName });
    if (bringStatus.value) {
      bringStatus.value.list = { uuid: listUuid, name: listName };
    }
  }

  /** Einkaufsliste an Bring! senden */
  async function sendToBring(listUuid) {
    bringSending.value = true;
    try {
      return await api.post('/bring/send', { listUuid });
    } finally {
      bringSending.value = false;
    }
  }

  /** Bring!-Verbindung trennen */
  async function disconnectBring() {
    await api.del('/bring/disconnect');
    bringStatus.value = { connected: false };
    bringLists.value = [];
  }

  /** Artikel aus Bring! importieren */
  async function importFromBring(listUuid) {
    bringImporting.value = true;
    try {
      const data = await api.post('/bring/import', { listUuid });
      // Importierte Items in die lokale Liste einfügen
      if (data.items && data.items.length > 0) {
        items.value.push(...data.items);
      }
      return data;
    } finally {
      bringImporting.value = false;
    }
  }

  // ============================================
  // REWE Warenkorb-Script (Bookmarklet)
  // ============================================

  /** REWE-Warenkorb-Script abrufen */
  async function getReweCartScript() {
    return await api.get('/rewe/cart-script');
  }

  /** REWE Userscript-Install-URL generieren */
  function getReweUserscriptUrl() {
    const authStore = useAuthStore();
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/rewe/userscript.user.js?token=${encodeURIComponent(authStore.token)}`;
  }

  /** API-Key abrufen */
  async function getApiKey() {
    return await api.get('/auth/api-key');
  }

  /** API-Key generieren */
  async function generateApiKey() {
    return await api.post('/auth/api-key');
  }

  /** API-Key widerrufen */
  async function revokeApiKey() {
    return await api.del('/auth/api-key');
  }

  return {
    currentList, items, activeList, reweMatches, loading, reweProgress, listHistory,
    openItemsCount, estimatedTotal, reweLinkedItems,
    // Vorratscheck
    pantryCheck, pantryCheckLoading,
    generateList, fetchActiveList, fetchListHistory, loadList, reactivateList, toggleItem, matchWithRewe, completePurchase, addItem, deleteItem, moveToPantry,
    fetchPantryCheck, moveFromPantryToList,
    searchReweProducts, setReweProduct, updateReweQuantity, fetchPreferences, deletePreference, updatePreference, clearAllPreferences,
    // Bring!
    bringStatus, bringLists, bringSending, bringImporting,
    fetchBringStatus, connectBring, fetchBringLists, setBringList, sendToBring, disconnectBring, importFromBring,
    // REWE Script
    getReweCartScript,
    getReweUserscriptUrl,
    // API-Key
    getApiKey, generateApiKey, revokeApiKey,
  };
});
