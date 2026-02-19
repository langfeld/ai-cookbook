/**
 * ============================================
 * Rezept-Sperren Routen
 * ============================================
 * Rezepte können für X Wochen aus der Wochenplan-Generierung
 * ausgeschlossen werden (z.B. saisonale Zutaten nicht verfügbar).
 */

import db from '../config/database.js';

export default async function recipeBlockRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ─────────────────────────────────────────────
  // GET / – Alle aktiven Sperren abrufen
  // ─────────────────────────────────────────────
  fastify.get('/', {
    schema: {
      description: 'Alle aktiven Rezept-Sperren des Benutzers',
      tags: ['Rezept-Sperren'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          includeExpired: { type: 'boolean', default: false },
        },
      },
    },
  }, async (request) => {
    const userId = request.user.id;
    const includeExpired = request.query.includeExpired === true || request.query.includeExpired === 'true';

    const whereClause = includeExpired
      ? 'WHERE rb.user_id = ?'
      : 'WHERE rb.user_id = ? AND rb.blocked_until >= date(\'now\')';

    const blocks = db.prepare(`
      SELECT rb.*, r.title as recipe_title, r.image_url
      FROM recipe_blocks rb
      JOIN recipes r ON rb.recipe_id = r.id
      ${whereClause}
      ORDER BY rb.blocked_until ASC
    `).all(userId);

    return { blocks };
  });

  // ─────────────────────────────────────────────
  // POST / – Rezept sperren
  // ─────────────────────────────────────────────
  fastify.post('/', {
    schema: {
      description: 'Rezept für X Wochen sperren',
      tags: ['Rezept-Sperren'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['recipe_id', 'weeks'],
        properties: {
          recipe_id: { type: 'integer' },
          weeks: { type: 'integer', minimum: 1, maximum: 52 },
          reason: { type: 'string', maxLength: 200 },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { recipe_id, weeks, reason } = request.body;

    // Rezept prüfen
    const recipe = db.prepare('SELECT id, title FROM recipes WHERE id = ? AND user_id = ?').get(recipe_id, userId);
    if (!recipe) {
      return reply.status(404).send({ error: 'Rezept nicht gefunden' });
    }

    // Ablaufdatum berechnen
    const blockedUntil = new Date();
    blockedUntil.setDate(blockedUntil.getDate() + weeks * 7);
    const blockedUntilStr = blockedUntil.toISOString().split('T')[0];

    // Upsert: Falls Sperre existiert, aktualisieren
    const existing = db.prepare(
      'SELECT id FROM recipe_blocks WHERE user_id = ? AND recipe_id = ?'
    ).get(userId, recipe_id);

    if (existing) {
      db.prepare(
        'UPDATE recipe_blocks SET blocked_until = ?, reason = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(blockedUntilStr, reason || null, existing.id);

      return {
        message: `„${recipe.title}" ist jetzt bis ${blockedUntilStr} gesperrt.`,
        block: {
          id: existing.id,
          recipe_id,
          recipe_title: recipe.title,
          blocked_until: blockedUntilStr,
          reason: reason || null,
        },
      };
    }

    const { lastInsertRowid } = db.prepare(
      'INSERT INTO recipe_blocks (user_id, recipe_id, blocked_until, reason) VALUES (?, ?, ?, ?)'
    ).run(userId, recipe_id, blockedUntilStr, reason || null);

    return {
      message: `„${recipe.title}" für ${weeks} Woche${weeks > 1 ? 'n' : ''} gesperrt.`,
      block: {
        id: Number(lastInsertRowid),
        recipe_id,
        recipe_title: recipe.title,
        blocked_until: blockedUntilStr,
        reason: reason || null,
      },
    };
  });

  // ─────────────────────────────────────────────
  // DELETE /:id – Sperre aufheben
  // ─────────────────────────────────────────────
  fastify.delete('/:id', {
    schema: {
      description: 'Rezept-Sperre aufheben',
      tags: ['Rezept-Sperren'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params;

    const block = db.prepare(
      'SELECT id FROM recipe_blocks WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!block) {
      return reply.status(404).send({ error: 'Sperre nicht gefunden' });
    }

    db.prepare('DELETE FROM recipe_blocks WHERE id = ?').run(id);

    return { message: 'Sperre aufgehoben' };
  });

  // ─────────────────────────────────────────────
  // DELETE /recipe/:recipeId – Sperre per Rezept-ID aufheben
  // ─────────────────────────────────────────────
  fastify.delete('/recipe/:recipeId', {
    schema: {
      description: 'Rezept-Sperre per Rezept-ID aufheben',
      tags: ['Rezept-Sperren'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { recipeId: { type: 'integer' } },
        required: ['recipeId'],
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { recipeId } = request.params;

    const result = db.prepare(
      'DELETE FROM recipe_blocks WHERE user_id = ? AND recipe_id = ?'
    ).run(userId, recipeId);

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Keine Sperre für dieses Rezept gefunden' });
    }

    return { message: 'Sperre aufgehoben' };
  });
}
