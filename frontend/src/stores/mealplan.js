/**
 * ============================================
 * MealPlan Store - Wochenplan-Verwaltung
 * ============================================
 * Pinia Store mit Wochen-Navigation, Generierung,
 * Rezepttausch, Drag & Drop und Gekocht-Status.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useApi } from '@/composables/useApi.js';

export const useMealPlanStore = defineStore('mealplan', () => {
  const currentPlan = ref(null);
  const reasoning = ref(null);
  const planHistory = ref([]);
  const loading = ref(false);
  const generating = ref(false);

  const api = useApi();

  const mealTypeLabels = {
    fruehstueck: '🌅 Frühstück',
    mittag: '☀️ Mittagessen',
    abendessen: '🌙 Abendessen',
    snack: '🍿 Snack',
  };

  /** Wochenplan generieren */
  async function generatePlan(options = {}) {
    generating.value = true;
    try {
      const data = await api.post('/mealplan/generate', options);
      currentPlan.value = data.plan;
      reasoning.value = data.reasoning || null;
      return data;
    } finally {
      generating.value = false;
    }
  }

  /** Wochenplan für bestimmte Woche laden */
  async function fetchCurrentPlan(weekStart) {
    loading.value = true;
    try {
      const params = weekStart ? `?weekStart=${weekStart}` : '';
      const data = await api.get(`/mealplan${params}`);
      currentPlan.value = data.plan;
      reasoning.value = data.plan?.reasoning || null;
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

  /** Rezeptvorschläge für einen Slot */
  async function fetchSuggestions({ dayIdx, mealType, excludeRecipeIds = [], planId = null }) {
    const params = new URLSearchParams({ dayIdx, mealType, limit: 8 });
    if (excludeRecipeIds.length) params.set('excludeRecipeIds', excludeRecipeIds.join(','));
    if (planId) params.set('planId', planId);
    const data = await api.get(`/mealplan/suggestions?${params}`);
    return data.suggestions;
  }

  /** Eintrag als gekocht togglen */
  async function markCooked(planId, entryId) {
    const data = await api.post(`/mealplan/${planId}/entry/${entryId}/cooked`);
    // Lokalen State aktualisieren
    if (currentPlan.value?.entries) {
      const entry = currentPlan.value.entries.find(e => e.id === entryId);
      if (entry) entry.is_cooked = data.is_cooked;
    }
    return data;
  }

  /** Rezept eines Eintrags tauschen */
  async function swapRecipe(planId, entryId, newRecipeId) {
    const data = await api.put(`/mealplan/${planId}/entry/${entryId}`, { recipe_id: newRecipeId });
    // Lokalen Entry aktualisieren
    if (currentPlan.value?.entries && data.entry) {
      const idx = currentPlan.value.entries.findIndex(e => e.id === entryId);
      if (idx !== -1) currentPlan.value.entries[idx] = data.entry;
    }
    return data;
  }

  /** Neuen Eintrag in einem leeren Slot hinzufügen */
  async function addEntry(planId, recipeId, dayOfWeek, mealType, servings = 4) {
    const data = await api.post(`/mealplan/${planId}/entry`, {
      recipe_id: recipeId,
      day_of_week: dayOfWeek,
      meal_type: mealType,
      servings,
    });
    if (currentPlan.value?.entries && data.entry) {
      currentPlan.value.entries.push(data.entry);
    }
    return data;
  }

  /** Rezept manuell zum Wochenplan hinzufügen (erstellt Plan automatisch) */
  async function addRecipeToPlan(recipeId, dayOfWeek, mealType, weekStart, servings = 4) {
    const data = await api.post('/mealplan/add-recipe', {
      recipe_id: recipeId,
      day_of_week: dayOfWeek,
      meal_type: mealType,
      week_start: weekStart,
      servings,
    });
    // Wenn der aktuelle Plan betroffen ist, aktualisieren
    if (data.plan && currentPlan.value?.week_start === weekStart) {
      currentPlan.value = data.plan;
    }
    return data;
  }

  /** Eintrag per Drag & Drop verschieben */
  async function moveEntry(planId, entryId, dayOfWeek, mealType) {
    const data = await api.post(`/mealplan/${planId}/entry/${entryId}/move`, {
      day_of_week: dayOfWeek,
      meal_type: mealType,
    });
    if (data.plan) currentPlan.value = data.plan;
    return data;
  }

  /** Einzelnen Eintrag entfernen */
  async function removeEntry(planId, entryId) {
    await api.del(`/mealplan/${planId}/entry/${entryId}`);
    if (currentPlan.value?.entries) {
      currentPlan.value.entries = currentPlan.value.entries.filter(e => e.id !== entryId);
    }
  }

  /** Gesamten Plan löschen */
  async function deletePlan(planId) {
    await api.del(`/mealplan/${planId}`);
    currentPlan.value = null;
  }

  return {
    currentPlan, reasoning, planHistory, loading, generating,
    mealTypeLabels,
    generatePlan, fetchCurrentPlan, fetchHistory,
    fetchSuggestions, markCooked, swapRecipe, addEntry, addRecipeToPlan, moveEntry, removeEntry, deletePlan,
  };
});
