/**
 * ============================================
 * useApi Composable - HTTP Client
 * ============================================
 * Zentraler API-Client mit automatischer JWT-Auth,
 * Fehlerbehandlung und Loading-States.
 */

import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth.js';
import { useNotification } from '@/composables/useNotification.js';

// Basis-URL für API-Anfragen
const BASE_URL = '/api';

/**
 * Benutzerfreundliche deutsche Fehlermeldungen für HTTP-Statuscodes
 */
function friendlyErrorMessage(status) {
  const messages = {
    400: 'Ungültige Anfrage. Bitte überprüfe deine Eingaben.',
    401: 'Ungültige Anmeldedaten.',
    403: 'Zugriff verweigert.',
    404: 'Nicht gefunden.',
    409: 'Eintrag existiert bereits.',
    413: 'Die Datei ist zu groß.',
    422: 'Die Eingaben konnten nicht verarbeitet werden.',
    429: 'Zu viele Anfragen. Bitte warte einen Moment.',
    500: 'Serverfehler. Bitte versuche es später erneut.',
    502: 'Server nicht erreichbar.',
    503: 'Server vorübergehend nicht verfügbar.',
  };
  return messages[status] || `Unbekannter Fehler (${status})`;
}

/**
 * Fetch-Wrapper mit Auth-Header und Fehlerbehandlung
 */
async function apiFetch(url, options = {}) {
  const authStore = useAuthStore();

  const headers = {
    ...options.headers,
  };

  // JWT Token hinzufügen (falls vorhanden)
  if (authStore.token) {
    headers['Authorization'] = `Bearer ${authStore.token}`;
  }

  // Content-Type nur für JSON setzen (nicht für FormData/Multipart und nicht ohne Body)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${url}`, {
      ...options,
      headers,
      body: options.body instanceof FormData
        ? options.body
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
    });
  } catch {
    // Bei Upload/POST-Requests kann der Server die Anfrage verarbeitet haben,
    // bevor die Verbindung abbrach (z.B. lange KI-Verarbeitung)
    const isWrite = options.method && options.method !== 'GET';
    throw new Error(
      isWrite
        ? 'Verbindung unterbrochen. Die Aktion wurde möglicherweise trotzdem ausgeführt.'
        : 'Server nicht erreichbar. Bitte prüfe deine Internetverbindung.'
    );
  }

  // 401 -> Token abgelaufen, abmelden
  if (response.status === 401 && authStore.token) {
    authStore.logout();
    throw new Error('Sitzung abgelaufen. Bitte erneut anmelden.');
  }

  // Antwort-Body sicher parsen
  let data;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    // Antwort ist kein valides JSON
    if (!response.ok) {
      throw new Error(friendlyErrorMessage(response.status));
    }
    return {};
  }

  if (!response.ok) {
    // Fastify liefert `error` (HTTP-Text) + `message` (Detail) bei Validierungsfehlern
    const msg = data.message || data.error || friendlyErrorMessage(response.status);
    throw new Error(msg);
  }

  return data;
}

/**
 * Direkter Zugriff auf apiFetch ohne automatische Notification.
 * Nützlich z.B. im Auth-Store, wo Fehler inline angezeigt werden.
 */
export { apiFetch as apiRaw };

/**
 * useApi Composable
 * Bietet reaktive Loading- und Error-States
 */
export function useApi() {
  const loading = ref(false);
  const error = ref(null);
  const { showError } = useNotification();

  /**
   * Führt eine API-Anfrage mit Loading/Error-Handling aus
   */
  async function execute(fn) {
    loading.value = true;
    error.value = null;

    try {
      const result = await fn();
      return result;
    } catch (err) {
      error.value = err.message;
      showError(err.message);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    error,
    execute,

    // Convenience-Methoden – Fehler werden per Notification angezeigt und als catch-bar weitergereicht
    get: (url) => apiFetch(url).catch(err => { showError(err.message); throw err; }),
    post: (url, body) => apiFetch(url, { method: 'POST', body }).catch(err => { showError(err.message); throw err; }),
    put: (url, body) => apiFetch(url, { method: 'PUT', body }).catch(err => { showError(err.message); throw err; }),
    del: (url) => apiFetch(url, { method: 'DELETE' }).catch(err => { showError(err.message); throw err; }),
    upload: (url, formData) => apiFetch(url, { method: 'POST', body: formData }).catch(err => { showError(err.message); throw err; }),
  };
}
