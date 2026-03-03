/**
 * ============================================
 * useNetworkStatus Composable
 * ============================================
 * Reaktiver Netzwerkstatus mit Online/Offline-Events.
 * Kompatibel mit Browser und Capacitor.
 */

import { ref, onMounted, onUnmounted, readonly } from 'vue';

// Globaler Singleton-State (wird über alle Komponenten geteilt)
const isOnline = ref(navigator.onLine);
const wasOffline = ref(false); // War seit App-Start mindestens einmal offline?
const lastOnlineAt = ref(Date.now());
const justReconnected = ref(false); // Gerade wieder online gekommen? (für Flash-Nachricht)

let reconnectTimer = null;
let listenersBound = false;

function handleOnline() {
  isOnline.value = true;
  lastOnlineAt.value = Date.now();
  justReconnected.value = true;

  // Flash-Nachricht nach 3 Sekunden ausblenden
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    justReconnected.value = false;
  }, 3000);
}

function handleOffline() {
  isOnline.value = false;
  wasOffline.value = true;
  justReconnected.value = false;
  clearTimeout(reconnectTimer);
}

/**
 * Globale Event-Listener einmalig binden
 */
function ensureListeners() {
  if (listenersBound) return;
  listenersBound = true;

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}

/**
 * useNetworkStatus Composable
 *
 * Gibt reaktive Refs zurück für:
 * - isOnline: Aktueller Netzwerkstatus
 * - wasOffline: War seit Start offline?
 * - justReconnected: Gerade wiederverbunden (für 3s)
 */
export function useNetworkStatus() {
  ensureListeners();

  return {
    isOnline: readonly(isOnline),
    wasOffline: readonly(wasOffline),
    justReconnected: readonly(justReconnected),
    lastOnlineAt: readonly(lastOnlineAt),
  };
}

// Auch den writable State exportieren (für den Sync-Manager)
export const networkState = {
  isOnline,
  wasOffline,
  justReconnected,
  lastOnlineAt,
};
