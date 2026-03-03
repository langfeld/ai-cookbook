/**
 * ============================================
 * Offline Queue Service
 * ============================================
 * Speichert ausstehende Write-Operationen in IndexedDB,
 * sodass sie nach Netzwerkrückkehr abgearbeitet werden können.
 * Überlebt App-Neustarts und Browser-Reloads.
 */

import { get, set, del, keys, entries } from 'idb-keyval';
import { ref, computed } from 'vue';

const QUEUE_PREFIX = 'offline-queue:';

// Reactive State für UI-Anbindung
const pendingActions = ref([]);

/** Eindeutige ID generieren */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Alle ausstehenden Actions aus IndexedDB laden
 */
async function loadQueue() {
  try {
    const allKeys = await keys();
    const queueKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(QUEUE_PREFIX));
    const actions = [];

    for (const key of queueKeys) {
      const action = await get(key);
      if (action) actions.push(action);
    }

    // Chronologisch sortieren (älteste zuerst)
    actions.sort((a, b) => a.timestamp - b.timestamp);
    pendingActions.value = actions;
    return actions;
  } catch (err) {
    console.error('[OfflineQueue] Fehler beim Laden der Queue:', err);
    return [];
  }
}

/**
 * Action in die Queue legen
 * @param {Object} action - { type: 'shopping:toggleItem', payload: { itemId, is_checked }, storeName: 'shopping' }
 * @returns {string} Die generierte Action-ID
 */
async function enqueue(action) {
  const id = generateId();
  const queueItem = {
    id,
    type: action.type,
    payload: action.payload,
    storeName: action.storeName,
    status: 'pending',
    timestamp: Date.now(),
    retries: 0,
  };

  try {
    await set(`${QUEUE_PREFIX}${id}`, queueItem);
    pendingActions.value = [...pendingActions.value, queueItem];
  } catch (err) {
    console.error('[OfflineQueue] Fehler beim Enqueue:', err);
  }

  return id;
}

/**
 * Nächste ausstehende Action aus der Queue holen (FIFO)
 * @returns {Object|null}
 */
function peek() {
  return pendingActions.value.find(a => a.status === 'pending') || null;
}

/**
 * Action-Status aktualisieren
 */
async function updateStatus(id, status, retries) {
  const key = `${QUEUE_PREFIX}${id}`;
  const action = await get(key);
  if (!action) return;

  action.status = status;
  if (retries !== undefined) action.retries = retries;

  await set(key, action);
  const idx = pendingActions.value.findIndex(a => a.id === id);
  if (idx !== -1) {
    pendingActions.value[idx] = { ...action };
    pendingActions.value = [...pendingActions.value];
  }
}

/**
 * Action aus der Queue entfernen (nach erfolgreichem Sync)
 */
async function remove(id) {
  try {
    await del(`${QUEUE_PREFIX}${id}`);
    pendingActions.value = pendingActions.value.filter(a => a.id !== id);
  } catch (err) {
    console.error('[OfflineQueue] Fehler beim Remove:', err);
  }
}

/**
 * Gesamte Queue leeren
 */
async function clear() {
  try {
    const allKeys = await keys();
    const queueKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(QUEUE_PREFIX));
    for (const key of queueKeys) {
      await del(key);
    }
    pendingActions.value = [];
  } catch (err) {
    console.error('[OfflineQueue] Fehler beim Clear:', err);
  }
}

/**
 * Anzahl ausstehender Actions
 */
const pendingCount = computed(() =>
  pendingActions.value.filter(a => a.status === 'pending').length
);

/**
 * Prüft ob Actions für einen bestimmten Store ausstehen
 */
function hasPendingForStore(storeName) {
  return pendingActions.value.some(a => a.storeName === storeName && a.status === 'pending');
}

/**
 * Prüft ob ein bestimmtes Item eine ausstehende Offline-Action hat
 */
function hasPendingForItem(storeName, itemId) {
  return pendingActions.value.some(
    a => a.storeName === storeName
      && a.status === 'pending'
      && (a.payload?.itemId === itemId || a.payload?.entryId === itemId)
  );
}

/**
 * Prüft ob ein Error auf ein Netzwerkproblem hindeutet,
 * bei dem die Aktion in die Offline-Queue soll.
 */
function isOfflineError(err) {
  if (!navigator.onLine) return true;
  const msg = err?.message || '';
  return msg.includes('nicht erreichbar')
    || msg.includes('unterbrochen')
    || msg.includes('nicht verfügbar')
    || msg.includes('Serverfehler')
    || msg.includes('Failed to fetch')
    || msg.includes('NetworkError')
    || msg.includes('Load failed');
}

export const offlineQueue = {
  pendingActions,
  pendingCount,
  loadQueue,
  enqueue,
  peek,
  updateStatus,
  remove,
  clear,
  hasPendingForStore,
  hasPendingForItem,
  isOfflineError,
};
