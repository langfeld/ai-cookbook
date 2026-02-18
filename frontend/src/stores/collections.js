/**
 * ============================================
 * Collections Store – Sammlungs-Verwaltung
 * ============================================
 * CRUD für Sammlungen + Rezept-Zuordnung.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '@/composables/useApi.js';

export const useCollectionsStore = defineStore('collections', () => {
  const collections = ref([]);
  const loading = ref(false);

  const api = useApi();

  const totalCollections = computed(() => collections.value.length);

  /** Alle Sammlungen laden */
  async function fetchCollections() {
    loading.value = true;
    try {
      const data = await api.get('/collections');
      collections.value = data.collections;
      return data;
    } finally {
      loading.value = false;
    }
  }

  /** Neue Sammlung erstellen */
  async function createCollection({ name, icon, color }) {
    const data = await api.post('/collections', { name, icon, color });
    collections.value.push(data.collection);
    return data;
  }

  /** Sammlung bearbeiten */
  async function updateCollection(id, updates) {
    const data = await api.put(`/collections/${id}`, updates);
    const idx = collections.value.findIndex(c => c.id === id);
    if (idx !== -1) collections.value[idx] = data.collection;
    return data;
  }

  /** Sammlung löschen */
  async function deleteCollection(id) {
    await api.del(`/collections/${id}`);
    collections.value = collections.value.filter(c => c.id !== id);
  }

  /** Rezepte zu Sammlung hinzufügen */
  async function addRecipes(collectionId, recipeIds) {
    const data = await api.post(`/collections/${collectionId}/recipes`, { recipeIds });
    // recipe_count aktualisieren
    const col = collections.value.find(c => c.id === collectionId);
    if (col) col.recipe_count = (col.recipe_count || 0) + data.addedCount;
    return data;
  }

  /** Rezept aus Sammlung entfernen */
  async function removeRecipe(collectionId, recipeId) {
    await api.del(`/collections/${collectionId}/recipes/${recipeId}`);
    const col = collections.value.find(c => c.id === collectionId);
    if (col && col.recipe_count > 0) col.recipe_count--;
  }

  /** Sammlungen eines Rezepts laden */
  async function fetchCollectionsForRecipe(recipeId) {
    const data = await api.get(`/collections/for-recipe/${recipeId}`);
    return data.collections;
  }

  return {
    collections, loading, totalCollections,
    fetchCollections, createCollection, updateCollection, deleteCollection,
    addRecipes, removeRecipe, fetchCollectionsForRecipe,
  };
});
