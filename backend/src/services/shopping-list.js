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
import { convertToBaseUnit, getUnitType, normalizeUnit, scaleIngredient, unitsCompatible } from '../utils/helpers.js';
import { parsePackageSize } from './rewe-api.js';

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

  // Alias-Tabelle laden: alias_name → canonical_name
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
      // Alias auflösen: Falls der Zutatname ein Alias ist, kanonischen Namen verwenden
      const resolvedName = aliasMap.get(ing.name.toLowerCase()) || ing.name;

      // Geblockte Zutaten überspringen
      if (blockedSet.has(resolvedName.toLowerCase())) {
        continue;
      }

      // Menge auf geplante Portionen umrechnen
      const scaledAmount = ing.amount
        ? scaleIngredient(ing.amount, entry.original_servings, entry.planned_servings)
        : null;

      // In Basiseinheit konvertieren für Zusammenfassung
      const normalized = ing.amount
        ? convertToBaseUnit(scaledAmount, ing.unit)
        : { amount: null, unit: normalizeUnit(ing.unit) };

      const key = `${resolvedName.toLowerCase()}_${normalized.unit}`;

      if (ingredientMap.has(key)) {
        const existing = ingredientMap.get(key);
        existing.amount = (existing.amount || 0) + (normalized.amount || 0);
        existing.recipes.push(entry.recipe_title);
        if (!existing.recipeIds.includes(entry.recipe_id)) {
          existing.recipeIds.push(entry.recipe_id);
        }
      } else {
        ingredientMap.set(key, {
          name: resolvedName,
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
  // Gleiche Zutat mit unterschiedlichen, aber KOMPATIBLEN Einheiten zusammenführen
  // z.B. "Halloumi 200g" + "Halloumi 500g" → 700g
  // Inkompatible Einheiten (z.B. "200g" + "1 Stk") bleiben getrennt,
  // um keine sinnlosen Additionen wie "201g" zu erzeugen.
  const consolidatedMap = new Map();
  for (const [key, item] of ingredientMap) {
    const nameKey = item.name.toLowerCase();

    // Bestehenden Eintrag mit kompatiblen Einheiten suchen
    let mergedKey = null;
    for (const [cKey, existing] of consolidatedMap) {
      if (existing.name.toLowerCase() !== nameKey) continue;
      const compat = unitsCompatible(existing.unit, item.unit);
      if (compat.compatible) {
        mergedKey = cKey;
        break;
      }
    }

    if (mergedKey) {
      const existing = consolidatedMap.get(mergedKey);
      const compat = unitsCompatible(existing.unit, item.unit);

      // Mengen addieren (mit Umrechnungsfaktor, z.B. g↔ml)
      existing.amount = (existing.amount || 0) + (item.amount || 0) * compat.factor;

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
      // Kein kompatibler Eintrag → separat aufnehmen
      consolidatedMap.set(`${nameKey}_${item.unit || 'none'}`, { ...item });
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
    let pantryNote = null;

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

        // Kompatibilität prüfen (g===g, oder g↔ml mit Näherung 1:1)
        const compat = unitsCompatible(pantryConverted.unit, item.unit);
        if (compat.compatible) {
          const adjustedPantryAmount = pantryConverted.amount * compat.factor;
          const deduction = Math.min(adjustedPantryAmount, remainingAmount);
          remainingAmount -= deduction;
          pantryDeducted = deduction;
        } else {
          // Vorrat vorhanden aber Einheiten inkompatibel (z.B. 500g vs 2 Stk)
          // → Hinweis setzen, damit der Nutzer informiert wird
          pantryNote = `Im Vorrat: ${matchingPantry.amount} ${matchingPantry.unit || ''} (andere Einheit)`.trim();
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
 * Verarbeitet den Einkauf: Gekaufte Items in den Vorratsschrank
 *
 * Wenn ein REWE-Produkt zugeordnet wurde, wird die tatsächlich gekaufte Menge
 * (Packungsgröße × Anzahl Packungen) verwendet, nicht die Rezeptmenge.
 * Beispiel: Rezept braucht 500g Kartoffeln → REWE 3kg-Sack gewählt → 3000g im Vorrat.
 *
 * Bei inkompatiblen Einheiten (z.B. 2 Stk + 500g) wird NICHT blind addiert,
 * da sonst unsinnige Werte entstehen (z.B. 502g). Stattdessen wird:
 * - Gewicht/Volumen bevorzugt (präziser als Zähleinheiten)
 * - Bei Zähl- vs. Gewichtskonflikt nur aktualisiert, wenn die neue Einheit präziser ist
 *
 * @param {number} userId - Benutzer-ID
 * @param {number} listId - Einkaufslisten-ID
 * @param {object[]} purchasedItems - Gekaufte Items (mit optionalen REWE-Daten)
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
      let unit = item.unit || 'Stk';

      // Wenn REWE-Produkt zugeordnet: tatsächlich gekaufte Menge berechnen
      if (item.rewe_package_size) {
        const parsed = parsePackageSize(item.rewe_package_size);
        if (parsed.amount && parsed.unit) {
          const reweQty = item.rewe_quantity || 1;
          let totalPurchased = parsed.amount * reweQty; // z.B. 3000g bei "3kg"-Sack
          let purchasedUnit = parsed.unit;               // parsePackageSize liefert immer g / ml

          // Einheit an die Rezept-/Listen-Einheit angleichen
          const origUnit = (item.unit || '').toLowerCase();
          if (origUnit === 'kg' && purchasedUnit === 'g') {
            totalPurchased /= 1000;
            purchasedUnit = 'kg';
          } else if (origUnit === 'l' && purchasedUnit === 'ml') {
            totalPurchased /= 1000;
            purchasedUnit = 'l';
          }

          amount = totalPurchased;
          unit = purchasedUnit;
        }
      }
      unit = normalizeUnit(unit);

      if (amount > 0) {
        const ingredientName = item.ingredient_name || item.name;
        const category = item.category || 'Sonstiges';
        const existing = getExistingPantry.get(userId, ingredientName);

        if (!existing) {
          // Kein bestehender Eintrag → einfach einfügen
          upsertPantry.run(userId, ingredientName, amount, unit, category);
        } else {
          // Bestehender Eintrag → Einheiten auf Kompatibilität prüfen
          const existingConverted = convertToBaseUnit(existing.amount, existing.unit);
          const newConverted = convertToBaseUnit(amount, unit);
          const compat = unitsCompatible(existingConverted.unit, newConverted.unit);

          if (compat.compatible) {
            // Kompatible Einheiten → Mengen addieren (z.B. 500g + 200g)
            upsertPantry.run(userId, ingredientName, amount, unit, category);
          } else {
            // Inkompatible Einheiten (z.B. 500g + 2 Stk)
            const existingType = getUnitType(existing.unit);
            const newType = getUnitType(unit);

            if ((newType === 'weight' || newType === 'volume') && existingType === 'counting') {
              // Neue Daten sind präziser (Gewicht/Volumen) → bestehende Zähleinheit ersetzen
              replacePantry.run(userId, ingredientName, amount, unit, category);
            }
            // Sonst: bestehende Gewichts-/Volumendaten behalten, Zähleinheit ignorieren
            // (z.B. Vorrat hat 500g, Einkauf war "2 Stk" → 500g bleibt, da 2+500 Unsinn wäre)
          }
        }
      }
    }
  });

  transaction();
}
