/**
 * ============================================
 * Sync Manager
 * ============================================
 * Arbeitet die Offline-Queue ab, wenn das Netzwerk
 * zurückkehrt. Führt Actions sequentiell aus und
 * triggert Store-Refreshes nach Abschluss.
 */

import { watch, ref, readonly } from 'vue';
import { offlineQueue } from './offlineQueue.js';
import { networkState } from '@/composables/useNetworkStatus.js';
import { useNotification } from '@/composables/useNotification.js';

const isSyncing = ref(false);
const syncError = ref(null);
const MAX_RETRIES = 3;

// Registry: type → async handler function
const actionHandlers = {};

/**
 * Handler für einen Action-Typ registrieren.
 * Der Handler führt den eigentlichen API-Call aus.
 *
 * @param {string} type - z.B. 'shopping:toggleItem'
 * @param {Function} handler - async (payload) => {}
 */
function registerHandler(type, handler) {
  actionHandlers[type] = handler;
}

/**
 * Eine einzelne Action ausführen
 * @returns {boolean} true bei Erfolg, false bei Fehler
 */
async function executeAction(action) {
  const handler = actionHandlers[action.type];
  if (!handler) {
    console.warn(`[SyncManager] Kein Handler für Action-Typ "${action.type}". Überspringe.`);
    await offlineQueue.remove(action.id);
    return true;
  }

  try {
    await offlineQueue.updateStatus(action.id, 'syncing');
    await handler(action.payload);
    await offlineQueue.remove(action.id);
    return true;
  } catch (err) {
    const retries = (action.retries || 0) + 1;

    // 404 = Ressource existiert nicht mehr → Action verwerfen
    if (err.message?.includes('404') || err.message?.includes('Nicht gefunden')) {
      console.warn(`[SyncManager] Ressource nicht gefunden für "${action.type}". Verwerfe Action.`);
      await offlineQueue.remove(action.id);
      return true;
    }

    // Max Retries erreicht → Action als fehlerhaft markieren
    if (retries >= MAX_RETRIES) {
      console.error(`[SyncManager] Max Retries für "${action.type}" erreicht. Markiere als fehlerhaft.`);
      await offlineQueue.updateStatus(action.id, 'failed', retries);
      return false;
    }

    // Retry möglich → Status zurücksetzen
    await offlineQueue.updateStatus(action.id, 'pending', retries);
    return false;
  }
}

/**
 * Die gesamte Queue abarbeiten (FIFO)
 */
async function processQueue() {
  if (isSyncing.value) return;
  if (!networkState.isOnline.value) return;

  const pending = offlineQueue.pendingActions.value.filter(a => a.status === 'pending');
  if (pending.length === 0) return;

  isSyncing.value = true;
  syncError.value = null;

  const { showSuccess, showError } = useNotification();
  let successCount = 0;
  let failCount = 0;

  try {
    for (const action of pending) {
      // Vor jedem Call prüfen ob wir noch online sind
      if (!networkState.isOnline.value) {
        console.warn('[SyncManager] Während Sync offline gegangen. Pausiere.');
        break;
      }

      const success = await executeAction(action);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Kurze Pause zwischen Requests um den Server nicht zu überlasten
      await new Promise(r => setTimeout(r, 100));
    }

    // Nach Sync: betroffene Stores refreshen
    if (successCount > 0) {
      await refreshStores(pending);

      if (failCount === 0) {
        showSuccess(`${successCount} Offline-Änderung${successCount > 1 ? 'en' : ''} synchronisiert`);
      } else {
        showError(`${successCount} synchronisiert, ${failCount} fehlgeschlagen`);
      }
    }
  } catch (err) {
    console.error('[SyncManager] Unerwarteter Fehler:', err);
    syncError.value = err.message;
  } finally {
    isSyncing.value = false;
  }
}

/**
 * Betroffene Stores nach Sync refreshen, um Server-Wahrheit zu übernehmen
 */
async function refreshStores(processedActions) {
  const storeNames = new Set(processedActions.map(a => a.storeName));

  // Dynamischer Import um zirkuläre Abhängigkeiten zu vermeiden
  if (storeNames.has('shopping')) {
    try {
      const { useShoppingStore } = await import('@/stores/shopping.js');
      const store = useShoppingStore();
      await store.fetchActiveList();
    } catch (err) {
      console.warn('[SyncManager] Shopping-Store Refresh fehlgeschlagen:', err);
    }
  }

  if (storeNames.has('mealplan')) {
    try {
      const { useMealPlanStore } = await import('@/stores/mealplan.js');
      const store = useMealPlanStore();
      if (store.currentPlan?.week_start) {
        await store.fetchCurrentPlan(store.currentPlan.week_start);
      }
    } catch (err) {
      console.warn('[SyncManager] Mealplan-Store Refresh fehlgeschlagen:', err);
    }
  }
}

/**
 * Sync-Manager initialisieren:
 * - Queue aus IndexedDB laden
 * - Auf Online-Events lauschen
 */
async function init() {
  // Queue beim Start laden
  await offlineQueue.loadQueue();

  // Bei Netzwerkrückkehr automatisch synchronisieren
  watch(networkState.isOnline, (online) => {
    if (online) {
      // Kurz warten bis die Verbindung stabil ist
      setTimeout(() => processQueue(), 1000);
    }
  });

  // Falls wir bereits online sind und Actions in der Queue liegen
  if (networkState.isOnline.value) {
    await processQueue();
  }
}

/**
 * Gescheiterte Actions erneut versuchen
 */
async function retryFailed() {
  const failed = offlineQueue.pendingActions.value.filter(a => a.status === 'failed');
  for (const action of failed) {
    await offlineQueue.updateStatus(action.id, 'pending', 0);
  }
  await processQueue();
}

export const syncManager = {
  isSyncing: readonly(isSyncing),
  syncError: readonly(syncError),
  registerHandler,
  processQueue,
  retryFailed,
  init,
};
