/**
 * ============================================
 * Sync Handlers
 * ============================================
 * Registriert die konkreten API-Call-Handler für
 * jede offline-fähige Action im Sync-Manager.
 */

import { syncManager } from './syncManager.js';
import { apiRaw } from '@/composables/useApi.js';

/**
 * Alle Sync-Handler registrieren.
 * Jeder Handler führt den reinen API-Call aus (ohne Optimistic UI).
 */
export function registerSyncHandlers() {
  // ── Shopping ──

  syncManager.registerHandler('shopping:toggleItem', async ({ itemId, is_checked }) => {
    await apiRaw(`/shopping/item/${itemId}/check`, {
      method: 'PUT',
      body: { is_checked },
    });
  });

  syncManager.registerHandler('shopping:addItem', async ({ ingredient_name, amount, unit }) => {
    await apiRaw('/shopping/item/add', {
      method: 'POST',
      body: { ingredient_name, amount, unit },
    });
  });

  syncManager.registerHandler('shopping:deleteItem', async ({ itemId }) => {
    await apiRaw(`/shopping/item/${itemId}`, {
      method: 'DELETE',
    });
  });

  // ── Mealplan ──

  syncManager.registerHandler('mealplan:markCooked', async ({ planId, entryId, is_cooked }) => {
    await apiRaw(`/mealplan/${planId}/entry/${entryId}/cooked`, {
      method: 'POST',
      body: { is_cooked },
    });
  });

  syncManager.registerHandler('mealplan:updateServings', async ({ planId, entryId, servings }) => {
    await apiRaw(`/mealplan/${planId}/entry/${entryId}`, {
      method: 'PUT',
      body: { servings },
    });
  });
}
