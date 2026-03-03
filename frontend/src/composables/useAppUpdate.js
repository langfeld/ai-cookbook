/**
 * ============================================
 * useAppUpdate Composable
 * ============================================
 * Verwaltet den PWA Service-Worker-Update-Lifecycle.
 *
 * - hasUpdate: Neuer SW wartet auf Aktivierung
 * - updateApp(): Aktiviert den neuen SW und lädt die Seite neu
 *
 * Der State wird von main.js über setUpdateCallback() befüllt.
 */

import { ref, readonly } from 'vue';

const hasUpdate = ref(false);
let updateSWFn = null;

/**
 * Wird von main.js aufgerufen, sobald registerSW() konfiguriert ist.
 * @param {Function} fn - Die von vite-plugin-pwa bereitgestellte updateSW-Funktion
 */
export function setUpdateCallback(fn) {
  updateSWFn = fn;
}

/**
 * Signalisiert, dass ein neuer Service Worker bereitsteht.
 * Wird von main.js' onNeedRefresh-Callback aufgerufen.
 */
export function signalUpdate() {
  hasUpdate.value = true;
}

/**
 * Aktiviert den neuen Service Worker und lädt die Seite neu.
 */
async function updateApp() {
  if (updateSWFn) {
    await updateSWFn(true);
  } else {
    // Fallback: Einfach neu laden
    window.location.reload();
  }
}

export function useAppUpdate() {
  return {
    hasUpdate: readonly(hasUpdate),
    updateApp,
  };
}
