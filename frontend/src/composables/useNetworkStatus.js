/**
 * ============================================
 * useNetworkStatus Composable
 * ============================================
 * Reaktiver Netzwerkstatus mit Online/Offline-Erkennung.
 *
 * Strategie (Server-schonend):
 * 1. Primär: Browser-eigene navigator.onLine + online/offline-Events
 * 2. Sofort-Offline: Wenn ein API-Call fehlschlägt (über networkState in useApi)
 * 3. Recovery-Ping: Nur wenn wir offline sind, pingt /api/health alle 15s
 *    um zu erkennen, wann die Verbindung zurückkehrt.
 * 4. Fallback: Wenn die Browser-API nicht verfügbar ist, wird stattdessen
 *    ein periodischer Ping als Ersatz verwendet.
 *
 * → Kein Ping solange wir online sind = minimale Server-Last
 */

import { ref, readonly } from 'vue';

// Browser-API verfügbar? (in allen modernen Browsern ja, aber sicher ist sicher)
const hasBrowserOnlineAPI =
  typeof navigator !== 'undefined' && 'onLine' in navigator;

// Globaler Singleton-State (wird über alle Komponenten geteilt)
const isOnline = ref(hasBrowserOnlineAPI ? navigator.onLine : true);
const wasOffline = ref(false); // War seit App-Start mindestens einmal offline?
const lastOnlineAt = ref(Date.now());
const justReconnected = ref(false); // Gerade wieder online gekommen? (für Flash-Nachricht)

let reconnectTimer = null;
let listenersBound = false;
let recoveryCheckTimer = null;

/**
 * Echte Konnektivität prüfen (HEAD-Request an eigenen Server).
 * Wird NUR als Recovery-Check genutzt, wenn wir offline sind,
 * oder als Fallback wenn die Browser-API fehlt.
 * @returns {boolean}
 */
async function checkRealConnectivity() {
  try {
    await fetch('/api/health', {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return true;
  } catch {
    return false;
  }
}

function setOnline() {
  if (isOnline.value) return; // Bereits online, nichts zu tun
  isOnline.value = true;
  lastOnlineAt.value = Date.now();
  justReconnected.value = true;

  // Recovery-Ping stoppen — wir sind wieder online
  stopRecoveryCheck();

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

  // Recovery-Ping starten, um zu erkennen wann wir wieder online sind
  startRecoveryCheck();
}

/**
 * Browser sagt „online" → direkt übernehmen.
 * Falls es ein Fehlalarm war (z.B. LAN ohne Internet),
 * wird der nächste fehlschlagende API-Call sofort offline setzen.
 */
function handleOnline() {
  setOnline();
}

function handleOffline() {
  setOffline();
}

/**
 * Recovery-Check: Nur aktiv wenn wir offline sind.
 * Pingt den Server alle 15s an, um zu erkennen wann die Verbindung
 * zurückkehrt (z.B. wenn das Browser-online-Event nicht feuert).
 */
function startRecoveryCheck() {
  if (recoveryCheckTimer) return;
  recoveryCheckTimer = setInterval(async () => {
    const reallyOnline = await checkRealConnectivity();
    if (reallyOnline) {
      setOnline(); // stoppt auch den Recovery-Check
    }
  }, 15000);
}

function stopRecoveryCheck() {
  if (recoveryCheckTimer) {
    clearInterval(recoveryCheckTimer);
    recoveryCheckTimer = null;
  }
}

/**
 * Fallback-Modus: Periodischer Ping wenn Browser-API fehlt.
 * Prüft in beide Richtungen (online ↔ offline).
 */
function startFallbackPeriodicCheck() {
  setInterval(async () => {
    const reallyOnline = await checkRealConnectivity();
    if (reallyOnline && !isOnline.value) {
      setOnline();
    } else if (!reallyOnline && isOnline.value) {
      setOffline();
    }
  }, 15000);
}

/**
 * Globale Event-Listener einmalig binden
 */
function ensureListeners() {
  if (listenersBound) return;
  listenersBound = true;

  if (hasBrowserOnlineAPI) {
    // Primärer Modus: Browser-Events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Falls beim Start bereits offline → Recovery-Ping starten
    if (!navigator.onLine) {
      setOffline();
    }
  } else {
    // Fallback: Kein Browser-API → periodischer Ping übernimmt komplett
    startFallbackPeriodicCheck();
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

// Auch den writable State exportieren (für useApi + Sync-Manager)
export const networkState = {
  isOnline,
  wasOffline,
  justReconnected,
  lastOnlineAt,
};
