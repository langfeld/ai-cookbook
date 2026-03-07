/**
 * ============================================
 * Öffentliche Shared-Recipes-Route
 * ============================================
 * Kein Auth erforderlich – zeigt geteilte Rezepte per Token an.
 */

import db from '../config/database.js';

export default async function sharedRecipesRoutes(fastify) {
  /**
   * GET /api/shared-recipes/:token
   * Öffentlicher Endpunkt – zeigt ein geteiltes Rezept an.
   * KEIN Auth erforderlich!
   */
  fastify.get('/:token', {
    schema: {
      description: 'Geteiltes Rezept anzeigen (öffentlich)',
      tags: ['Rezepte'],
    },
  }, async (request, reply) => {
    const token = request.params.token;

    const share = db.prepare(`
      SELECT rs.recipe_id, rs.expires_at, rs.created_by, u.username as shared_by_name
      FROM recipe_shares rs
      JOIN users u ON u.id = rs.created_by
      WHERE rs.share_token = ?
    `).get(token);

    if (!share) {
      return reply.code(404).send({ error: 'Share-Link nicht gefunden oder ungültig' });
    }

    // Ablauf prüfen
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return reply.code(410).send({ error: 'Share-Link ist abgelaufen' });
    }

    // Rezeptdaten laden
    const recipe = db.prepare(`
      SELECT r.*, u.username as author_name
      FROM recipes r
      LEFT JOIN users u ON u.id = r.created_by_user_id
      WHERE r.id = ?
    `).get(share.recipe_id);

    if (!recipe) {
      return reply.code(404).send({ error: 'Rezept nicht mehr verfügbar' });
    }

    const ingredients = db.prepare(
      'SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY sort_order'
    ).all(share.recipe_id);

    const steps = db.prepare(
      'SELECT * FROM cooking_steps WHERE recipe_id = ? ORDER BY step_number'
    ).all(share.recipe_id);

    const categories = db.prepare(`
      SELECT c.id, c.name, c.color, c.icon
      FROM categories c
      JOIN recipe_categories rc ON rc.category_id = c.id
      WHERE rc.recipe_id = ?
    `).all(share.recipe_id);

    return {
      shared_by: share.shared_by_name,
      recipe: {
        ...recipe,
        ingredients,
        steps,
        categories,
        // Sensible Felder entfernen
        user_id: undefined,
        household_id: undefined,
        created_by_user_id: undefined,
      },
    };
  });
}
