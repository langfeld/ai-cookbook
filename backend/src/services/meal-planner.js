/**
 * ============================================
 * Wochenplan-Service (Hybrid: Algorithmus + optionales KI-Reasoning)
 * ============================================
 *
 * Generiert intelligente Wochenpläne mit einem Score-basierten Algorithmus:
 * - Rezeptrotation (länger nicht gekocht → bevorzugt)
 * - Favoritenbonus
 * - Kategorie-Abwechslung (nicht 2× gleiche Kategorie hintereinander)
 * - Schwierigkeitsgrad passend zum Wochentag (einfach unter der Woche)
 * - Zutaten-Überlappung (Einkaufsoptimierung)
 * - Vorräte im Vorratsschrank berücksichtigen
 *
 * Optional: KI generiert eine kurze Begründung zum Plan.
 */

import db from '../config/database.js';
import { getWeekStart } from '../utils/helpers.js';

const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

// ============================================
// Mahlzeit-Typ → Kategorie-Mapping
// ============================================

/**
 * Keywords pro Mahlzeit-Typ (lowercase).
 * Wenn eine Rezept-Kategorie eines der Keywords enthält → passt zum Slot.
 */
const MEAL_TYPE_KEYWORDS = {
  fruehstueck: ['frühstück', 'breakfast', 'brunch', 'morgen', 'müsli', 'smoothie', 'porridge', 'oatmeal'],
  mittag:      ['mittagessen', 'mittag', 'lunch', 'hauptgericht', 'hauptspeise', 'main'],
  abendessen:  ['abendessen', 'abend', 'dinner', 'hauptgericht', 'hauptspeise', 'main'],
  snack:       ['snack', 'dessert', 'nachtisch', 'kuchen', 'gebäck', 'süß', 'vorspeise', 'beilage', 'kleinigkeit', 'appetizer'],
};

/**
 * Title-Keywords als Fallback, wenn ein Rezept gar keine Kategorie hat.
 */
const TITLE_HINTS = {
  fruehstueck: ['müsli', 'granola', 'porridge', 'smoothie', 'pancake', 'pfannkuchen', 'brötchen', 'toast', 'omelette', 'rührei', 'frühstück'],
  snack:       ['kuchen', 'muffin', 'cookie', 'riegel', 'salat', 'dip', 'hummus', 'bruschetta', 'nachos'],
};

/**
 * Prüft, ob ein Rezept zu einem bestimmten Mahlzeit-Typ passt.
 * Gibt zurück: 'match' | 'neutral' | 'mismatch'
 */
function mealTypeFitness(recipe, mealType) {
  const cats = (recipe.categories || '').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);

  // Rezept hat Kategorien → prüfen ob eine zum Mahlzeit-Typ passt
  if (cats.length > 0) {
    const targetKeywords = MEAL_TYPE_KEYWORDS[mealType] || [];
    const hasMatch = cats.some(cat => targetKeywords.some(kw => cat.includes(kw)));
    if (hasMatch) return 'match';

    // Prüfen ob Rezept explizit zu einem ANDEREN Typ gehört
    const otherTypes = Object.entries(MEAL_TYPE_KEYWORDS).filter(([key]) => key !== mealType);
    const belongsToOther = otherTypes.some(([, keywords]) =>
      cats.some(cat => keywords.some(kw => cat.includes(kw)))
    );
    if (belongsToOther) return 'mismatch';

    return 'neutral'; // Kategorie vorhanden, passt zu keinem spezifischen Typ
  }

  // Kein Kategorie → Title als Fallback prüfen
  const titleLower = (recipe.title || '').toLowerCase();
  const titleHints = TITLE_HINTS[mealType];
  if (titleHints && titleHints.some(hint => titleLower.includes(hint))) return 'match';

  // Frühstück/Snack ohne passende Kategorie oder Title-Hint → eher unpassend
  if (mealType === 'fruehstueck' || mealType === 'snack') return 'mismatch';

  // Mittag/Abendessen: Rezepte ohne Kategorie gelten als mögliche Hauptgerichte
  return 'neutral';
}

/**
 * Harter Filter: Gibt nur Rezepte zurück, die zum Mahlzeit-Typ passen.
 * 'mismatch'-Rezepte werden komplett ausgeschlossen.
 * Gibt leeres Array zurück, wenn nichts passt → Slot bleibt dann leer.
 */
function filterByMealType(recipes, mealType) {
  return recipes.filter(r => mealTypeFitness(r, mealType) !== 'mismatch');
}

// ============================================
// Scoring-System
// ============================================

/**
 * Bewertet ein Rezept für einen bestimmten Slot im Wochenplan.
 * Höherer Score = besser geeignet.
 */
function scoreRecipe(recipe, context) {
  let score = 100;

  // Mahlzeit-Typ-Passung wird VOR dem Scoring per Filter erledigt (siehe filterByMealType).
  // Im Score gibt es nur noch einen kleinen Bonus für perfekte Matches.
  const fitness = mealTypeFitness(recipe, context.mealType || 'mittag');
  if (fitness === 'match') score += 30; // Bonus für perfekte Kategorie-Passung

  // 1. Rotation: lange nicht gekocht = höherer Score (max +60)
  if (recipe.last_cooked) {
    const daysSince = Math.floor((Date.now() - new Date(recipe.last_cooked).getTime()) / 86_400_000);
    score += Math.min(daysSince, 60);
  } else {
    score += 60; // Nie gekocht → maximaler Rotationsbonus
  }

  // 2. Selten gekocht (max +20)
  if (recipe.cook_count === 0) {
    score += 20;
  } else if (recipe.cook_count <= 2) {
    score += 10;
  }

  // 3. Favoriten bevorzugen
  if (recipe.is_favorite) score += 25;

  // 4. Gute Bewertung
  if (recipe.avg_rating >= 4) score += 15;
  else if (recipe.avg_rating >= 3) score += 5;

  // 5. Duplikat-Vermeidung: schon diese Woche gewählt → praktisch ausschließen
  if (context.usedRecipeIds.has(recipe.id)) score -= 500;

  // 6. Kategorie-Abwechslung: gleiche Kategorie wie Vortag → Malus
  if (context.previousMealCategory) {
    const cats = (recipe.categories || '').split(',').map(c => c.trim().toLowerCase());
    if (cats.some(c => c === context.previousMealCategory.toLowerCase())) {
      score -= 30;
    }
  }

  // 7. Schwierigkeit vs. Wochentag
  const isWeekend = context.dayIdx >= 5; // Sa=5, So=6
  if (recipe.difficulty === 'schwer') {
    score += isWeekend ? 20 : -25;
  } else if (recipe.difficulty === 'einfach') {
    score += isWeekend ? -5 : 10;
  }

  // 8. Zeitaufwand: unter der Woche kürzere Rezepte bevorzugen
  if (!isWeekend && recipe.total_time > 60) score -= 15;
  if (!isWeekend && recipe.total_time <= 30) score += 10;

  // 9. Zutaten-Überlappung mit bereits gewählten Rezepten (Einkaufsoptimierung)
  if (context.usedIngredients.size > 0) {
    const overlap = recipe.ingredientNames.filter(n => context.usedIngredients.has(n)).length;
    score += overlap * 5;
  }

  // 10. Vorräte nutzen
  for (const name of recipe.ingredientNames) {
    if (context.pantrySet.has(name)) score += 8;
  }

  return Math.max(score, 1); // Mindestens 1
}

/**
 * Gewichtete Zufallsauswahl: Rezepte mit höherem Score werden wahrscheinlicher gewählt.
 */
function weightedRandomPick(recipes, context) {
  const scored = recipes.map(r => ({ recipe: r, score: scoreRecipe(r, context) }));
  scored.sort((a, b) => b.score - a.score);

  const totalWeight = scored.reduce((sum, s) => sum + s.score, 0);
  let random = Math.random() * totalWeight;

  for (const s of scored) {
    random -= s.score;
    if (random <= 0) return s;
  }
  return scored[scored.length - 1];
}

// ============================================
// Vorschläge (für Rezepttausch)
// ============================================

/**
 * Liefert bewertete Rezeptvorschläge für einen bestimmten Slot.
 */
export function getSuggestions(userId, { dayIdx = 0, mealType = 'mittag', excludeRecipeIds = [], planId = null, limit = 8 } = {}) {
  const recipes = db.prepare(`
    SELECT r.*, GROUP_CONCAT(DISTINCT c.name) as category_names,
      (SELECT COUNT(*) FROM cooking_history ch WHERE ch.recipe_id = r.id) as cook_count,
      (SELECT MAX(ch.cooked_at) FROM cooking_history ch WHERE ch.recipe_id = r.id) as last_cooked,
      (SELECT AVG(ch.rating) FROM cooking_history ch WHERE ch.recipe_id = r.id AND ch.rating IS NOT NULL) as avg_rating
    FROM recipes r
    LEFT JOIN recipe_categories rc ON r.id = rc.recipe_id
    LEFT JOIN categories c ON rc.category_id = c.id
    WHERE r.user_id = ?
    GROUP BY r.id
  `).all(userId);

  const pantryItems = db.prepare(
    'SELECT ingredient_name FROM pantry WHERE user_id = ? AND amount > 0'
  ).all(userId);
  const pantrySet = new Set(pantryItems.map(p => p.ingredient_name.toLowerCase()));
  const excludeSet = new Set(excludeRecipeIds);

  // Gesperrte Rezepte laden und ausschließen
  const blockedIds = db.prepare(
    "SELECT recipe_id FROM recipe_blocks WHERE user_id = ? AND blocked_until >= date('now')"
  ).all(userId).map(b => b.recipe_id);
  blockedIds.forEach(id => excludeSet.add(id));

  // Zutaten aller Rezepte im aktuellen Plan sammeln (für Einkaufsüberlappung)
  let planIngredients = null;
  if (planId) {
    const planRecipeIds = db.prepare(
      'SELECT DISTINCT recipe_id FROM meal_plan_entries WHERE meal_plan_id = ?'
    ).all(planId).map(r => r.recipe_id);
    if (planRecipeIds.length > 0) {
      const placeholders = planRecipeIds.map(() => '?').join(',');
      const ings = db.prepare(
        `SELECT DISTINCT LOWER(name) as name FROM ingredients WHERE recipe_id IN (${placeholders})`
      ).all(...planRecipeIds);
      planIngredients = new Set(ings.map(i => i.name));
    }
  }

  const scored = recipes
    .filter(r => !excludeSet.has(r.id))
    .map(r => {
      const ingredients = db.prepare('SELECT name FROM ingredients WHERE recipe_id = ?').all(r.id);
      return { ...r, categories: r.category_names || '', ingredientNames: ingredients.map(i => i.name.toLowerCase()) };
    })
    .filter(r => mealTypeFitness(r, mealType) !== 'mismatch') // Harter Filter!
    .map(recipe => {
      const context = { dayIdx, mealType, usedRecipeIds: new Set(), usedIngredients: new Set(), pantrySet, previousMealCategory: null };
      const score = scoreRecipe(recipe, context);

      // ── Detaillierte Hinweise sammeln ──
      const hints = [];

      // Mahlzeit-Typ-Passung
      if (mealTypeFitness(recipe, mealType) === 'match') {
        hints.push({ icon: '✅', text: 'Passt zum Slot' });
      }

      // Vorrats-Check
      const pantryMatches = recipe.ingredientNames.filter(n => pantrySet.has(n));
      if (pantryMatches.length > 0) {
        hints.push({
          icon: '🗄️',
          text: `${pantryMatches.length} Zutat${pantryMatches.length > 1 ? 'en' : ''} im Vorrat`,
        });
      }

      // Zutaten-Überlappung mit aktuell genutzten Rezepten des Plans
      if (planIngredients && planIngredients.size > 0) {
        const overlap = recipe.ingredientNames.filter(n => planIngredients.has(n));
        if (overlap.length > 0) {
          hints.push({
            icon: '🛒',
            text: `${overlap.length} von ${recipe.ingredientNames.length} Zutaten bei anderen Plan-Rezepten`,
          });
        }
      }

      // Kochhistorie
      if (!recipe.last_cooked) {
        hints.push({ icon: '🆕', text: 'Noch nie gekocht' });
      } else {
        const daysSince = Math.floor((Date.now() - new Date(recipe.last_cooked).getTime()) / 86_400_000);
        if (daysSince >= 30) {
          hints.push({ icon: '📅', text: `Seit ${daysSince} Tagen nicht gekocht` });
        } else if (daysSince >= 14) {
          hints.push({ icon: '📅', text: `Seit ${daysSince} Tagen nicht gekocht` });
        }
      }

      if (recipe.cook_count > 0 && recipe.cook_count <= 2) {
        hints.push({ icon: '🔍', text: `Erst ${recipe.cook_count}× gekocht` });
      }

      // Favorit
      if (recipe.is_favorite) {
        hints.push({ icon: '⭐', text: 'Favorit' });
      }

      // Bewertung
      if (recipe.avg_rating >= 4) {
        hints.push({ icon: '👍', text: `Bewertung: ${Number(recipe.avg_rating).toFixed(1)} ★` });
      }

      // Schwierigkeit passend zum Tag
      const isWeekend = dayIdx >= 5;
      if (recipe.difficulty === 'einfach' && !isWeekend) {
        hints.push({ icon: '⚡', text: 'Schnell & einfach unter der Woche' });
      }
      if (recipe.total_time && recipe.total_time <= 30 && !isWeekend) {
        hints.push({ icon: '⏱️', text: 'Unter 30 Minuten' });
      }

      // Fallback: mindestens ein Hint
      if (hints.length === 0) {
        hints.push({ icon: '🍽️', text: 'Gute Abwechslung' });
      }

      return {
        id: recipe.id,
        title: recipe.title,
        image_url: recipe.image_url,
        total_time: recipe.total_time,
        difficulty: recipe.difficulty,
        is_favorite: recipe.is_favorite,
        score,
        hints,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

// ============================================
// Plan-Generierung
// ============================================

/**
 * Generiert einen Wochenplan per Scoring-Algorithmus.
 * @param {number} userId - Benutzer-ID
 * @param {object} options - Konfiguration
 * @returns {Promise<object>} - { plan, reasoning }
 */
export async function generateWeekPlan(userId, options = {}) {
  const {
    personCount = 4,
    mealTypes = ['fruehstueck', 'mittag', 'abendessen'],
    excludeRecipeIds = [],
    collectionIds = [],       // Nur Rezepte aus diesen Sammlungen
    deduplicateCollections = true, // Rezepte in mehreren Sammlungen nur einmal zählen
    enableAiReasoning = false,    // KI-Begründung generieren?
  } = options;

  // --- 1. Alle Rezepte des Benutzers laden (ggf. gefiltert nach Sammlungen) ---

  // Gesperrte Rezepte laden
  const blockedRecipeIds = db.prepare(
    "SELECT recipe_id FROM recipe_blocks WHERE user_id = ? AND blocked_until >= date('now')"
  ).all(userId).map(b => b.recipe_id);
  const allExcludeIds = [...new Set([...excludeRecipeIds, ...blockedRecipeIds])];

  let collectionFilter = '';
  if (collectionIds.length > 0) {
    if (deduplicateCollections) {
      // Rezept nur einmal, auch wenn in mehreren gewählten Sammlungen
      collectionFilter = `AND r.id IN (
        SELECT DISTINCT rcol.recipe_id FROM recipe_collections rcol
        WHERE rcol.collection_id IN (${collectionIds.join(',')})
      )`;
    } else {
      collectionFilter = `AND r.id IN (
        SELECT rcol.recipe_id FROM recipe_collections rcol
        WHERE rcol.collection_id IN (${collectionIds.join(',')})
      )`;
    }
  }

  const recipes = db.prepare(`
    SELECT
      r.*,
      GROUP_CONCAT(DISTINCT c.name) as category_names,
      (SELECT COUNT(*) FROM cooking_history ch WHERE ch.recipe_id = r.id) as cook_count,
      (SELECT MAX(ch.cooked_at) FROM cooking_history ch WHERE ch.recipe_id = r.id) as last_cooked,
      (SELECT AVG(ch.rating) FROM cooking_history ch WHERE ch.recipe_id = r.id AND ch.rating IS NOT NULL) as avg_rating
    FROM recipes r
    LEFT JOIN recipe_categories rc ON r.id = rc.recipe_id
    LEFT JOIN categories c ON rc.category_id = c.id
    WHERE r.user_id = ?
    ${allExcludeIds.length ? `AND r.id NOT IN (${allExcludeIds.join(',')})` : ''}
    ${collectionFilter}
    GROUP BY r.id
    ORDER BY r.last_cooked_at ASC NULLS FIRST, r.times_cooked ASC
  `).all(userId);

  if (recipes.length < 3) {
    throw new Error(
      `Mindestens 3 Rezepte werden für eine Wochenplanung benötigt. Aktuell: ${recipes.length} Rezepte.`
    );
  }

  // --- 2. Zutaten pro Rezept laden ---
  const recipeData = recipes.map(recipe => {
    const ingredients = db.prepare(
      'SELECT name FROM ingredients WHERE recipe_id = ?'
    ).all(recipe.id);

    return {
      ...recipe,
      categories: recipe.category_names || '',
      ingredientNames: ingredients.map(i => i.name.toLowerCase()),
    };
  });

  // --- 3. Vorräte laden ---
  const pantryItems = db.prepare(
    'SELECT ingredient_name FROM pantry WHERE user_id = ? AND amount > 0'
  ).all(userId);
  const pantrySet = new Set(pantryItems.map(p => p.ingredient_name.toLowerCase()));

  // --- 4. Algorithmische Planung ---
  const plan = [];
  const usedRecipeIds = new Set();
  const usedIngredients = new Set();
  const reasons = [];

  // Tracking: letzte Kategorie pro Mahlzeit-Typ (für Abwechslung)
  const lastCategoryByMeal = {};

  // Pro Mahlzeit-Typ: passende Rezepte vorab filtern
  const recipesPerMealType = {};
  for (const mt of mealTypes) {
    recipesPerMealType[mt] = filterByMealType(recipeData, mt);
  }

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const dayMeals = [];

    for (const mealType of mealTypes) {
      // Nur aus passenden Rezepten wählen
      const eligible = recipesPerMealType[mealType];
      if (eligible.length === 0) continue; // Keine passenden Rezepte → Slot leer lassen

      const context = {
        dayIdx,
        mealType,
        usedRecipeIds,
        usedIngredients,
        pantrySet,
        previousMealCategory: lastCategoryByMeal[mealType] || null,
      };

      const pick = weightedRandomPick(eligible, context);
      const recipe = pick.recipe;

      // Gewähltes Rezept tracken
      usedRecipeIds.add(recipe.id);
      recipe.ingredientNames.forEach(n => usedIngredients.add(n));
      const firstCat = (recipe.categories || '').split(',')[0]?.trim() || '';
      lastCategoryByMeal[mealType] = firstCat;

      dayMeals.push({
        meal_type: mealType,
        recipe_id: recipe.id,
        recipe_title: recipe.title,
        servings: personCount,
      });

      // Grund sammeln
      if (pick.score >= 180) {
        reasons.push(`\u201E${recipe.title}\u201C (${DAY_NAMES[dayIdx]}): lange nicht gekocht`);
      } else if (recipe.is_favorite) {
        reasons.push(`\u201E${recipe.title}\u201C (${DAY_NAMES[dayIdx]}): Favorit`);
      }
    }

    plan.push({
      day: dayIdx,
      day_name: DAY_NAMES[dayIdx],
      meals: dayMeals,
    });
  }

  // Reasoning wird separat generiert (async, nicht blockierend)
  return { plan };
}

/**
 * Generiert KI-Reasoning für einen bestehenden Plan (async).
 * Gibt { reasoning, reasoningSource } zurück.
 */
export async function generateReasoning(plan) {
  let reasoning = null;
  let reasoningSource = null;

  // Zuerst KI versuchen
  try {
    const { getAIProvider } = await import('./ai/provider.js');
    const ai = getAIProvider();
    if (ai?.apiKey) {
      const titles = plan.flatMap(d =>
        (d.meals || d.entries?.filter(e => e.day_of_week === d.day) || [])
          .map(m => `${d.day_name || ''} ${m.meal_type}: ${m.recipe_title}`)
      ).join('\n');
      console.log('🤖 KI-Reasoning wird angefragt...');
      const aiReasoning = await ai.chat(
        `Antworte kurz und direkt in 2-3 Sätzen auf Deutsch. Erkläre warum dieser Wochenplan ausgewogen ist:\n${titles}`,
        { maxTokens: 2048 }
      );
      if (aiReasoning && aiReasoning.length > 10) {
        reasoning = aiReasoning.trim();
        reasoningSource = 'ai';
        console.log('✅ KI-Reasoning erhalten');
      } else {
        console.warn('⚠️ KI-Antwort zu kurz oder leer, Fallback auf Algorithmus');
      }
    } else {
      console.warn('⚠️ KI-Provider hat keinen API-Key, Fallback auf Algorithmus');
    }
  } catch (err) {
    console.warn('⚠️ KI-Reasoning fehlgeschlagen, Fallback auf Algorithmus:', err.message);
  }

  // Algorithmischer Fallback
  if (!reasoning) {
    const allMeals = plan.flatMap(d => d.meals || []);
    const totalMeals = allMeals.length;
    const uniqueRecipes = new Set(allMeals.map(m => m.recipe_id)).size;
    reasoning = `Plan: ${totalMeals} Mahlzeiten aus ${uniqueRecipes} verschiedenen Rezepten.`;
    reasoningSource = 'algorithm';
  }

  return { reasoning, reasoningSource };
}

// ============================================
// Speichern & Laden
// ============================================

/**
 * Speichert einen generierten Wochenplan in der Datenbank
 */
export function saveMealPlan(userId, weekStart, planData) {
  const plan = planData.plan;
  if (!Array.isArray(plan) || plan.length === 0) {
    throw new Error('Kein gültiger Wochenplan zum Speichern vorhanden.');
  }

  const insertPlan = db.prepare(
    'INSERT INTO meal_plans (user_id, week_start, reasoning) VALUES (?, ?, ?)'
  );
  const insertEntry = db.prepare(
    'INSERT INTO meal_plan_entries (meal_plan_id, recipe_id, day_of_week, meal_type, servings) VALUES (?, ?, ?, ?, ?)'
  );

  const transaction = db.transaction(() => {
    const { lastInsertRowid: planId } = insertPlan.run(userId, weekStart, planData.reasoning || null);

    for (const day of plan) {
      const dayNum = day.day ?? plan.indexOf(day);
      const meals = Array.isArray(day.meals) ? day.meals : [];
      for (const meal of meals) {
        if (!meal.recipe_id) continue;
        insertEntry.run(planId, meal.recipe_id, dayNum, meal.meal_type, meal.servings || 4);
      }
    }

    return planId;
  });

  return transaction();
}

/**
 * Lädt einen Wochenplan mit allen Details
 */
export function getMealPlan(userId, weekStart) {
  const plan = db.prepare(
    'SELECT * FROM meal_plans WHERE user_id = ? AND week_start = ?'
  ).get(userId, weekStart);

  if (!plan) return null;

  const entries = db.prepare(`
    SELECT
      mpe.*,
      r.title as recipe_title,
      r.image_url,
      r.total_time,
      r.difficulty,
      r.servings as original_servings
    FROM meal_plan_entries mpe
    JOIN recipes r ON mpe.recipe_id = r.id
    WHERE mpe.meal_plan_id = ?
    ORDER BY mpe.day_of_week, mpe.meal_type
  `).all(plan.id);

  return { ...plan, entries };
}
