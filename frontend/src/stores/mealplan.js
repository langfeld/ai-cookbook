/**
 * ============================================
 * MealPlan Store - Wochenplan-Verwaltung
 * ============================================
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '@/composables/useApi.js';

export const useMealPlanStore = defineStore('mealplan', () => {
  const currentPlan = ref(null);
  const planHistory = ref([]);
  const loading = ref(false);
  const generating = ref(false);

  const api = useApi();

  // Tagesnamen für die Anzeige
  const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const mealTypeLabels = {
    fruehstueck: '🌅 Frühstück',
    mittag: '☀️ Mittagessen',
    abendessen: '🌙 Abendessen',
    snack: '🍿 Snack',
  };

  /** Wochenplan generieren (Algorithmus + optionales KI-Reasoning) */
  async function generatePlan(options = {}) {
    generating.value = true;
    try {
      const data = await api.post('/mealplan/generate', options);
      // Plan aus der DB laden für konsistente Datenstruktur mit entries
      await fetchCurrentPlan();
      return data;
    } finally {
      generating.value = false;
    }
  }

  /** Aktuellen Wochenplan laden */
  async function fetchCurrentPlan(weekStart) {
    loading.value = true;
    try {
      const params = weekStart ? `?weekStart=${weekStart}` : '';
      const data = await api.get(`/mealplan${params}`);
      currentPlan.value = data.plan;
      return data;
    } finally {
      loading.value = false;
    }
  }

  /** Plan-Historie laden */
  async function fetchHistory() {
    const data = await api.get('/mealplan/history');
    planHistory.value = data.plans;
    return data;
  }

  /** Eintrag als gekocht markieren */
  async function markCooked(planId, entryId) {
    return await api.post(`/mealplan/${planId}/entry/${entryId}/cooked`);
  }

  /** Eintrag ändern (Rezept tauschen) */
  async function updateEntry(planId, entryId, data) {
    return await api.put(`/mealplan/${planId}/entry/${entryId}`, data);
  }

  return {
    currentPlan, planHistory, loading, generating,
    dayNames, mealTypeLabels,
    generatePlan, fetchCurrentPlan, fetchHistory, markCooked, updateEntry,
  };
});
