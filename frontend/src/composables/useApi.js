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

  // Content-Type nur für JSON setzen (nicht für FormData/Multipart)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
    body: options.body instanceof FormData
      ? options.body
      : options.body
        ? JSON.stringify(options.body)
        : undefined,
  });

  // 401 -> Token abgelaufen, abmelden
  if (response.status === 401) {
    authStore.logout();
    throw new Error('Sitzung abgelaufen. Bitte erneut anmelden.');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Fehler ${response.status}`);
  }

  return data;
}

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

    // Convenience-Methoden
    get: (url) => apiFetch(url),
    post: (url, body) => apiFetch(url, { method: 'POST', body }),
    put: (url, body) => apiFetch(url, { method: 'PUT', body }),
    del: (url) => apiFetch(url, { method: 'DELETE' }),
    upload: (url, formData) => apiFetch(url, { method: 'POST', body: formData }),
  };
}
