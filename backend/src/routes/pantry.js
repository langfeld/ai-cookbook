/**
 * ============================================
 * Vorratsschrank-Routen
 * ============================================
 * Verwaltung des "Vorratsschranks" - was haben wir noch da?
 * Überschüsse vom Einkauf werden hier automatisch eingetragen.
 */

import db from '../config/database.js';

export default async function pantryRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  /**
   * GET /api/pantry
   * Alle Vorräte auflisten
   */
  fastify.get('/', {
    schema: {
      description: 'Vorratsschrank anzeigen',
      tags: ['Vorratsschrank'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          expiring: { type: 'boolean' }, // Nur bald ablaufende
        },
      },
    },
  }, async (request) => {
    const userId = request.user.id;
    const { category, expiring } = request.query;

    let query = 'SELECT * FROM pantry WHERE user_id = ? AND amount > 0';
    const params = [userId];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (expiring) {
      // Items die in den nächsten 7 Tagen ablaufen
      query += ` AND expiry_date IS NOT NULL AND expiry_date <= date('now', '+7 days')`;
    }

    query += ' ORDER BY category, ingredient_name';

    const items = db.prepare(query).all(...params);

    // Kategorien für Filter
    const categories = db.prepare(
      'SELECT DISTINCT category FROM pantry WHERE user_id = ? AND amount > 0 ORDER BY category'
    ).all(userId);

    // Bald ablaufende Items zählen
    const expiringCount = db.prepare(
      `SELECT COUNT(*) as count FROM pantry WHERE user_id = ? AND amount > 0 AND expiry_date IS NOT NULL AND expiry_date <= date('now', '+7 days')`
    ).get(userId);

    return {
      items,
      categories: categories.map(c => c.category),
      expiringCount: expiringCount.count,
    };
  });

  /**
   * POST /api/pantry
   * Neuen Vorrat hinzufügen
   */
  fastify.post('/', {
    schema: {
      description: 'Vorrat hinzufügen',
      tags: ['Vorratsschrank'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['ingredient_name', 'amount'],
        properties: {
          ingredient_name: { type: 'string' },
          amount: { type: 'number', minimum: 0 },
          unit: { type: 'string' },
          category: { type: 'string' },
          expiry_date: { type: 'string', format: 'date' },
          notes: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { ingredient_name, amount, unit, category, expiry_date, notes } = request.body;

    // Prüfen ob Zutat schon existiert -> Menge addieren
    const existing = db.prepare(
      'SELECT * FROM pantry WHERE user_id = ? AND LOWER(ingredient_name) = LOWER(?)'
    ).get(userId, ingredient_name);

    if (existing) {
      db.prepare(
        'UPDATE pantry SET amount = amount + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(amount, existing.id);

      return { id: existing.id, message: 'Menge aktualisiert!' };
    }

    const result = db.prepare(
      'INSERT INTO pantry (user_id, ingredient_name, amount, unit, category, expiry_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(userId, ingredient_name, amount, unit, category || 'Sonstiges', expiry_date, notes);

    return reply.status(201).send({
      id: result.lastInsertRowid,
      message: 'Vorrat hinzugefügt!',
    });
  });

  /**
   * PUT /api/pantry/:id
   * Vorrat aktualisieren
   */
  fastify.put('/:id', {
    schema: { description: 'Vorrat aktualisieren', tags: ['Vorratsschrank'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { amount, unit, category, expiry_date, notes } = request.body;

    const result = db.prepare(`
      UPDATE pantry SET
        amount = COALESCE(?, amount),
        unit = COALESCE(?, unit),
        category = COALESCE(?, category),
        expiry_date = COALESCE(?, expiry_date),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(amount, unit, category, expiry_date, notes, request.params.id, request.user.id);

    if (result.changes === 0) return reply.status(404).send({ error: 'Vorrat nicht gefunden' });
    return { message: 'Vorrat aktualisiert!' };
  });

  /**
   * DELETE /api/pantry/:id
   * Vorrat entfernen
   */
  fastify.delete('/:id', {
    schema: { description: 'Vorrat löschen', tags: ['Vorratsschrank'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const result = db.prepare(
      'DELETE FROM pantry WHERE id = ? AND user_id = ?'
    ).run(request.params.id, request.user.id);

    if (result.changes === 0) return reply.status(404).send({ error: 'Vorrat nicht gefunden' });
    return { message: 'Vorrat entfernt' };
  });

  /**
   * POST /api/pantry/:id/use
   * Menge aus dem Vorratsschrank verwenden/abziehen
   */
  fastify.post('/:id/use', {
    schema: {
      description: 'Menge aus Vorrat entnehmen',
      tags: ['Vorratsschrank'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: { type: 'number', minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const { amount } = request.body;
    const item = db.prepare(
      'SELECT * FROM pantry WHERE id = ? AND user_id = ?'
    ).get(request.params.id, request.user.id);

    if (!item) return reply.status(404).send({ error: 'Vorrat nicht gefunden' });

    const newAmount = Math.max(0, item.amount - amount);
    db.prepare(
      'UPDATE pantry SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(newAmount, item.id);

    // Wenn Menge 0, optional löschen
    if (newAmount === 0) {
      db.prepare('DELETE FROM pantry WHERE id = ?').run(item.id);
      return { message: 'Vorrat aufgebraucht und entfernt', remaining: 0 };
    }

    return { message: 'Menge entnommen', remaining: newAmount };
  });
}
