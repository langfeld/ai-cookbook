/**
 * ============================================
 * Wochenplan-Service (Intelligente Planung)
 * ============================================
 *
 * Das Herzstück der Anwendung: Generiert intelligente Wochenpläne
 * unter Berücksichtigung von:
 * - Rezepte, die länger nicht gekocht wurden (Rotation)
 * - Zusammenpassende Zutaten für effizientes Einkaufen
 * - Ausgewogene Ernährung (Abwechslung bei Kategorien)
 * - Vorräte im Vorratsschrank
 * - Benutzerpräferenzen (Favoriten, Bewertungen)
 */

import { getAIProvider } from './ai/provider.js';
import db from '../config/database.js';
import { getWeekStart } from '../utils/helpers.js';

/**
 * Generiert einen intelligenten Wochenplan per KI
 * @param {number} userId - Benutzer-ID
 * @param {object} options - Konfiguration für die Planung
 * @param {number} options.personCount - Anzahl Personen
 * @param {string[]} options.mealTypes - Gewünschte Mahlzeiten pro Tag
 * @param {string} options.weekStart - Start der Woche (YYYY-MM-DD)
 * @param {string[]} options.excludeRecipeIds - Auszuschließende Rezepte
 * @returns {Promise<object>} - Generierter Wochenplan
 */
export async function generateWeekPlan(userId, options = {}) {
  const {
    personCount = 4,
    mealTypes = ['fruehstueck', 'mittag', 'abendessen'],
    weekStart = getWeekStart(),
    excludeRecipeIds = [],
  } = options;

  // --- 1. Alle Rezepte des Benutzers laden ---
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
    ${excludeRecipeIds.length ? `AND r.id NOT IN (${excludeRecipeIds.join(',')})` : ''}
    GROUP BY r.id
    ORDER BY r.last_cooked_at ASC NULLS FIRST, r.times_cooked ASC
  `).all(userId);

  if (recipes.length < 5) {
    throw new Error(
      'Mindestens 5 Rezepte werden für eine sinnvolle Wochenplanung benötigt. ' +
      `Aktuell: ${recipes.length} Rezepte.`
    );
  }

  // --- 2. Vorräte laden (für die Einkaufsoptimierung) ---
  const pantryItems = db.prepare(`
    SELECT ingredient_name, amount, unit
    FROM pantry
    WHERE user_id = ? AND amount > 0
  `).all(userId);

  // --- 3. Zutaten der Rezepte laden ---
  const recipeData = recipes.map(recipe => {
    const ingredients = db.prepare(
      'SELECT name, amount, unit FROM ingredients WHERE recipe_id = ?'
    ).all(recipe.id);

    return {
      id: recipe.id,
      title: recipe.title,
      categories: recipe.category_names || '',
      difficulty: recipe.difficulty,
      total_time: recipe.total_time,
      servings: recipe.servings,
      cook_count: recipe.cook_count,
      last_cooked: recipe.last_cooked,
      avg_rating: recipe.avg_rating,
      is_favorite: recipe.is_favorite,
      ingredients: ingredients.map(i => `${i.amount || ''} ${i.unit || ''} ${i.name}`.trim()),
    };
  });

  // --- 4. KI-basierte Wochenplanung ---
  const ai = getAIProvider();
  const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const mealTypeLabels = {
    fruehstueck: 'Frühstück',
    mittag: 'Mittagessen',
    abendessen: 'Abendessen',
    snack: 'Snack',
  };

  const prompt = `
Du bist ein intelligenter Wochenplaner für Mahlzeiten. Erstelle einen optimalen Wochenplan.

VERFÜGBARE REZEPTE (mit Zutaten und Kochhistorie):
${recipeData.map(r => `
  [ID: ${r.id}] "${r.title}"
    Kategorien: ${r.categories}
    Schwierigkeit: ${r.difficulty}, Zeit: ${r.total_time}min, Portionen: ${r.servings}
    Gekocht: ${r.cook_count}x, Zuletzt: ${r.last_cooked || 'nie'}
    Bewertung: ${r.avg_rating ? r.avg_rating + '/5' : 'keine'} ${r.is_favorite ? '⭐ Favorit' : ''}
    Zutaten: ${r.ingredients.join(', ')}
`).join('\n')}

VORRÄTE IM VORRATSSCHRANK:
${pantryItems.length ? pantryItems.map(p => `${p.amount} ${p.unit || ''} ${p.ingredient_name}`).join(', ') : 'Keine Vorräte'}

ANFORDERUNGEN:
- Woche: ${dayNames.join(', ')} (7 Tage)
- Mahlzeiten pro Tag: ${mealTypes.map(t => mealTypeLabels[t]).join(', ')}
- Personen: ${personCount}
- Bevorzuge Rezepte, die LÄNGER NICHT GEKOCHT wurden
- WICHTIG: Wähle Rezepte, deren Zutaten gut zusammenpassen (gemeinsame Grundzutaten)
- Vermeide das gleiche Rezept mehrfach in einer Woche
- Achte auf Abwechslung (nicht 3x Pasta hintereinander)
- Berücksichtige die Vorräte beim Planen
- An Wochenenden (Sa/So) dürfen aufwendigere Rezepte geplant werden

Antworte als JSON:
{
  "plan": [
    {
      "day": 0,
      "day_name": "Montag",
      "meals": [
        {
          "meal_type": "fruehstueck|mittag|abendessen|snack",
          "recipe_id": 123,
          "recipe_title": "...",
          "servings": ${personCount}
        }
      ]
    }
  ],
  "reasoning": "Kurze Erklärung der Planung und warum diese Kombination gut ist",
  "shared_ingredients": ["Zutat1", "Zutat2"],
  "estimated_total_cost": "grobe Schätzung"
}
`;

  const result = await ai.chatJSON(prompt, { temperature: 0.6, maxTokens: 4096 });
  return result;
}

/**
 * Speichert einen generierten Wochenplan in der Datenbank
 */
export function saveMealPlan(userId, weekStart, planData) {
  const insertPlan = db.prepare(
    'INSERT INTO meal_plans (user_id, week_start) VALUES (?, ?)'
  );
  const insertEntry = db.prepare(
    'INSERT INTO meal_plan_entries (meal_plan_id, recipe_id, day_of_week, meal_type, servings) VALUES (?, ?, ?, ?, ?)'
  );

  const transaction = db.transaction(() => {
    const { lastInsertRowid: planId } = insertPlan.run(userId, weekStart);

    for (const day of planData.plan) {
      for (const meal of day.meals) {
        insertEntry.run(planId, meal.recipe_id, day.day, meal.meal_type, meal.servings || 4);
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
