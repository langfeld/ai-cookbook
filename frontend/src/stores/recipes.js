/**
 * ============================================
 * Recipes Store - Rezeptverwaltung
 * ============================================
 * CRUD-Operationen, Foto-Import und Filterung von Rezepten.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '@/composables/useApi.js';
import { useAuthStore } from '@/stores/auth.js';

export const useRecipesStore = defineStore('recipes', () => {
  // --- State ---
  const recipes = ref([]);
  const currentRecipe = ref(null);
  const categories = ref([]);
  const loading = ref(false);
  const filters = ref({
    search: '',
    category: '',
    favorite: null,
    difficulty: '',
    collectionId: '',
    sort: 'created_at',
    order: 'desc',
  });

  // --- Getters ---
  const totalRecipes = computed(() => recipes.value.length);
  const favoriteRecipes = computed(() => recipes.value.filter(r => r.is_favorite));
  const recentRecipes = computed(() =>
    [...recipes.value].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5)
  );

  // --- Actions ---
  const api = useApi();

  /** Alle Rezepte laden (mit Filtern) */
  async function fetchRecipes() {
    loading.value = true;
    try {
      const params = new URLSearchParams();
      if (filters.value.search) params.set('search', filters.value.search);
      if (filters.value.category) params.set('category', filters.value.category);
      if (filters.value.favorite !== null) params.set('favorite', filters.value.favorite);
      if (filters.value.difficulty) params.set('difficulty', filters.value.difficulty);
      if (filters.value.collectionId) params.set('collectionId', filters.value.collectionId);
      params.set('sort', filters.value.sort);
      params.set('order', filters.value.order);

      const data = await api.get(`/recipes?${params}`);
      recipes.value = data.recipes;
      return data;
    } finally {
      loading.value = false;
    }
  }

  /** Einzelnes Rezept mit allen Details laden */
  async function fetchRecipe(id) {
    loading.value = true;
    try {
      const data = await api.get(`/recipes/${id}`);
      currentRecipe.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  /** Rezept erstellen */
  async function createRecipe(recipeData) {
    const data = await api.post('/recipes', recipeData);
    await fetchRecipes(); // Liste aktualisieren
    return data;
  }

  /** Rezept aktualisieren */
  async function updateRecipe(id, recipeData) {
    const data = await api.put(`/recipes/${id}`, recipeData);
    await fetchRecipes();
    return data;
  }

  /** Rezept löschen */
  async function deleteRecipe(id) {
    await api.del(`/recipes/${id}`);
    recipes.value = recipes.value.filter(r => r.id !== id);
  }

  /** Mehrere Rezepte auf einmal löschen (Admin) */
  async function deleteRecipesBatch(ids) {
    const data = await api.post('/recipes/batch-delete', { ids });
    recipes.value = recipes.value.filter(r => !ids.includes(r.id));
    return data;
  }

  /** Rezept per Foto(s) importieren – unterstützt mehrere Seiten */
  async function importFromPhoto(files) {
    const formData = new FormData();
    // Unterstützt einzelne Datei oder Array von Dateien
    const fileList = Array.isArray(files) ? files : [files];
    for (const file of fileList) {
      formData.append('file', file);
    }
    try {
      const data = await api.upload('/recipes/import-photo', formData);
      await fetchRecipes();
      return data;
    } catch (err) {
      // Rezeptliste trotzdem aktualisieren — der Server hat das Rezept
      // möglicherweise gespeichert, obwohl die Antwort nicht ankam
      await fetchRecipes().catch(() => {});
      throw err;
    }
  }

  /** Rezept per Text importieren */
  async function importFromText(text) {
    try {
      const data = await api.post('/recipes/import-text', { text });
      await fetchRecipes();
      return data;
    } catch (err) {
      await fetchRecipes().catch(() => {});
      throw err;
    }
  }

  /** Rezept per URL importieren */
  async function importFromUrl(url) {
    try {
      const data = await api.post('/recipes/import-url', { url });
      await fetchRecipes();
      return data;
    } catch (err) {
      await fetchRecipes().catch(() => {});
      throw err;
    }
  }

  /** Favorit umschalten */
  async function toggleFavorite(id) {
    const data = await api.post(`/recipes/${id}/favorite`);
    const recipe = recipes.value.find(r => r.id === id);
    if (recipe) recipe.is_favorite = data.is_favorite ? 1 : 0;
    return data;
  }

  /** Als gekocht markieren */
  async function markAsCooked(id, details = {}) {
    return await api.post(`/recipes/${id}/cooked`, details);
  }

  /** Kategorien laden */
  async function fetchCategories() {
    const data = await api.get('/categories');
    categories.value = data.categories;
    return data;
  }

  /** Kategorie erstellen */
  async function createCategory(categoryData) {
    const data = await api.post('/categories', categoryData);
    await fetchCategories();
    return data;
  }

  /** Rezepte als JSON exportieren */
  async function exportRecipes(includeImages = false) {
    const authStore = useAuthStore();
    const params = includeImages ? '?include_images=true' : '';
    const response = await fetch(`/api/recipes/export${params}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (!response.ok) throw new Error('Export fehlgeschlagen');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rezepte-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Rezepte aus JSON-Datei importieren */
  async function importRecipes(file) {
    const formData = new FormData();
    formData.append('file', file);
    const data = await api.upload('/recipes/import', formData);
    await fetchRecipes();
    return data;
  }

  return {
    recipes, currentRecipe, categories, loading, filters,
    totalRecipes, favoriteRecipes, recentRecipes,
    fetchRecipes, fetchRecipe, createRecipe, updateRecipe, deleteRecipe, deleteRecipesBatch,
    importFromPhoto, importFromText, importFromUrl, toggleFavorite, markAsCooked,
    fetchCategories, createCategory, exportRecipes, importRecipes,
  };
});
