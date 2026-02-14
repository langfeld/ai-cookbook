/**
 * ============================================
 * Vue Router Konfiguration
 * ============================================
 * Definiert alle Seiten/Routen der Anwendung.
 * Geschützte Routen leiten auf Login um.
 */

import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false, title: 'Anmelden' },
  },
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true, title: 'Dashboard' },
  },
  {
    path: '/recipes',
    name: 'recipes',
    component: () => import('@/views/RecipesView.vue'),
    meta: { requiresAuth: true, title: 'Rezepte' },
  },
  {
    path: '/recipes/:id',
    name: 'recipe-detail',
    component: () => import('@/views/RecipeDetailView.vue'),
    meta: { requiresAuth: true, title: 'Rezeptdetails' },
  },
  {
    path: '/recipes/new',
    name: 'recipe-new',
    component: () => import('@/views/RecipeFormView.vue'),
    meta: { requiresAuth: true, title: 'Neues Rezept' },
  },
  {
    path: '/mealplan',
    name: 'mealplan',
    component: () => import('@/views/MealPlanView.vue'),
    meta: { requiresAuth: true, title: 'Wochenplan' },
  },
  {
    path: '/shopping',
    name: 'shopping',
    component: () => import('@/views/ShoppingView.vue'),
    meta: { requiresAuth: true, title: 'Einkaufsliste' },
  },
  {
    path: '/pantry',
    name: 'pantry',
    component: () => import('@/views/PantryView.vue'),
    meta: { requiresAuth: true, title: 'Vorratsschrank' },
  },
  // --- Admin-Routen ---
  {
    path: '/admin',
    name: 'admin-dashboard',
    component: () => import('@/views/admin/AdminDashboardView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Admin Dashboard' },
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: () => import('@/views/admin/AdminUsersView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Benutzerverwaltung' },
  },
  {
    path: '/admin/settings',
    name: 'admin-settings',
    component: () => import('@/views/admin/AdminSettingsView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Systemeinstellungen' },
  },
  // Fallback: 404
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation Guard: Auth-Prüfung
router.beforeEach((to) => {
  const authStore = useAuthStore();

  // Geschützte Route ohne Login -> Login-Seite
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  // Admin-Route ohne Admin-Rolle -> Dashboard
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return { name: 'dashboard' };
  }

  // Bereits eingeloggt -> Dashboard statt Login
  if (to.name === 'login' && authStore.isLoggedIn) {
    return { name: 'dashboard' };
  }

  // Seitentitel setzen
  document.title = `${to.meta.title || 'AI Cookbook'} | AI Cookbook 🍳`;
});

export default router;
