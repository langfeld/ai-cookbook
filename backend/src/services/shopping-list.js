/**
 * ============================================
 * Einkaufslisten-Service
 * ============================================
 *
 * Generiert optimierte Einkaufslisten aus dem Wochenplan:
 * - Fasst gleiche Zutaten zusammen (identisch + KI-Aggregation)
 * - Rechnet Mengen um (Portionsanpassung)
 * - Zieht Vorratsschrank-Bestände ab
 * - Nutzt KI für intelligente Zusammenfassung verschiedener Einheiten
 */

import db from '../config/database.js';
import { normalizeUnit, scaleIngredient } from '../utils/helpers.js';
import { parsePackageSize } from './rewe-api.js';
import { getAIProvider } from './ai/provider.js';

/**
 * KI-gestützte Aggregation der Einkaufsliste.
 * Fasst gleiche Zutaten mit verschiedenen Einheiten intelligent zusammen.
 * Fallback: nur identische Einheiten addieren.
 */
async function aiAggregateItems(itemsList) {
  // Schritt 1: Identische Zutaten+Einheiten einfach addieren
  const simpleMap = new Map();
  for (const item of itemsList) {
    const key = `${item.name.toLowerCase()}_${(item.unit || '').toLowerCase()}`;
    if (simpleMap.has(key)) {
      const existing = simpleMap.get(key);
      existing.amount = (existing.amount || 0) + (item.amount || 0);
      existing.recipes.push(...item.recipes);
      for (const id of item.recipeIds) {
        if (!existing.recipeIds.includes(id)) existing.recipeIds.push(id);
      }
    } else {
      simpleMap.set(key, { ...item, recipes: [...item.recipes], recipeIds: [...item.recipeIds] });
    }
  }

  const preAggregated = [...simpleMap.values()];

  // Prüfen ob überhaupt Zusammenfassung nötig (gleiche Zutat mit verschiedenen Einheiten?)
  const nameCount = new Map();
  for (const item of preAggregated) {
    const key = item.name.toLowerCase();
    nameCount.set(key, (nameCount.get(key) || 0) + 1);
  }
  const needsAI = [...nameCount.values()].some(c => c > 1);

  if (!needsAI) {
    return preAggregated; // Keine Duplikate → KI nicht nötig
  }

  // Schritt 2: KI zusammenfassen lassen
  try {
    const ai = getAIProvider({ simple: true });

    // Nur die duplizierten Zutaten an die KI schicken
    const duplicateNames = new Set([...nameCount.entries()].filter(([, c]) => c > 1).map(([n]) => n));
    const toMerge = preAggregated.filter(i => duplicateNames.has(i.name.toLowerCase()));
    const keepAsIs = preAggregated.filter(i => !duplicateNames.has(i.name.toLowerCase()));

    const prompt = `Fasse diese Einkaufslisten-Einträge zusammen. Gleiche Zutaten mit verschiedenen Einheiten sollen zu EINEM Eintrag werden.
Wähle die natürlichste Einkaufseinheit:
- Zählbare Zutaten (Zwiebel, Tomate, Paprika, Ei, Brötchen etc.) → Stückzahl (unit: "")
- Gewichtsware (Fleisch, Käse, Mehl etc.) → g oder kg
- Flüssigkeiten → ml oder l

Eingabe:
${JSON.stringify(toMerge.map(i => ({ name: i.name, amount: i.amount, unit: i.unit })), null, 2)}

Antworte als JSON-Array:
[{ "name": "Zutatename", "amount": 3, "unit": "" }]

Regeln:
- Jede Zutat nur EINMAL in der Ausgabe
- Mengen sinnvoll umrechnen (z.B. 150g Zwiebel ≈ 1-2 Zwiebeln → 2 Zwiebeln)
- Bei Unsicherheit lieber aufrunden
- name muss exakt einem der Eingabe-Namen entsprechen`;

    const merged = await ai.chatJSON(prompt, { temperature: 0.1, maxTokens: 2048 });

    if (!Array.isArray(merged)) {
      console.warn('⚠️ KI-Aggregation: Unerwartetes Format, nutze Fallback');
      return preAggregated;
    }

    // KI-Ergebnis mit Rezept-Referenzen anreichern
    const result = [...keepAsIs];
    for (const aiItem of merged) {
      // Alle Originaleinträge dieser Zutat finden
      const originals = toMerge.filter(i => i.name.toLowerCase() === aiItem.name.toLowerCase());
      const allRecipes = originals.flatMap(o => o.recipes);
      const allRecipeIds = [...new Set(originals.flatMap(o => o.recipeIds))];
      const isOptional = originals.every(o => o.isOptional);

      result.push({
        name: aiItem.name || originals[0]?.name,
        amount: aiItem.amount,
        unit: aiItem.unit || '',
        recipes: allRecipes,
        recipeIds: allRecipeIds,
        isOptional,
      });
    }

    console.log(`🤖 KI-Aggregation: ${preAggregated.length} → ${result.length} Einträge`);
    return result;
  } catch (err) {
    console.warn('⚠️ KI-Aggregation fehlgeschlagen, nutze einfache Zusammenfassung:', err.message);
    return preAggregated;
  }
}

/**
 * Generiert eine Einkaufsliste aus einem Wochenplan
 * @param {number} userId - Benutzer-ID
 * @param {number} mealPlanId - Wochenplan-ID
 * @returns {Promise<object>} - Einkaufsliste mit zusammengefassten Zutaten
 */
export async function generateShoppingList(userId, mealPlanId, options = {}) {
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
      const diffMs = today.getTime() - weekStart.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 0 && diffDays <= 6) {
        const beforeCount = filteredEntries.length;
        filteredEntries = filteredEntries.filter(e => e.day_of_week >= diffDays);
        skippedDays = diffDays;
        console.log(`📅 ${beforeCount - filteredEntries.length} Einträge von ${skippedDays} vergangenen Tagen übersprungen`);
      }
    }
  }

  // --- 2. Zutaten sammeln und Mengen skalieren ---
  const rawItems = [];

  // Alias-Tabelle laden
  const aliasRows = db.prepare(
    'SELECT alias_name, canonical_name FROM ingredient_aliases WHERE user_id = ?'
  ).all(userId);
  const aliasMap = new Map();
  for (const row of aliasRows) {
    aliasMap.set(row.alias_name.toLowerCase(), row.canonical_name);
  }

  // Geblockte Zutaten laden
  const blockedRows = db.prepare(
    'SELECT ingredient_name FROM blocked_ingredients WHERE user_id = ?'
  ).all(userId);
  const blockedSet = new Set(blockedRows.map(r => r.ingredient_name.toLowerCase()));

  for (const entry of filteredEntries) {
    const ingredients = db.prepare(
      'SELECT * FROM ingredients WHERE recipe_id = ?'
    ).all(entry.recipe_id);

    for (const ing of ingredients) {
      const resolvedName = aliasMap.get(ing.name.toLowerCase()) || ing.name;

      if (blockedSet.has(resolvedName.toLowerCase())) continue;

      // Menge auf geplante Portionen skalieren
      const scaledAmount = ing.amount
        ? scaleIngredient(ing.amount, entry.original_servings, entry.planned_servings)
        : null;

      // Einheit normalisieren (Plural/Tippfehler bereinigen, natürliche Einheit beibehalten)
      const unit = normalizeUnit(ing.unit);

      rawItems.push({
        name: resolvedName,
        amount: scaledAmount,
        unit,
        recipes: [entry.recipe_title],
        recipeIds: [entry.recipe_id],
        isOptional: ing.is_optional,
      });
    }
  }

  // --- 2b. KI-gestützte Aggregation ---
  const aggregated = await aiAggregateItems(rawItems);

  // --- 3. Vorräte abziehen ---
  const pantryItems = db.prepare(
    'SELECT * FROM pantry WHERE user_id = ? AND (amount > 0 OR is_permanent = 1)'
  ).all(userId);

  const adjustedItems = [];

  for (const item of aggregated) {
    let remainingAmount = item.amount;
    let pantryDeducted = 0;
    let pantryNote = null;

    const matchingPantry = pantryItems.find(
      p => p.ingredient_name.toLowerCase() === item.name.toLowerCase()
    );

    if (matchingPantry && remainingAmount) {
      if (matchingPantry.is_permanent) {
        pantryDeducted = remainingAmount;
        remainingAmount = 0;
      } else {
        const pantryUnit = normalizeUnit(matchingPantry.unit);
        const itemUnit = item.unit || '';

        if (pantryUnit === itemUnit || (!pantryUnit && !itemUnit)) {
          // Identische Einheiten → direkt abziehen
          const deduction = Math.min(matchingPantry.amount, remainingAmount);
          remainingAmount -= deduction;
          pantryDeducted = deduction;
        } else if (
          (pantryUnit === 'g' && itemUnit === 'ml') || (pantryUnit === 'ml' && itemUnit === 'g')
        ) {
          // g↔ml Näherung
          const deduction = Math.min(matchingPantry.amount, remainingAmount);
          remainingAmount -= deduction;
          pantryDeducted = deduction;
        } else {
          // Inkompatible Einheiten → Hinweis
          pantryNote = `Im Vorrat: ${matchingPantry.amount} ${matchingPantry.unit || 'Stk'} (andere Einheit)`.trim();
        }
      }
    }

    adjustedItems.push({
      ...item,
      originalAmount: item.amount,
      amount: Math.max(0, remainingAmount || 0),
      pantryDeducted,
      pantryNote,
      needsToBuy: remainingAmount > 0,
    });
  }

  return {
    items: adjustedItems.sort((a, b) => {
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
    (shopping_list_id, ingredient_name, amount, unit, recipe_id, pantry_deducted, recipe_ids, pantry_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
          item.pantryDeducted, JSON.stringify(item.recipeIds || []),
          item.pantryNote || null
        );
      }
    }

    return listId;
  });

  return transaction();
}

/**
 * Verarbeitet den Einkauf: Gekaufte Items in den Vorratsschrank überführen.
 * Items werden in ihrer natürlichen Einheit in die Pantry übernommen.
 * Bei REWE-Produkten wird die tatsächlich gekaufte Menge verwendet.
 */
export function processPurchase(userId, listId, purchasedItems) {
  const upsertPantry = db.prepare(`
    INSERT INTO pantry (user_id, ingredient_name, amount, unit, category)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, ingredient_name) DO UPDATE SET
      amount = pantry.amount + excluded.amount,
      updated_at = CURRENT_TIMESTAMP
  `);

  const replacePantry = db.prepare(`
    INSERT INTO pantry (user_id, ingredient_name, amount, unit, category)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, ingredient_name) DO UPDATE SET
      amount = excluded.amount,
      unit = excluded.unit,
      updated_at = CURRENT_TIMESTAMP
  `);

  const getExistingPantry = db.prepare(
    'SELECT amount, unit FROM pantry WHERE user_id = ? AND ingredient_name = ?'
  );

  const transaction = db.transaction(() => {
    for (const item of purchasedItems) {
      let amount = item.amount;
      let unit = normalizeUnit(item.unit || '');

      // Wenn REWE-Produkt zugeordnet: tatsächlich gekaufte Menge berechnen
      if (item.rewe_package_size) {
        const parsed = parsePackageSize(item.rewe_package_size);
        if (parsed.amount && parsed.unit) {
          const reweQty = item.rewe_quantity || 1;
          amount = parsed.amount * reweQty;
          unit = parsed.unit;
        }
      }

      if (amount > 0) {
        const ingredientName = item.ingredient_name || item.name;
        const category = item.category || 'Sonstiges';
        const existing = getExistingPantry.get(userId, ingredientName);

        if (!existing) {
          upsertPantry.run(userId, ingredientName, amount, unit, category);
        } else {
          const existingUnit = normalizeUnit(existing.unit);
          if (existingUnit === unit || (!existingUnit && !unit)) {
            // Gleiche Einheit → addieren
            upsertPantry.run(userId, ingredientName, amount, unit, category);
          } else {
            // Unterschiedliche Einheiten → ersetzen mit neuerer Einheit
            replacePantry.run(userId, ingredientName, amount, unit, category);
          }
        }
      }
    }
  });

  transaction();
}
