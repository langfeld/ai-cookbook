/**
 * ============================================
 * Wochenplan-Routen
 * ============================================
 * Algorithmische Wochenplanung mit optionalem KI-Reasoning,
 * Rezepttausch-Vorschlägen und Drag-&-Drop-Unterstützung.
 */

import db from '../config/database.js';
import { generateWeekPlan, generateReasoning, saveMealPlan, getMealPlan, getSuggestions } from '../services/meal-planner.js';
import { getWeekStart, scaleIngredient, convertToBaseUnit, normalizeUnit } from '../utils/helpers.js';

export default async function mealplanRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ─────────────────────────────────────────────
  // POST /generate – Wochenplan generieren
  // ─────────────────────────────────────────────
  fastify.post('/generate', {
    schema: {
      description: 'Wochenplan generieren (Algorithmus + optionales KI-Reasoning)',
      tags: ['Wochenplan'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          personCount: { type: 'integer', minimum: 1, maximum: 20, default: 4 },
          mealTypes: {
            type: 'array',
            items: { type: 'string', enum: ['fruehstueck', 'mittag', 'abendessen', 'snack'] },
            default: ['fruehstueck', 'mittag', 'abendessen'],
          },
          weekStart: { type: 'string', format: 'date' },
          excludeRecipeIds: { type: 'array', items: { type: 'integer' } },
          collectionIds: {
            type: 'array',
            items: { type: 'integer' },
            default: [],
            description: 'Nur Rezepte aus diesen Sammlungen berücksichtigen (leer = alle)',
          },
          deduplicateCollections: {
            type: 'boolean',
            default: true,
            description: 'Rezepte in mehreren Sammlungen nur einmal berücksichtigen',
          },
          enableAiReasoning: {
            type: 'boolean',
            default: false,
            description: 'KI-Begründung zum generierten Plan erstellen',
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const weekStart = request.body?.weekStart || getWeekStart();
      const options = { ...request.body, weekStart };

      // Bestehenden Plan für diese Woche löschen
      const existing = db.prepare('SELECT id FROM meal_plans WHERE user_id = ? AND week_start = ?').get(userId, weekStart);
      if (existing) {
        db.prepare('DELETE FROM meal_plans WHERE id = ?').run(existing.id);
      }

      const planData = await generateWeekPlan(userId, options);
      const planId = saveMealPlan(userId, weekStart, planData);

      // Gespeicherten Plan mit vollständigen Entries zurückgeben
      const savedPlan = getMealPlan(userId, weekStart);

      // KI-Reasoning async im Hintergrund starten (blockiert Antwort nicht)
      if (options.enableAiReasoning) {
        generateReasoning(planData.plan).then(({ reasoning, reasoningSource }) => {
          db.prepare('UPDATE meal_plans SET reasoning = ? WHERE id = ?').run(reasoning, planId);
          console.log(`📝 Reasoning für Plan ${planId} gespeichert (${reasoningSource})`);
        }).catch(err => {
          console.warn('⚠️ Hintergrund-Reasoning fehlgeschlagen:', err.message);
        });
      }

      return {
        planId,
        plan: savedPlan,
        message: 'Wochenplan erfolgreich generiert!',
      };
    } catch (error) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // ─────────────────────────────────────────────
  // GET /reasoning/:planId – KI-Reasoning abrufen
  // ─────────────────────────────────────────────
  fastify.get('/reasoning/:planId', {
    schema: {
      description: 'KI-Reasoning für einen Plan abrufen (Polling)',
      tags: ['Wochenplan'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { planId: { type: 'integer' } },
        required: ['planId'],
      },
    },
  }, async (request) => {
    const plan = db.prepare(
      'SELECT reasoning FROM meal_plans WHERE id = ? AND user_id = ?'
    ).get(request.params.planId, request.user.id);
    if (!plan) return { reasoning: null, status: 'not_found' };
    if (!plan.reasoning) return { reasoning: null, status: 'pending' };
    return { reasoning: plan.reasoning, status: 'ready', reasoningSource: 'ai' };
  });

  // ─────────────────────────────────────────────
  // GET / – Wochenplan abrufen
  // ─────────────────────────────────────────────
  fastify.get('/', {
    schema: {
      description: 'Wochenplan abrufen',
      tags: ['Wochenplan'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          weekStart: { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request) => {
    const weekStart = request.query.weekStart || getWeekStart();
    const plan = getMealPlan(request.user.id, weekStart);
    return { plan: plan || null };
  });

  // ─────────────────────────────────────────────
  // GET /history – Plan-Historie
  // ─────────────────────────────────────────────
  fastify.get('/history', {
    schema: { description: 'Wochenplan-Historie', tags: ['Wochenplan'], security: [{ bearerAuth: [] }] },
  }, async (request) => {
    const plans = db.prepare(`
      SELECT mp.*, COUNT(mpe.id) as meal_count
      FROM meal_plans mp
      LEFT JOIN meal_plan_entries mpe ON mp.id = mpe.meal_plan_id
      WHERE mp.user_id = ?
      GROUP BY mp.id
      ORDER BY mp.week_start DESC
      LIMIT 20
    `).all(request.user.id);
    return { plans };
  });

  // ─────────────────────────────────────────────
  // POST /add-recipe – Rezept manuell zum Planer hinzufügen
  // ─────────────────────────────────────────────
  fastify.post('/add-recipe', {
    schema: {
      description: 'Rezept manuell zum Wochenplan hinzufügen (erstellt Plan automatisch falls nötig)',
      tags: ['Wochenplan'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['recipe_id', 'day_of_week', 'meal_type', 'week_start'],
        properties: {
          recipe_id: { type: 'integer' },
          day_of_week: { type: 'integer', minimum: 0, maximum: 6 },
          meal_type: { type: 'string', enum: ['fruehstueck', 'mittag', 'abendessen', 'snack'] },
          week_start: { type: 'string', format: 'date' },
          servings: { type: 'integer', minimum: 1, default: 4 },
        },
      },
    },
  }, async (request, reply) => {
    const { recipe_id, day_of_week, meal_type, week_start, servings = 4 } = request.body;
    const userId = request.user.id;

    // Rezept prüfen
    const recipe = db.prepare('SELECT id, title FROM recipes WHERE id = ?').get(recipe_id);
    if (!recipe) return reply.status(404).send({ error: 'Rezept nicht gefunden' });

    // Plan für die Woche suchen oder erstellen
    let plan = db.prepare('SELECT id FROM meal_plans WHERE user_id = ? AND week_start = ?').get(userId, week_start);
    if (!plan) {
      const { lastInsertRowid } = db.prepare(
        'INSERT INTO meal_plans (user_id, week_start) VALUES (?, ?)'
      ).run(userId, week_start);
      plan = { id: Number(lastInsertRowid) };
    }

    // Prüfen ob Slot bereits belegt → ersetzen statt blockieren
    let entryId;
    let replaced = false;
    const existing = db.prepare(
      'SELECT id FROM meal_plan_entries WHERE meal_plan_id = ? AND day_of_week = ? AND meal_type = ?'
    ).get(plan.id, day_of_week, meal_type);

    if (existing) {
      // Bestehendes Rezept durch neues ersetzen
      db.prepare('UPDATE meal_plan_entries SET recipe_id = ?, servings = ?, is_cooked = 0 WHERE id = ?')
        .run(recipe_id, servings, existing.id);
      entryId = existing.id;
      replaced = true;
    } else {
      // Neuen Eintrag erstellen
      const { lastInsertRowid } = db.prepare(
        'INSERT INTO meal_plan_entries (meal_plan_id, recipe_id, day_of_week, meal_type, servings) VALUES (?, ?, ?, ?, ?)'
      ).run(plan.id, recipe_id, day_of_week, meal_type, servings);
      entryId = Number(lastInsertRowid);
    }

    const entry = db.prepare(`
      SELECT mpe.*, r.title as recipe_title, r.image_url, r.total_time, r.difficulty, r.servings as original_servings
      FROM meal_plan_entries mpe JOIN recipes r ON mpe.recipe_id = r.id WHERE mpe.id = ?
    `).get(entryId);

    const fullPlan = getMealPlan(userId, week_start);
    return {
      message: replaced ? `„${recipe.title}" ersetzt das bisherige Rezept!` : `„${recipe.title}" zum Wochenplan hinzugefügt!`,
      replaced,
      entry,
      plan: fullPlan,
    };
  });

  // ─────────────────────────────────────────────
  // GET /suggestions – Rezeptvorschläge für Slot
  // ─────────────────────────────────────────────
  fastify.get('/suggestions', {
    schema: {
      description: 'Intelligente Rezeptvorschläge für einen Slot',
      tags: ['Wochenplan'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          dayIdx: { type: 'integer', minimum: 0, maximum: 6 },
          mealType: { type: 'string', enum: ['fruehstueck', 'mittag', 'abendessen', 'snack'] },
          excludeRecipeIds: { type: 'string' },
          planId: { type: 'integer' },
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
        },
      },
    },
  }, async (request) => {
    const { dayIdx = 0, mealType = 'mittag', limit = 8, planId } = request.query;
    const excludeRecipeIds = request.query.excludeRecipeIds
      ? request.query.excludeRecipeIds.split(',').map(Number).filter(Boolean)
      : [];
    const suggestions = getSuggestions(request.user.id, { dayIdx, mealType, excludeRecipeIds, planId, limit });
    return { suggestions };
  });

  // ─────────────────────────────────────────────
  // POST /:planId/entry – Neuen Eintrag hinzufügen
  // ─────────────────────────────────────────────
  fastify.post('/:planId/entry', {
    schema: {
      description: 'Neuen Eintrag zu einem Wochenplan hinzufügen',
      tags: ['Wochenplan'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['recipe_id', 'day_of_week', 'meal_type'],
        properties: {
          recipe_id: { type: 'integer' },
          day_of_week: { type: 'integer', minimum: 0, maximum: 6 },
          meal_type: { type: 'string', enum: ['fruehstueck', 'mittag', 'abendessen', 'snack'] },
          servings: { type: 'integer', minimum: 1, default: 4 },
        },
      },
    },
  }, async (request, reply) => {
    const { recipe_id, day_of_week, meal_type, servings = 4 } = request.body;
    const { planId } = request.params;
    const userId = request.user.id;

    const plan = db.prepare('SELECT id FROM meal_plans WHERE id = ? AND user_id = ?').get(planId, userId);
    if (!plan) return reply.status(404).send({ error: 'Plan nicht gefunden' });

    // Prüfen ob Slot schon belegt ist
    const existing = db.prepare(
      'SELECT id FROM meal_plan_entries WHERE meal_plan_id = ? AND day_of_week = ? AND meal_type = ?'
    ).get(planId, day_of_week, meal_type);
    if (existing) return reply.status(409).send({ error: 'Dieser Slot ist bereits belegt' });

    const { lastInsertRowid } = db.prepare(
      'INSERT INTO meal_plan_entries (meal_plan_id, recipe_id, day_of_week, meal_type, servings) VALUES (?, ?, ?, ?, ?)'
    ).run(planId, recipe_id, day_of_week, meal_type, servings);

    const entry = db.prepare(`
      SELECT mpe.*, r.title as recipe_title, r.image_url, r.total_time, r.difficulty, r.servings as original_servings
      FROM meal_plan_entries mpe JOIN recipes r ON mpe.recipe_id = r.id WHERE mpe.id = ?
    `).get(lastInsertRowid);

    return { message: 'Eintrag hinzugefügt!', entry };
  });

  // ─────────────────────────────────────────────
  // PUT /:planId/entry/:entryId – Eintrag ändern
  // ─────────────────────────────────────────────
  fastify.put('/:planId/entry/:entryId', {
    schema: {
      description: 'Wochenplan-Eintrag ändern (Rezept tauschen, Slot ändern)',
      tags: ['Wochenplan'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { recipe_id, servings, day_of_week, meal_type } = request.body;

    const result = db.prepare(`
      UPDATE meal_plan_entries
      SET recipe_id = COALESCE(?, recipe_id),
          servings = COALESCE(?, servings),
          day_of_week = COALESCE(?, day_of_week),
          meal_type = COALESCE(?, meal_type)
      WHERE id = ? AND meal_plan_id IN (SELECT id FROM meal_plans WHERE user_id = ?)
    `).run(recipe_id, servings, day_of_week, meal_type, request.params.entryId, request.user.id);

    if (result.changes === 0) return reply.status(404).send({ error: 'Eintrag nicht gefunden' });

    const entry = db.prepare(`
      SELECT mpe.*, r.title as recipe_title, r.image_url, r.total_time, r.difficulty, r.servings as original_servings
      FROM meal_plan_entries mpe JOIN recipes r ON mpe.recipe_id = r.id WHERE mpe.id = ?
    `).get(request.params.entryId);

    return { message: 'Eintrag aktualisiert!', entry };
  });

  // ─────────────────────────────────────────────
  // POST /:planId/entry/:entryId/move – Drag&Drop
  // ─────────────────────────────────────────────
  fastify.post('/:planId/entry/:entryId/move', {
    schema: {
      description: 'Eintrag in anderen Slot verschieben (Drag & Drop)',
      tags: ['Wochenplan'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { day_of_week, meal_type } = request.body;
    const { planId, entryId } = request.params;
    const userId = request.user.id;

    const plan = db.prepare('SELECT id FROM meal_plans WHERE id = ? AND user_id = ?').get(planId, userId);
    if (!plan) return reply.status(404).send({ error: 'Plan nicht gefunden' });

    // Prüfen ob Zielslot bereits belegt → tauschen
    const existingTarget = db.prepare(
      'SELECT id FROM meal_plan_entries WHERE meal_plan_id = ? AND day_of_week = ? AND meal_type = ? AND id != ?'
    ).get(planId, day_of_week, meal_type, entryId);

    if (existingTarget) {
      const source = db.prepare('SELECT day_of_week, meal_type FROM meal_plan_entries WHERE id = ?').get(entryId);
      db.prepare('UPDATE meal_plan_entries SET day_of_week = ?, meal_type = ? WHERE id = ?')
        .run(source.day_of_week, source.meal_type, existingTarget.id);
    }

    db.prepare('UPDATE meal_plan_entries SET day_of_week = ?, meal_type = ? WHERE id = ?')
      .run(day_of_week, meal_type, entryId);

    const weekStart = db.prepare('SELECT week_start FROM meal_plans WHERE id = ?').get(planId).week_start;
    const updatedPlan = getMealPlan(userId, weekStart);
    return { message: 'Eintrag verschoben!', plan: updatedPlan };
  });

  // ─────────────────────────────────────────────
  // POST /:planId/entry/:entryId/cooked – Toggle
  // ─────────────────────────────────────────────
  fastify.post('/:planId/entry/:entryId/cooked', {
    schema: { description: 'Gekocht-Status togglen + Vorräte anpassen', tags: ['Wochenplan'], security: [{ bearerAuth: [] }] },
  }, async (request) => {
    const userId = request.user.id;
    const entry = db.prepare(`
      SELECT mpe.*, r.servings as original_servings FROM meal_plan_entries mpe
      JOIN meal_plans mp ON mpe.meal_plan_id = mp.id
      JOIN recipes r ON mpe.recipe_id = r.id
      WHERE mpe.id = ? AND mp.user_id = ?
    `).get(request.params.entryId, userId);

    if (!entry) return { error: 'Eintrag nicht gefunden' };

    const newState = entry.is_cooked ? 0 : 1;
    db.prepare('UPDATE meal_plan_entries SET is_cooked = ? WHERE id = ?').run(newState, entry.id);

    // Kochhistorie + Rezept-Statistiken
    if (newState === 1) {
      db.prepare('INSERT INTO cooking_history (user_id, recipe_id, servings) VALUES (?, ?, ?)').run(
        userId, entry.recipe_id, entry.servings
      );
      db.prepare('UPDATE recipes SET times_cooked = times_cooked + 1, last_cooked_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(entry.recipe_id);
    }

    // ── Vorräte anpassen ──
    const ingredients = db.prepare('SELECT * FROM ingredients WHERE recipe_id = ?').all(entry.recipe_id);
    let pantryUpdated = 0;

    for (const ing of ingredients) {
      if (ing.is_optional) continue; // Optionale Zutaten nicht abziehen

      // Menge auf geplante Portionen skalieren
      const scaledAmount = ing.amount
        ? scaleIngredient(ing.amount, entry.original_servings, entry.servings)
        : null;

      if (!scaledAmount || scaledAmount <= 0) continue;

      // In Basiseinheit konvertieren (kg→g, l→ml etc.)
      const normalized = convertToBaseUnit(scaledAmount, ing.unit);

      // Passenden Vorrat suchen
      const pantryItem = db.prepare(
        'SELECT * FROM pantry WHERE user_id = ? AND LOWER(ingredient_name) = LOWER(?)'
      ).get(userId, ing.name);

      if (!pantryItem) continue; // Kein Vorrat vorhanden → nichts abziehen
      if (pantryItem.is_permanent) continue; // Dauerhafte Vorräte nicht verbrauchen

      // Vorrat in gleiche Einheit konvertieren
      const pantryNormalized = convertToBaseUnit(pantryItem.amount, pantryItem.unit);

      // Nur anpassen wenn gleiche Basiseinheit
      if (pantryNormalized.unit !== normalized.unit) continue;

      if (newState === 1) {
        // Gekocht → Vorrat abziehen
        const newAmount = Math.max(0, pantryNormalized.amount - normalized.amount);
        db.prepare('UPDATE pantry SET amount = ?, unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newAmount, pantryNormalized.unit, pantryItem.id);
        pantryUpdated++;
      } else {
        // Rückgängig → Vorrat wieder gutschreiben
        const newAmount = pantryNormalized.amount + normalized.amount;
        db.prepare('UPDATE pantry SET amount = ?, unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newAmount, pantryNormalized.unit, pantryItem.id);
        pantryUpdated++;
      }
    }

    return {
      message: newState ? 'Als gekocht markiert!' : 'Markierung entfernt',
      is_cooked: newState,
      pantryUpdated,
    };
  });

  // ─────────────────────────────────────────────
  // DELETE /:planId/entry/:entryId – Einzeleintrag
  // ─────────────────────────────────────────────
  fastify.delete('/:planId/entry/:entryId', {
    schema: { description: 'Einzelnen Eintrag entfernen', tags: ['Wochenplan'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const result = db.prepare(`
      DELETE FROM meal_plan_entries
      WHERE id = ? AND meal_plan_id IN (SELECT id FROM meal_plans WHERE id = ? AND user_id = ?)
    `).run(request.params.entryId, request.params.planId, request.user.id);
    if (result.changes === 0) return reply.status(404).send({ error: 'Eintrag nicht gefunden' });
    return { message: 'Eintrag entfernt' };
  });

  // ─────────────────────────────────────────────
  // DELETE /:id – Gesamten Plan löschen
  // ─────────────────────────────────────────────
  fastify.delete('/:id', {
    schema: { description: 'Wochenplan löschen', tags: ['Wochenplan'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const result = db.prepare('DELETE FROM meal_plans WHERE id = ? AND user_id = ?').run(request.params.id, request.user.id);
    if (result.changes === 0) return reply.status(404).send({ error: 'Plan nicht gefunden' });
    return { message: 'Wochenplan gelöscht' };
  });
}
