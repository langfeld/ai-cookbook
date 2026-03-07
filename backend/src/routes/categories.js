/**
 * ============================================
 * Kategorien-Routen
 * ============================================
 * CRUD für benutzerdefinierte Rezeptkategorien.
 */

import db from '../config/database.js';
import { householdWhereClause } from '../config/database.js';

export default async function categoriesRoutes(fastify) {
  fastify.addHook('onRequest', fastify.resolveHousehold);

  /**
   * GET /api/categories
   * Alle Kategorien des Benutzers
   */
  fastify.get('/', {
    schema: { description: 'Kategorien auflisten', tags: ['Kategorien'], security: [{ bearerAuth: [] }] },
  }, async (request) => {
    const { clause: hhClause, params: hhParams } = householdWhereClause(request.user.id, request.householdId, 'c');
    const categories = db.prepare(`
      SELECT c.*, COUNT(rc.recipe_id) as recipe_count
      FROM categories c
      LEFT JOIN recipe_categories rc ON c.id = rc.category_id
      WHERE (${hhClause})
      GROUP BY c.id
      ORDER BY c.sort_order
    `).all(...hhParams);

    return { categories };
  });

  /**
   * POST /api/categories
   * Neue Kategorie erstellen
   */
  fastify.post('/', {
    schema: {
      description: 'Neue Kategorie erstellen',
      tags: ['Kategorien'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 },
          icon: { type: 'string', maxLength: 10 },
          color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        },
      },
    },
  }, async (request, reply) => {
    const { name, icon, color } = request.body;
    const userId = request.user.id;
    const householdId = request.householdId || null;

    // Maximale sort_order ermitteln
    const { clause: hhClause, params: hhParams } = householdWhereClause(userId, request.householdId);
    const maxOrder = db.prepare(
      `SELECT MAX(sort_order) as max FROM categories WHERE (${hhClause})`
    ).get(...hhParams);

    const result = db.prepare(
      'INSERT INTO categories (user_id, name, icon, color, sort_order, household_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, name, icon || '🍽️', color || '#6366f1', (maxOrder.max || 0) + 1, householdId);

    return reply.status(201).send({
      id: result.lastInsertRowid,
      message: 'Kategorie erstellt!',
    });
  });

  /**
   * PUT /api/categories/:id
   * Kategorie aktualisieren
   */
  fastify.put('/:id', {
    schema: { description: 'Kategorie aktualisieren', tags: ['Kategorien'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { name, icon, color, sort_order } = request.body;
    const { clause: hhClause, params: hhParams } = householdWhereClause(request.user.id, request.householdId);
    const result = db.prepare(
      `UPDATE categories SET name=COALESCE(?,name), icon=COALESCE(?,icon), color=COALESCE(?,color), sort_order=COALESCE(?,sort_order) WHERE id=? AND (${hhClause})`
    ).run(name, icon, color, sort_order, request.params.id, ...hhParams);

    if (result.changes === 0) return reply.status(404).send({ error: 'Kategorie nicht gefunden' });
    return { message: 'Kategorie aktualisiert!' };
  });

  /**
   * DELETE /api/categories/:id
   * Kategorie löschen
   */
  fastify.delete('/:id', {
    schema: { description: 'Kategorie löschen', tags: ['Kategorien'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { clause: hhClause, params: hhParams } = householdWhereClause(request.user.id, request.householdId);
    const result = db.prepare(`DELETE FROM categories WHERE id = ? AND (${hhClause})`).run(request.params.id, ...hhParams);
    if (result.changes === 0) return reply.status(404).send({ error: 'Kategorie nicht gefunden' });
    return { message: 'Kategorie gelöscht' };
  });
}
