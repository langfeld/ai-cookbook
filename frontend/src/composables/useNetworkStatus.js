/**
 * ============================================
 * useNetworkStatus Composable
 * ============================================
 * Reaktiver Netzwerkstatus mit Online/Offline-Events.
 * Verifiziert echte Konnektivität über einen HEAD-Request,
 * da navigator.onLine nur das Netzwerk-Interface prüft.
 */

import { ref, readonly } from 'vue';

// Globaler Singleton-State (wird über alle Komponenten geteilt)
const isOnline = ref(navigator.onLine);
const wasOffline = ref(false); // War seit App-Start mindestens einmal offline?
const lastOnlineAt = ref(Date.now());
const justReconnected = ref(false); // Gerade wieder online gekommen? (für Flash-Nachricht)

let reconnectTimer = null;
let listenersBound = false;
let connectivityCheckTimer = null;

/**
 * Echte Konnektivität prüfen (HEAD-Request an eigenen Server).
 * navigator.onLine ist unzuverlässig — meldet true bei LAN ohne Internet.
 * @returns {boolean}
 */
async function checkRealConnectivity() {
  try {
    const response = await fetch('/api/health', {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return true; // Jeder Statuscode = Server erreichbar
  } catch {
    return false;
  }
}

function setOnline() {
  if (isOnline.value) return; // Bereits online, nichts zu tun
  isOnline.value = true;
  lastOnlineAt.value = Date.now();
  justReconnected.value = true;

  // Flash-Nachricht nach 3 Sekunden ausblenden
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    justReconnected.value = false;
  }, 3000);
}

function setOffline() {
  if (!isOnline.value) return; // Bereits offline, nichts zu tun
  isOnline.value = false;
  wasOffline.value = true;
  justReconnected.value = false;
  clearTimeout(reconnectTimer);
}

async function handleOnline() {
  // navigator.onLine sagt „online" — verifizieren mit echtem Request
  const reallyOnline = await checkRealConnectivity();
  if (reallyOnline) {
    setOnline();
  }
  // Falls nicht wirklich online: Status bleibt offline,
  // periodischer Check wird weiter versuchen
}

function handleOffline() {
  setOffline();
}

/**
 * Periodischer Connectivity-Check.
 * Fängt Fälle ab, in denen navigator.onLine true ist,
 * aber kein echtes Internet vorhanden ist (z.B. Captive Portal).
 * Auch nützlich, wenn die Verbindung zurückkehrt, ohne dass
 * das 'online'-Event korrekt feuert.
 */
function startPeriodicCheck() {
  if (connectivityCheckTimer) return;
  connectivityCheckTimer = setInterval(async () => {
    const reallyOnline = await checkRealConnectivity();
    if (reallyOnline && !isOnline.value) {
      setOnline();
    } else if (!reallyOnline && isOnline.value) {
      setOffline();
    }
  }, 30000); // Alle 30 Sekunden
}

/**
 * Globale Event-Listener einmalig binden
 */
function ensureListeners() {
  if (listenersBound) return;
  listenersBound = true;

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Periodischen Check starten
  startPeriodicCheck();

  // Beim Start: Falls navigator.onLine true ist, verifizieren
  if (navigator.onLine) {
    checkRealConnectivity().then(ok => {
      if (!ok) setOffline();
    });
  }
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
