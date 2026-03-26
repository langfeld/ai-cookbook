/**
 * ============================================
 * Einkaufslisten-Review Service (KI)
 * ============================================
 *
 * Prüft eine generierte Einkaufsliste mittels KI auf:
 * - Fehlende Zutaten (im Rezept, aber nicht auf der Liste)
 * - Mengen-Logik (Stück vs. Packung)
 * - Pantry-Überdeckung (Vorrat deckt Zutat bereits ab)
 * - Plausibilität (ungewöhnlich hohe/niedrige Mengen)
 * - Duplikate / Synonyme
 * - REWE-Zuordnungs-Fehler (falsches Produkt zugeordnet)
 * - Fehlende REWE-Zuordnungen
 */

import db, { householdWhereClause } from '../config/database.js';
import { getAIProvider } from './ai/provider.js';
import { getSetting } from '../config/settings.js';
import { normalizeUnit } from '../utils/helpers.js';

/**
 * Gibt den AI-Provider für den Shopping-Review zurück.
 * Über das Admin-Setting 'ai_shopping_review_instant' steuerbar.
 */
function getReviewAI() {
  const useInstant = getSetting('ai_shopping_review_instant', 'false') === 'true';
  const provider = getAIProvider(useInstant ? { simple: true } : {});
  console.log(`🔍 Shopping-Review AI: ${provider.name} [Modus: ${useInstant ? 'Instant' : 'Thinking'}]`);
  return provider;
}

/**
 * Führt einen KI-gestützten Review der aktuellen Einkaufsliste durch.
 *
 * @param {number} userId
 * @param {number|null} householdId
 * @param {number} listId - ID der Einkaufsliste
 * @returns {Promise<{ issues: Array, autoResolved: Array }>}
 */
export async function reviewShoppingList(userId, householdId, listId) {
  // --- 1. Daten laden ---

  // Einkaufslisten-Items
  const listItems = db.prepare(
    'SELECT * FROM shopping_list_items WHERE shopping_list_id = ? AND is_checked = 0'
  ).all(listId);

  if (listItems.length === 0) {
    return { issues: [], autoResolved: [] };
  }

  // Einkaufsliste (für meal_plan_id)
  const list = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(listId);
  if (!list) {
    return { issues: [], autoResolved: [] };
  }

  // Pantry-Bestand
  const pantryWhere = householdWhereClause(userId, householdId);
  const pantryItems = db.prepare(
    `SELECT * FROM pantry WHERE (${pantryWhere.clause}) AND (amount > 0 OR is_permanent = 1)`
  ).all(...pantryWhere.params);

  // Wochenplan-Rezepte mit Zutaten (wenn mit Wochenplan verknüpft)
  // Dabei werden vergangene Tage gefiltert, wenn sie beim Erstellen der Liste auch übersprungen wurden
  let recipesWithIngredients = [];
  let skippedDayInfo = null;
  if (list.meal_plan_id) {
    let entries = db.prepare(`
      SELECT DISTINCT mpe.recipe_id, r.title, r.servings, mpe.servings as planned_servings, mpe.day_of_week
      FROM meal_plan_entries mpe
      JOIN recipes r ON mpe.recipe_id = r.id
      WHERE mpe.meal_plan_id = ?
    `).all(list.meal_plan_id);

    // Vergangene Tage herausfiltern (gleiche Logik wie in generateShoppingList)
    const plan = db.prepare('SELECT week_start FROM meal_plans WHERE id = ?').get(list.meal_plan_id);
    if (plan?.week_start) {
      const weekStart = new Date(plan.week_start + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffMs = today.getTime() - weekStart.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 0 && diffDays <= 6) {
        const beforeCount = entries.length;
        entries = entries.filter(e => e.day_of_week >= diffDays);
        skippedDayInfo = { skippedDays: diffDays, skippedEntries: beforeCount - entries.length };
        console.log(`📅 KI-Review: ${skippedDayInfo.skippedEntries} Einträge von ${diffDays} vergangenen Tagen übersprungen`);
      }
    }

    for (const entry of entries) {
      const ingredients = db.prepare(
        'SELECT name, amount, unit, is_optional FROM ingredients WHERE recipe_id = ?'
      ).all(entry.recipe_id);
      recipesWithIngredients.push({
        id: entry.recipe_id,
        title: entry.title,
        servings: entry.servings,
        planned_servings: entry.planned_servings,
        ingredients,
      });
    }
  }

  // Alias-Tabelle
  const aliasWhere = householdWhereClause(userId, householdId);
  const aliasRows = db.prepare(
    `SELECT alias_name, canonical_name FROM ingredient_aliases WHERE ${aliasWhere.clause}`
  ).all(...aliasWhere.params);

  // Geblockte Zutaten
  const blockedWhere = householdWhereClause(userId, householdId);
  const blockedRows = db.prepare(
    `SELECT ingredient_name FROM blocked_ingredients WHERE ${blockedWhere.clause}`
  ).all(...blockedWhere.params);

  // --- 2. Kontext für KI aufbauen ---

  // Alias-Lookup aufbauen: alias_name (lowercase) → canonical_name, canonical_name (lowercase) → canonical_name
  const aliasLookup = new Map();
  for (const a of aliasRows) {
    aliasLookup.set(a.alias_name.toLowerCase(), a.canonical_name);
    aliasLookup.set(a.canonical_name.toLowerCase(), a.canonical_name);
  }
  /** Gibt den kanonischen Namen zurück, falls ein Alias existiert */
  function resolveAlias(name) {
    return aliasLookup.get(name.toLowerCase()) || name;
  }

  const shoppingContext = listItems.map(item => ({
    id: item.id,
    name: item.ingredient_name,
    amount: item.amount,
    unit: item.unit || '',
    rewe_product: item.rewe_product_id ? {
      name: item.rewe_product_name,
      package_size: item.rewe_package_size,
      matched_by: item.rewe_matched_by,
    } : null,
    source: item.source || 'recipe',
    pantry_deducted: item.pantry_deducted || 0,
  }));

  const pantryContext = pantryItems.map(p => ({
    name: p.ingredient_name,
    amount: p.amount,
    unit: normalizeUnit(p.unit) || '',
    is_permanent: !!p.is_permanent,
  }));

  const recipesContext = recipesWithIngredients.map(r => ({
    id: r.id,
    title: r.title,
    servings: r.servings,
    planned_servings: r.planned_servings,
    ingredients: r.ingredients.map(i => {
      const canonical = resolveAlias(i.name);
      return {
        name: i.name,
        // Kanonischer Name (= Name in der Einkaufsliste) hinzufügen, wenn abweichend
        ...(canonical !== i.name ? { canonical_name: canonical } : {}),
        amount: i.amount,
        unit: i.unit || '',
        is_optional: !!i.is_optional,
      };
    }),
  }));

  const aliasContext = aliasRows.map(a => `${a.alias_name} → ${a.canonical_name}`);
  const blockedContext = blockedRows.map(b => b.ingredient_name);

  // Prüfen ob REWE-Abgleich durchgeführt wurde (mindestens ein Item hat rewe_product_id)
  const hasReweMatching = listItems.some(i => i.rewe_product_id);

  // --- 3. KI-Review aufrufen ---
  const ai = getReviewAI();

  const prompt = `Du bist ein intelligenter Einkaufslisten-Prüfer für eine Koch-App. Analysiere die Einkaufsliste und finde Probleme.

## Einkaufsliste
${JSON.stringify(shoppingContext, null, 2)}

## Vorratsschrank (aktueller Bestand)
${JSON.stringify(pantryContext, null, 2)}

## Rezepte aus dem Wochenplan (für die diese Einkaufsliste generiert wurde)
${JSON.stringify(recipesContext, null, 2)}

## Zutaten-Aliase (bekannte Zusammenfassungen)
${aliasContext.length > 0 ? aliasContext.join('\n') : 'Keine'}
Wenn bei Rezeptzutaten ein "canonical_name" angegeben ist, wurde der Alias bereits aufgelöst – die Zutat steht unter dem canonical_name in der Einkaufsliste.

## Geblockte Zutaten (bewusst ausgeschlossen)
${blockedContext.length > 0 ? blockedContext.join(', ') : 'Keine'}

## Wichtige Grundregel: Semantische Zutatenerkennung

Beim Vergleich von Zutatennamen MUSST du semantisch denken, nicht wörtlich. Zutaten sind GLEICH wenn sie das gleiche Lebensmittel bezeichnen, auch bei:
- Anderer Wortreihenfolge: "Zwiebel rot" = "Rote Zwiebel", "Paprika gelb" = "Gelbe Paprika"
- Singular/Plural: "Tomate" = "Tomaten", "Kartoffel" = "Kartoffeln"
- Adjektiv-Variation: "Frühlingszwiebel" = "Frühlingszwiebeln" = "Lauchzwiebel"
- Abkürzungen/Varianten: "Champignons" = "Pilze (Champignon)", "Sahne" = "Schlagsahne"
- Bekannte Aliase (siehe oben): Diese sind definitiv identisch

Melde eine Zutat NIEMALS als fehlend wenn sie unter einem anderen (aber semantisch gleichen) Namen bereits in der Einkaufsliste oder im Vorratsschrank steht.

## Prüfaufgaben

Prüfe die Einkaufsliste auf folgende Probleme und antworte als JSON:

1. **missing_ingredient**: Zutaten die in den Rezepten vorkommen, aber NICHT in der Einkaufsliste UND NICHT im Vorratsschrank sind (und nicht geblockt/optional). Nutze die semantische Zutatenerkennung (siehe oben) – prüfe ob die Zutat unter einem anderen Namen bereits vorhanden ist, bevor du sie als fehlend meldest. Gib die fehlende Zutat mit Menge und Rezeptname an.

2. **quantity_logic**: Mengen-Logik-Fehler. Typisches Beispiel: Im Rezept steht "4 Tortillas" (= 4 Stück einzeln), aber in der Einkaufsliste steht "4" ohne Kontext → das könnte als "4 Packungen" interpretiert werden. Prüfe ob Stückzahlen als Verpackungseinheiten fehlinterpretiert werden könnten. Berücksichtige besonders Produkte die typischerweise in Mehrstück-Packungen verkauft werden (Tortillas, Burger-Buns, Aufbackbrötchen etc.).

3. **pantry_covered**: Zutaten die im Vorratsschrank ausreichend vorhanden sind, aber trotzdem auf der Einkaufsliste stehen. Beachte intelligente Einheiten-Erkennung:
   - 1 Knolle Knoblauch ≈ 10 Zehen → reicht für bis zu 10 Zehen
   - 1 kg Mehl reicht für "200g Mehl"
   - Permanente Vorräte (is_permanent=true) decken immer ab
   Gib einen confidence-Wert (0.0-1.0) an wie sicher du bist.

4. **plausibility**: Ungewöhnlich hohe oder niedrige Mengen die auf einen Fehler hindeuten (z.B. 500g Salz für ein Rezept, 0.01 kg Fleisch).

5. **duplicate**: Zutaten die TATSÄCHLICH mehrfach als separate Einträge in der Einkaufsliste vorkommen und zusammengeführt werden sollten. Nutze die semantische Zutatenerkennung: "Zwiebel rot" und "Rote Zwiebel" als zwei Zeilen = Duplikat. "Tomate" und "Tomaten" als zwei Zeilen = Duplikat. WICHTIG: Wenn eine Zutat nur EINMAL in der Liste steht (auch wenn sie aus mehreren Rezepten kommt), ist sie KEIN Duplikat – sie wurde bereits korrekt aggregiert. Prüfe die Einkaufsliste (nicht die Rezepte!) auf doppelte Einträge.${hasReweMatching ? `

6. **rewe_mismatch**: REWE-Produkte die nicht zur Zutat passen. Beispiel: "Bohnen" zugeordnet zu "Bohnenaufstrich" ist falsch. Prüfe ob der REWE-Produktname (rewe_product.name) das richtige Produkt für die Zutat ist.

7. **rewe_missing**: Zutaten ohne REWE-Produktzuordnung (rewe_product ist null), die aber als Rezept-Zutat relevant wären (source="recipe"). Manuelle Items (source="manual") ignorieren.` : ''}

## Antwortformat

Antworte ausschließlich als JSON-Objekt:
{
  "issues": [
    {
      "itemId": 42,
      "ingredientName": "Knoblauch",
      "type": "pantry_covered",
      "severity": "medium",
      "confidence": 0.95,
      "message": "1 Knolle Knoblauch im Vorrat deckt die benötigte 1 Zehe ab",
      "suggestion": "remove",
      "suggestedAmount": null,
      "suggestedUnit": null,
      "recipeTitle": null,
      "recipeId": null
    }
  ]
}

Regeln:
- itemId: Die ID des betroffenen Einkaufslisten-Items (null bei missing_ingredient, da es noch nicht existiert)
- type: Einer der oben genannten Typen
- severity: "high" (sollte behoben werden), "medium" (prüfen empfohlen), "low" (Info)
- confidence: 0.0-1.0 (nur relevant bei pantry_covered)
- suggestion: "remove" (entfernen), "adjust" (Menge anpassen), "add" (hinzufügen), "review" (manuell prüfen), "merge" (zusammenführen)
- recipeId: Die numerische ID des betroffenen Rezepts (aus der Rezeptliste oben). IMMER angeben wenn sich das Issue auf ein bestimmtes Rezept bezieht (z.B. missing_ingredient, quantity_logic). Null wenn kein bestimmtes Rezept betroffen.
- recipeTitle: Der Titel des betroffenen Rezepts. IMMER zusammen mit recipeId angeben.${hasReweMatching ? '\n- severity für rewe_missing und rewe_mismatch immer "high"' : ''}
- Keine Issues für geblockte oder als optional markierte Zutaten
- Keine Issues für permanente Vorräte die korrekt abgezogen wurden
- Keine Issues für Dinge die offensichtlich korrekt sind
- Sei präzise und gib nur echte Probleme aus, keine Vermutungen
- Leeres Array wenn alles in Ordnung ist
- WICHTIG: Nutze IMMER die semantische Zutatenerkennung. Melde NIEMALS eine Zutat als fehlend die unter einem anderen aber gleichbedeutenden Namen bereits in der Liste steht (z.B. "Zwiebel rot" deckt "Rote Zwiebel" ab, "Paprika gelb" deckt "Gelbe Paprika" ab, etc.)
- WICHTIG: Die Einkaufsliste wurde möglicherweise ohne vergangene Wochentage generiert. Prüfe nur Rezepte die in der obigen Rezeptliste aufgeführt sind.${skippedDayInfo ? `\n- HINWEIS: ${skippedDayInfo.skippedDays} vergangene Tage wurden beim Erstellen übersprungen. Die Rezepte dieser Tage sind NICHT in der obigen Rezeptliste enthalten und dürfen NICHT als fehlend gemeldet werden.` : ''}
- Bei "duplicate": Nur melden wenn tatsächlich ZWEI ODER MEHR separate Zeilen in der Einkaufsliste für semantisch gleiche Zutaten existieren. Eine einzelne korrekt aggregierte Zeile mit der Summe aus mehreren Rezepten ist KEIN Duplikat.`;

  try {
    const result = await ai.chatJSON(prompt, { temperature: 0.2, maxTokens: 4096 });

    if (!result || !Array.isArray(result.issues)) {
      console.warn('⚠️ KI-Review: Unerwartetes Format:', result);
      return { issues: [], autoResolved: [] };
    }

    // --- 4. Normalisierung & Auto-Resolve ---
    const autoResolved = [];
    const manualIssues = [];

    for (const rawIssue of result.issues) {
      // Validierung des Issue-Formats
      if (!rawIssue.type || !rawIssue.message) continue;

      // Normalisierung: itemId → item_id, ingredientName → ingredient
      const issue = {
        ...rawIssue,
        item_id: rawIssue.itemId || rawIssue.item_id || null,
        ingredient: rawIssue.ingredientName || rawIssue.ingredient || null,
        recipe_id: rawIssue.recipeId || rawIssue.recipe_id || null,
        recipe_title: rawIssue.recipeTitle || rawIssue.recipe_title || null,
      };
      // Normalisierung: suggestion String → Objekt { action, label }
      if (typeof issue.suggestion === 'string') {
        const action = issue.suggestion;
        const labels = {
          remove: 'Entfernen', adjust: 'Menge anpassen', add: 'Hinzufügen',
          review: 'Prüfen', merge: 'Zusammenführen', check: 'Abhaken',
        };
        issue.suggestion = {
          action,
          label: labels[action] || action,
          amount: issue.suggestedAmount || null,
          unit: issue.suggestedUnit || null,
          ingredient_name: issue.ingredientName || issue.ingredient || null,
        };
      }
      // Entferne camelCase-Felder die wir normalisiert haben
      delete issue.itemId;
      delete issue.ingredientName;
      delete issue.suggestedAmount;
      delete issue.suggestedUnit;
      delete issue.recipeId;
      delete issue.recipeTitle;

      // Auto-Resolve: pantry_covered mit hoher Konfidenz → Item als erledigt markieren
      if (issue.type === 'pantry_covered' && issue.confidence >= 0.9 && issue.suggestion?.action === 'remove' && issue.item_id) {
        db.prepare(
          'UPDATE shopping_list_items SET is_checked = 1 WHERE id = ? AND shopping_list_id = ?'
        ).run(issue.item_id, listId);
        autoResolved.push({ ...issue, autoResolved: true });
      } else {
        manualIssues.push(issue);
      }
    }

    // Review-Ergebnis in der Liste speichern (für persistente Anzeige)
    db.prepare(
      'UPDATE shopping_lists SET ai_review_issues = ? WHERE id = ?'
    ).run(JSON.stringify(manualIssues), listId);

    console.log(`🔍 KI-Review: ${manualIssues.length} Issues, ${autoResolved.length} auto-resolved`);

    return { issues: manualIssues, autoResolved };
  } catch (err) {
    console.error('❌ KI-Review fehlgeschlagen:', err.message);
    return { issues: [], autoResolved: [], error: err.message };
  }
}
