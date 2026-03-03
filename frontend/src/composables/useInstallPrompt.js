/**
 * ============================================
 * useInstallPrompt Composable
 * ============================================
 * Fängt das `beforeinstallprompt`-Event ab und stellt
 * einen programmatischen Install-Trigger bereit.
 *
 * - canInstall: true wenn die App installierbar, aber noch nicht installiert ist
 * - installApp(): Zeigt den nativen Install-Dialog
 * - dismissed: User hat den Banner geschlossen (wird im localStorage gespeichert)
 */

import { ref, readonly } from 'vue';

// Singleton-State
const canInstall = ref(false);
const dismissed = ref(false);
let deferredPrompt = null;
let listenersBound = false;

// Prüfen ob der User den Banner schon weggeklickt hat (1 Woche merken)
const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 Tage

function checkDismissed() {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (ts && Date.now() - Number(ts) < DISMISS_DURATION) {
      dismissed.value = true;
    } else if (ts) {
      localStorage.removeItem(DISMISS_KEY);
    }
  } catch {
    // localStorage nicht verfügbar
  }
}

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;

  checkDismissed();

  // Chrome/Edge/Samsung Internet: beforeinstallprompt Event abfangen
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Standard-Mini-Banner unterdrücken
    deferredPrompt = e;
    canInstall.value = true;
  });

  // Wenn die App installiert wird → Banner ausblenden
  window.addEventListener('appinstalled', () => {
    canInstall.value = false;
    deferredPrompt = null;
  });

  // Standalone-Modus erkannt = bereits installiert
  if (
    window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  ) {
    canInstall.value = false;
  }
}

/**
 * Nativen Install-Dialog anzeigen
 * @returns {'accepted' | 'dismissed' | null}
 */
async function installApp() {
  if (!deferredPrompt) return null;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  if (outcome === 'accepted') {
    canInstall.value = false;
  }

  deferredPrompt = null;
  return outcome;
}

/**
 * Banner für 7 Tage ausblenden
 */
function dismissInstall() {
  dismissed.value = true;
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function useInstallPrompt() {
  bindListeners();

  return {
    canInstall: readonly(canInstall),
    dismissed: readonly(dismissed),
    installApp,
    dismissInstall,
  };
}
