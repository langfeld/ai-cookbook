/**
 * ============================================
 * Kategorien-Routen
 * ============================================
 * CRUD für benutzerdefinierte Rezeptkategorien.
 */

import db from '../config/database.js';

export default async function categoriesRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  /**
   * GET /api/categories
   * Alle Kategorien des Benutzers
   */
  fastify.get('/', {
    schema: { description: 'Kategorien auflisten', tags: ['Kategorien'], security: [{ bearerAuth: [] }] },
  }, async (request) => {
    const categories = db.prepare(`
      SELECT c.*, COUNT(rc.recipe_id) as recipe_count
      FROM categories c
      LEFT JOIN recipe_categories rc ON c.id = rc.category_id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.sort_order
    `).all(request.user.id);

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

    // Maximale sort_order ermitteln
    const maxOrder = db.prepare(
      'SELECT MAX(sort_order) as max FROM categories WHERE user_id = ?'
    ).get(userId);

    const result = db.prepare(
      'INSERT INTO categories (user_id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, name, icon || '🍽️', color || '#6366f1', (maxOrder.max || 0) + 1);

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
    const result = db.prepare(
      'UPDATE categories SET name=COALESCE(?,name), icon=COALESCE(?,icon), color=COALESCE(?,color), sort_order=COALESCE(?,sort_order) WHERE id=? AND user_id=?'
    ).run(name, icon, color, sort_order, request.params.id, request.user.id);

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
    const result = db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(request.params.id, request.user.id);
    if (result.changes === 0) return reply.status(404).send({ error: 'Kategorie nicht gefunden' });
    return { message: 'Kategorie gelöscht' };
  });
}
