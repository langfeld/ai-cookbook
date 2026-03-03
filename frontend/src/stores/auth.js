/**
 * ============================================
 * Auth Store - Benutzer-Authentifizierung
 * ============================================
 * Verwaltet Login-Status, Token und Benutzerinformationen.
 * Token wird in localStorage persistiert.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiRaw } from '@/composables/useApi.js';

export const useAuthStore = defineStore('auth', () => {
  // --- State ---
  const user = ref(null);
  const token = ref(localStorage.getItem('zauberjournal-token') || localStorage.getItem('ai-cookbook-token') || null);

  // Alten localStorage-Key migrieren
  if (localStorage.getItem('ai-cookbook-token') && !localStorage.getItem('zauberjournal-token')) {
    localStorage.setItem('zauberjournal-token', localStorage.getItem('ai-cookbook-token'));
    localStorage.removeItem('ai-cookbook-token');
  }
  const loading = ref(false);

  // --- Getters ---
  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'admin');
  const displayName = computed(() => user.value?.display_name || user.value?.username || 'Gast');

  /**
   * Benutzer registrieren
   */
  async function register(username, email, password, displayName) {
    loading.value = true;
    try {
      const data = await apiRaw('/auth/register', {
        method: 'POST',
        body: { username, email, password, display_name: displayName },
      });
      setAuth(data.token, data.user);
      return data;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Benutzer anmelden
   */
  async function login(loginStr, password) {
    loading.value = true;
    try {
      const data = await apiRaw('/auth/login', {
        method: 'POST',
        body: { login: loginStr, password },
      });
      setAuth(data.token, data.user);
      return data;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Auth-Status prüfen (beim App-Start)
   * Offline: Token behalten und darauf vertrauen, statt auszuloggen.
   */
  async function checkAuth() {
    if (!token.value) return;

    // Offline → Token vertrauen, nicht prüfen
    if (!navigator.onLine) return;

    try {
      const data = await apiRaw('/auth/me');
      user.value = data.user;
    } catch (err) {
      // Netzwerkfehler → Token behalten (könnte noch gültig sein)
      const msg = err?.message || '';
      const isNetworkError = !navigator.onLine
        || msg.includes('nicht erreichbar')
        || msg.includes('Failed to fetch')
        || msg.includes('NetworkError')
        || msg.includes('Load failed');
      if (isNetworkError) return;

      // Token tatsächlich ungültig → abmelden
      logout();
    }
  }

  /**
   * Abmelden
   */
  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('zauberjournal-token');
    localStorage.removeItem('ai-cookbook-token');
  }

  /**
   * Auth-Daten setzen und Token persistieren.
   * Bei Re-Login nach Token-Ablauf: authExpired zurücksetzen und Queue erneut verarbeiten.
   */
  function setAuth(newToken, userData) {
    token.value = newToken;
    user.value = userData;
    localStorage.setItem('zauberjournal-token', newToken);

    // Falls Token abgelaufen war → Sync-Queue erneut anstoßen
    import('@/services/syncManager.js').then(({ syncManager }) => {
      if (syncManager.authExpired.value) {
        syncManager.clearAuthExpired();
        syncManager.processQueue();
      }
    });
  }

  return {
    user,
    token,
    loading,
    isLoggedIn,
    isAdmin,
    displayName,
    register,
    login,
    checkAuth,
    logout,
  };
});
