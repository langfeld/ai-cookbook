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
export function generateShoppingList(userId, mealPlanId, options = {}) {
  const { excludePastDays = false } = options;

  // --- 1. Alle Rezepte und Portionen aus dem Wochenplan laden ---
  const entries = db.prepare(`
    SELECT
      mpe.recipe_id,
      mpe.servings as planned_servings,
      mpe.day_of_week,
      r.servings as original_servings,
      r.title as recipe_title
    FROM meal_plan_entries mpe
    JOIN recipes r ON mpe.recipe_id = r.id
    WHERE mpe.meal_plan_id = ?
  `).all(mealPlanId);

  // Vergangene Tage herausfiltern (optional)
  let filteredEntries = entries;
  let skippedDays = 0;
  if (excludePastDays) {
    const plan = db.prepare('SELECT week_start FROM meal_plans WHERE id = ?').get(mealPlanId);
    if (plan?.week_start) {
      const weekStart = new Date(plan.week_start + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // Tage seit Wochenbeginn berechnen
      const diffMs = today.getTime() - weekStart.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      // Nur filtern wenn wir innerhalb der Woche sind (0-6)
      if (diffDays > 0 && diffDays <= 6) {
        const beforeCount = filteredEntries.length;
        filteredEntries = filteredEntries.filter(e => e.day_of_week >= diffDays);
        skippedDays = diffDays;
        console.log(`📅 ${beforeCount - filteredEntries.length} Einträge von ${skippedDays} vergangenen Tagen übersprungen`);
      }
    }
  }

  // --- 2. Zutaten sammeln und Mengen umrechnen ---
  const ingredientMap = new Map(); // Key: normalisierter Name + Einheit

  for (const entry of filteredEntries) {
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
        if (!existing.recipeIds.includes(entry.recipe_id)) {
          existing.recipeIds.push(entry.recipe_id);
        }
      } else {
        ingredientMap.set(key, {
          name: ing.name,
          amount: normalized.amount,
          unit: normalized.unit,
          recipes: [entry.recipe_title],
          recipeIds: [entry.recipe_id],
          isOptional: ing.is_optional,
        });
      }
    }
  }

  // --- 2b. Zweiter Konsolidierungsschritt: ---
  // Gleiche Zutat mit unterschiedlichen, inkompatiblen Einheiten zusammenführen
  // z.B. "Halloumi 200g" + "Halloumi 1 Stk" → zusammenlegen
  const consolidatedMap = new Map();
  for (const [key, item] of ingredientMap) {
    const nameKey = item.name.toLowerCase();

    if (consolidatedMap.has(nameKey)) {
      const existing = consolidatedMap.get(nameKey);

      if (existing.unit === item.unit) {
        // Gleiche Einheit → Mengen addieren
        existing.amount = (existing.amount || 0) + (item.amount || 0);
      } else {
        // Unterschiedliche Einheiten → die mit der größeren Menge bevorzugen,
        // oder die Stück-Einheit wenn es Zähl-Einheiten sind
        // Mengenangaben einfach addieren, Einheit der größeren Menge behalten
        const existingAmount = existing.amount || 0;
        const newAmount = item.amount || 0;
        existing.amount = existingAmount + newAmount;
        // Die informativere/größere Einheit behalten
        if (newAmount > existingAmount && item.unit) {
          existing.unit = item.unit;
        }
      }

      // Rezepte zusammenführen
      for (const title of item.recipes) {
        existing.recipes.push(title);
      }
      for (const id of item.recipeIds) {
        if (!existing.recipeIds.includes(id)) {
          existing.recipeIds.push(id);
        }
      }
    } else {
      consolidatedMap.set(nameKey, { ...item });
    }
  }

  // --- 3. Vorräte abziehen ---
  const pantryItems = db.prepare(
    'SELECT * FROM pantry WHERE user_id = ? AND (amount > 0 OR is_permanent = 1)'
  ).all(userId);

  const adjustedItems = [];

  for (const [key, item] of consolidatedMap) {
    let remainingAmount = item.amount;
    let pantryDeducted = 0;

    // Passende Vorräte suchen
    const matchingPantry = pantryItems.find(
      p => p.ingredient_name.toLowerCase() === item.name.toLowerCase()
    );

    if (matchingPantry && remainingAmount) {
      if (matchingPantry.is_permanent) {
        // Dauerhaft verfügbar → komplett abziehen, Bestand bleibt unverändert
        pantryDeducted = remainingAmount;
        remainingAmount = 0;
      } else {
        const pantryConverted = convertToBaseUnit(matchingPantry.amount, matchingPantry.unit);

        if (pantryConverted.unit === item.unit) {
          // Vorrat abziehen
          const deduction = Math.min(pantryConverted.amount, remainingAmount);
          remainingAmount -= deduction;
          pantryDeducted = deduction;
        }
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
    skippedDays,
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
    (shopping_list_id, ingredient_name, amount, unit, recipe_id, pantry_deducted, recipe_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Alte aktive Listen deaktivieren
  db.prepare(
    'UPDATE shopping_lists SET is_active = 0 WHERE user_id = ? AND is_active = 1'
  ).run(userId);

  const transaction = db.transaction(() => {
    const { lastInsertRowid: listId } = insertList.run(userId, mealPlanId, name);

    for (const item of items) {
      if (item.needsToBuy) {
        insertItem.run(
          listId, item.name, item.amount, item.unit, null,
          item.pantryDeducted, JSON.stringify(item.recipeIds || [])
        );
      }
    }

    return listId;
  });

  return transaction();
}

/**
 * Verarbeitet den Einkauf: Gekaufte Items in den Vorratsschrank
 * @param {number} userId - Benutzer-ID
 * @param {number} listId - Einkaufslisten-ID
 * @param {object[]} purchasedItems - Gekaufte Items (abgehakte Artikel)
 */
export function processPurchase(userId, listId, purchasedItems) {
  const upsertPantry = db.prepare(`
    INSERT INTO pantry (user_id, ingredient_name, amount, unit, category)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, ingredient_name) DO UPDATE SET
      amount = pantry.amount + excluded.amount,
      updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = db.transaction(() => {
    for (const item of purchasedItems) {
      if (item.amount > 0) {
        upsertPantry.run(
          userId,
          item.ingredient_name || item.name,
          item.amount,
          item.unit || 'Stk',
          item.category || 'Sonstiges'
        );
      }
    }
  });

  transaction();
}
