/**
 * ============================================
 * Einkaufslisten-Service
 * ============================================
 *
 * Generiert optimierte Einkaufslisten aus dem Wochenplan:
 * - Fasst gleiche Zutaten zusammen
 * - Rechnet Mengen um (Portionsanpassung)
 * - Zieht Vorratsschrank-Bestände ab
 * - Berechnet Überschuss für den Vorratsschrank
 */

import db from '../config/database.js';
import { convertToBaseUnit, normalizeUnit, scaleIngredient } from '../utils/helpers.js';

/**
 * Generiert eine Einkaufsliste aus einem Wochenplan
 * @param {number} userId - Benutzer-ID
 * @param {number} mealPlanId - Wochenplan-ID
 * @returns {object} - Einkaufsliste mit zusammengefassten Zutaten
 */
export function generateShoppingList(userId, mealPlanId) {
  // --- 1. Alle Rezepte und Portionen aus dem Wochenplan laden ---
  const entries = db.prepare(`
    SELECT
      mpe.recipe_id,
      mpe.servings as planned_servings,
      r.servings as original_servings,
      r.title as recipe_title
    FROM meal_plan_entries mpe
    JOIN recipes r ON mpe.recipe_id = r.id
    WHERE mpe.meal_plan_id = ?
  `).all(mealPlanId);

  // --- 2. Zutaten sammeln und Mengen umrechnen ---
  const ingredientMap = new Map(); // Key: normalisierter Name + Einheit

  for (const entry of entries) {
    const ingredients = db.prepare(
      'SELECT * FROM ingredients WHERE recipe_id = ?'
    ).all(entry.recipe_id);

    for (const ing of ingredients) {
      // Menge auf geplante Portionen umrechnen
      const scaledAmount = ing.amount
        ? scaleIngredient(ing.amount, entry.original_servings, entry.planned_servings)
        : null;

      // In Basiseinheit konvertieren für Zusammenfassung
      const normalized = ing.amount
        ? convertToBaseUnit(scaledAmount, ing.unit)
        : { amount: null, unit: normalizeUnit(ing.unit) };

      const key = `${ing.name.toLowerCase()}_${normalized.unit}`;

      if (ingredientMap.has(key)) {
        const existing = ingredientMap.get(key);
        existing.amount = (existing.amount || 0) + (normalized.amount || 0);
        existing.recipes.push(entry.recipe_title);
      } else {
        ingredientMap.set(key, {
          name: ing.name,
          amount: normalized.amount,
          unit: normalized.unit,
          recipes: [entry.recipe_title],
          isOptional: ing.is_optional,
        });
      }
    }
  }

  // --- 3. Vorräte abziehen ---
  const pantryItems = db.prepare(
    'SELECT * FROM pantry WHERE user_id = ? AND amount > 0'
  ).all(userId);

  const adjustedItems = [];

  for (const [key, item] of ingredientMap) {
    let remainingAmount = item.amount;
    let pantryDeducted = 0;

    // Passende Vorräte suchen
    const matchingPantry = pantryItems.find(
      p => p.ingredient_name.toLowerCase() === item.name.toLowerCase()
    );

    if (matchingPantry && remainingAmount) {
      const pantryConverted = convertToBaseUnit(matchingPantry.amount, matchingPantry.unit);

      if (pantryConverted.unit === item.unit) {
        // Vorrat abziehen
        const deduction = Math.min(pantryConverted.amount, remainingAmount);
        remainingAmount -= deduction;
        pantryDeducted = deduction;
      }
    }

    adjustedItems.push({
      ...item,
      originalAmount: item.amount,
      amount: Math.max(0, remainingAmount || 0),
      pantryDeducted,
      needsToBuy: remainingAmount > 0,
    });
  }

  return {
    items: adjustedItems.sort((a, b) => {
      // Nicht benötigte Items ans Ende
      if (a.needsToBuy !== b.needsToBuy) return a.needsToBuy ? -1 : 1;
      return a.name.localeCompare(b.name, 'de');
    }),
    totalItems: adjustedItems.length,
    itemsToBuy: adjustedItems.filter(i => i.needsToBuy).length,
  };
}

/**
 * Speichert die Einkaufsliste in der Datenbank
 */
export function saveShoppingList(userId, mealPlanId, items, name = 'Einkaufsliste') {
  const insertList = db.prepare(
    'INSERT INTO shopping_lists (user_id, meal_plan_id, name) VALUES (?, ?, ?)'
  );
  const insertItem = db.prepare(`
    INSERT INTO shopping_list_items
    (shopping_list_id, ingredient_name, amount, unit, recipe_id, pantry_deducted)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Alte aktive Listen deaktivieren
  db.prepare(
    'UPDATE shopping_lists SET is_active = 0 WHERE user_id = ? AND is_active = 1'
  ).run(userId);

  const transaction = db.transaction(() => {
    const { lastInsertRowid: listId } = insertList.run(userId, mealPlanId, name);

    for (const item of items) {
      if (item.needsToBuy) {
        insertItem.run(listId, item.name, item.amount, item.unit, null, item.pantryDeducted);
      }
    }

    return listId;
  });

  return transaction();
}

/**
 * Verarbeitet den Einkauf: Überschüsse in den Vorratsschrank
 * @param {number} userId - Benutzer-ID
 * @param {number} listId - Einkaufslisten-ID
 * @param {object[]} purchasedItems - Tatsächlich gekaufte Items mit REWE-Mengen
 */
export function processPurchase(userId, listId, purchasedItems) {
  const updateItem = db.prepare(
    'UPDATE shopping_list_items SET is_checked = 1, rewe_product_name = ?, rewe_price = ?, rewe_package_size = ? WHERE id = ?'
  );
  const upsertPantry = db.prepare(`
    INSERT INTO pantry (user_id, ingredient_name, amount, unit, category)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, ingredient_name) DO UPDATE SET
      amount = pantry.amount + excluded.amount,
      updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = db.transaction(() => {
    for (const item of purchasedItems) {
      // Einkaufsitem aktualisieren
      updateItem.run(item.reweProductName, item.rewePrice, item.rewePackageSize, item.itemId);

      // Überschuss in Vorratsschrank
      if (item.surplus > 0) {
        upsertPantry.run(userId, item.name, item.surplus, item.unit, item.category || 'Sonstiges');
      }
    }
  });

  transaction();
}
