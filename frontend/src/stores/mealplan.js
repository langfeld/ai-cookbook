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
  const reasoningSource = ref(null); // 'ai' | 'algorithm' | null
  const reasoningLoading = ref(false); // Lädt KI-Reasoning im Hintergrund?
  const planHistory = ref([]);
  const availableWeeks = ref([]);
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
    reasoning.value = null;
    reasoningSource.value = null;
    try {
      const data = await api.post('/mealplan/generate', options);
      currentPlan.value = data.plan;
      return data;
    } finally {
      generating.value = false;
    }
  }

  /** KI-Reasoning für einen Plan per Polling abrufen */
  async function pollReasoning(planId, { maxAttempts = 20, interval = 2000 } = {}) {
    reasoningLoading.value = true;
    reasoning.value = null;
    reasoningSource.value = null;
    try {
      for (let i = 0; i < maxAttempts; i++) {
        const data = await api.get(`/mealplan/reasoning/${planId}`);
        if (data.status === 'ready') {
          reasoning.value = data.reasoning;
          reasoningSource.value = data.reasoningSource || 'ai';
          return data;
        }
        // Noch nicht fertig → warten und nochmal
        await new Promise(r => setTimeout(r, interval));
      }
      // Timeout → kein Reasoning
      console.warn('KI-Reasoning Timeout nach', maxAttempts, 'Versuchen');
    } finally {
      reasoningLoading.value = false;
    }
  }

  /** Wochenplan für bestimmte Woche laden */
  async function fetchCurrentPlan(weekStart) {
    loading.value = true;
    try {
      const params = weekStart ? `?weekStart=${weekStart}` : '';
      const data = await api.get(`/mealplan${params}`);
      currentPlan.value = data.plan;
      // Gespeichertes Reasoning aus der DB wiederherstellen
      if (data.plan?.reasoning) {
        reasoning.value = data.plan.reasoning;
        reasoningSource.value = 'ai';
      } else {
        reasoning.value = null;
        reasoningSource.value = null;
      }
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
    // Bei Tausch: kompletten Plan übernehmen (Positionen haben sich geändert)
    if (data.swapped && data.plan && currentPlan.value) {
      currentPlan.value = data.plan;
    } else if (currentPlan.value?.entries) {
      const entry = currentPlan.value.entries.find(e => e.id === entryId);
      if (entry) entry.is_cooked = data.is_cooked;
    }
    return data;
  }

  /** Portionen eines Eintrags ändern */
  async function updateServings(planId, entryId, servings) {
    const data = await api.put(`/mealplan/${planId}/entry/${entryId}`, { servings });
    if (currentPlan.value?.entries && data.entry) {
      const idx = currentPlan.value.entries.findIndex(e => e.id === entryId);
      if (idx !== -1) currentPlan.value.entries[idx] = data.entry;
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

  /** Wochenplan fixieren/freigeben */
  async function toggleLock(planId) {
    const data = await api.post(`/mealplan/${planId}/lock`);
    if (currentPlan.value && currentPlan.value.id === planId) {
      currentPlan.value.is_locked = data.is_locked;
    }
    // availableWeeks synchronisieren (für ShoppingView-Dropdown)
    const weekEntry = availableWeeks.value.find(w => w.id === planId);
    if (weekEntry) weekEntry.is_locked = data.is_locked;
    // planHistory synchronisieren (für LoadPlanDialog)
    const historyEntry = planHistory.value.find(p => p.id === planId);
    if (historyEntry) historyEntry.is_locked = data.is_locked;
    return data;
  }

  /** Verfügbare Wochen mit Plänen + Rezept-Vorschau laden */
  async function fetchAvailableWeeks() {
    const data = await api.get('/mealplan/available-weeks');
    availableWeeks.value = data.weeks;
    return data;
  }

  /** Plan auf eine andere Woche duplizieren */
  async function duplicatePlan(sourcePlanId, targetWeekStart) {
    const data = await api.post(`/mealplan/${sourcePlanId}/duplicate`, { targetWeekStart });
    // Wenn Zielwoche = aktuell angezeigte Woche, Plan aktualisieren
    if (data.plan) {
      currentPlan.value = data.plan;
    }
    return data;
  }

  return {
    currentPlan, reasoning, reasoningSource, reasoningLoading, planHistory, availableWeeks, loading, generating,
    mealTypeLabels,
    generatePlan, pollReasoning, fetchCurrentPlan, fetchHistory, fetchAvailableWeeks,
    fetchSuggestions, markCooked, updateServings, swapRecipe, addEntry, addRecipeToPlan, moveEntry, removeEntry, deletePlan,
    toggleLock, duplicatePlan,
  };
});
