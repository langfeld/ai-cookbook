/**
 * ============================================
 * useNotification Composable - Toast-Benachrichtigungen
 * ============================================
 * Globales Benachrichtigungssystem für Erfolg/Fehler/Info-Meldungen.
 */

import { ref } from 'vue';

// Globale Notification-Liste
const notifications = ref([]);
let nextId = 0;

export function useNotification() {
  /**
   * Benachrichtigung hinzufügen
   * Doppelte Nachrichten (gleicher Text + Typ) innerhalb von 2 Sekunden werden unterdrückt.
   * @param {string} message - Nachricht
   * @param {string} type - success, error, info, warning
   * @param {number} duration - Anzeigedauer in ms (0 = manuell schließen)
   */
  function addNotification(message, type = 'info', duration = 4000) {
    // Deduplizierung: gleiche Nachricht + Typ nicht doppelt anzeigen
    const isDuplicate = notifications.value.some(
      n => n.message === message && n.type === type
    );
    if (isDuplicate) return;

    const id = nextId++;
    notifications.value.push({ id, message, type });

    // Automatisch entfernen nach Dauer
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  }

  function removeNotification(id) {
    notifications.value = notifications.value.filter(n => n.id !== id);
  }

  // Convenience-Methoden
  const showSuccess = (msg) => addNotification(msg, 'success');
  const showError = (msg) => addNotification(msg, 'error', 6000);
  const showInfo = (msg) => addNotification(msg, 'info');
  const showWarning = (msg) => addNotification(msg, 'warning', 5000);

  return {
    notifications,
    addNotification,
    removeNotification,
    showSuccess,
    showError,
    showInfo,
    showWarning,
  };
}
