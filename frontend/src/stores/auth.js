/**
 * ============================================
 * Auth Store - Benutzer-Authentifizierung
 * ============================================
 * Verwaltet Login-Status, Token und Benutzerinformationen.
 * Token wird in localStorage persistiert.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '@/composables/useApi.js';

export const useAuthStore = defineStore('auth', () => {
  // --- State ---
  const user = ref(null);
  const token = ref(localStorage.getItem('ai-cookbook-token') || null);
  const loading = ref(false);

  // --- Getters ---
  const isLoggedIn = computed(() => !!token.value);
  const displayName = computed(() => user.value?.display_name || user.value?.username || 'Gast');

  // --- Actions ---
  const api = useApi();

  /**
   * Benutzer registrieren
   */
  async function register(username, email, password, displayName) {
    loading.value = true;
    try {
      const data = await api.post('/auth/register', {
        username, email, password, display_name: displayName,
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
      const data = await api.post('/auth/login', { login: loginStr, password });
      setAuth(data.token, data.user);
      return data;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Auth-Status prüfen (beim App-Start)
   */
  async function checkAuth() {
    if (!token.value) return;

    try {
      const data = await api.get('/auth/me');
      user.value = data.user;
    } catch {
      // Token ungültig -> abmelden
      logout();
    }
  }

  /**
   * Abmelden
   */
  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('ai-cookbook-token');
  }

  /**
   * Auth-Daten setzen und Token persistieren
   */
  function setAuth(newToken, userData) {
    token.value = newToken;
    user.value = userData;
    localStorage.setItem('ai-cookbook-token', newToken);
  }

  return {
    user,
    token,
    loading,
    isLoggedIn,
    displayName,
    register,
    login,
    checkAuth,
    logout,
  };
});
