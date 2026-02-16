/**
 * ============================================
 * Wochenplan-Routen
 * ============================================
 * Algorithmische Wochenplanung mit optionalem KI-Reasoning
 */

import db from '../config/database.js';
import { generateWeekPlan, saveMealPlan, getMealPlan } from '../services/meal-planner.js';
import { getWeekStart } from '../utils/helpers.js';

export default async function mealplanRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  /**
   * POST /api/mealplan/generate
   * Wochenplan algorithmisch generieren (+ optionales KI-Reasoning)
   */
  fastify.post('/generate', {
    schema: {
      description: 'Wochenplan generieren (Algorithmus + KI-Reasoning)',
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
        },
      },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const options = {
        ...request.body,
        weekStart: request.body?.weekStart || getWeekStart(),
      };

      // Wochenplan algorithmisch generieren
      const planData = await generateWeekPlan(userId, options);

      // Plan speichern
      const planId = saveMealPlan(userId, options.weekStart, planData);

      return {
        planId,
        plan: planData,
        message: 'Wochenplan erfolgreich generiert!',
      };
    } catch (error) {
      return reply.status(400).send({ error: error.message });
    }
  });

  /**
   * GET /api/mealplan
   * Aktuellen Wochenplan abrufen
   */
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

    if (!plan) {
      return { plan: null, message: 'Kein Plan für diese Woche vorhanden' };
    }

    return { plan };
  });

  /**
   * GET /api/mealplan/history
   * Vergangene Wochenpläne
   */
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

  /**
   * PUT /api/mealplan/:planId/entry/:entryId
   * Einzelnen Eintrag im Wochenplan ändern (z.B. Rezept tauschen)
   */
  fastify.put('/:planId/entry/:entryId', {
    schema: {
      description: 'Wochenplan-Eintrag ändern',
      tags: ['Wochenplan'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { recipe_id, servings } = request.body;

    const result = db.prepare(`
      UPDATE meal_plan_entries SET recipe_id = COALESCE(?, recipe_id), servings = COALESCE(?, servings)
      WHERE id = ? AND meal_plan_id IN (SELECT id FROM meal_plans WHERE user_id = ?)
    `).run(recipe_id, servings, request.params.entryId, request.user.id);

    if (result.changes === 0) return reply.status(404).send({ error: 'Eintrag nicht gefunden' });
    return { message: 'Eintrag aktualisiert!' };
  });

  /**
   * POST /api/mealplan/:planId/entry/:entryId/cooked
   * Mahlzeit als gekocht markieren
   */
  fastify.post('/:planId/entry/:entryId/cooked', {
    schema: { description: 'Als gekocht markieren', tags: ['Wochenplan'], security: [{ bearerAuth: [] }] },
  }, async (request) => {
    const entry = db.prepare(`
      SELECT mpe.* FROM meal_plan_entries mpe
      JOIN meal_plans mp ON mpe.meal_plan_id = mp.id
      WHERE mpe.id = ? AND mp.user_id = ?
    `).get(request.params.entryId, request.user.id);

    if (!entry) return { error: 'Eintrag nicht gefunden' };

    // Als gekocht markieren
    db.prepare('UPDATE meal_plan_entries SET is_cooked = 1 WHERE id = ?').run(entry.id);

    // Kochhistorie und Rezept-Statistik aktualisieren
    db.prepare('INSERT INTO cooking_history (user_id, recipe_id, servings) VALUES (?, ?, ?)').run(
      request.user.id, entry.recipe_id, entry.servings
    );
    db.prepare('UPDATE recipes SET times_cooked = times_cooked + 1, last_cooked_at = CURRENT_TIMESTAMP WHERE id = ?').run(entry.recipe_id);

    return { message: 'Als gekocht markiert!' };
  });

  /**
   * DELETE /api/mealplan/:id
   * Wochenplan löschen
   */
  fastify.delete('/:id', {
    schema: { description: 'Wochenplan löschen', tags: ['Wochenplan'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const result = db.prepare('DELETE FROM meal_plans WHERE id = ? AND user_id = ?').run(request.params.id, request.user.id);
    if (result.changes === 0) return reply.status(404).send({ error: 'Plan nicht gefunden' });
    return { message: 'Wochenplan gelöscht' };
  });
}
