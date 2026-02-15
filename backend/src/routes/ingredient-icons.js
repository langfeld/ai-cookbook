/**
 * ============================================
 * Ingredient Icons Routen
 * ============================================
 * Öffentlich: Icon-Mapping abrufen
 * Admin:      Icons verwalten (CRUD)
 */

import db from '../config/database.js';

export default async function ingredientIconRoutes(fastify) {

  // ============================================
  // GET /api/ingredient-icons — Alle Mappings (öffentlich für eingeloggte User)
  // ============================================
  fastify.get('/', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Alle Zutaten-Icon-Mappings abrufen',
      tags: ['Zutaten-Icons'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const icons = db.prepare('SELECT id, keyword, emoji FROM ingredient_icons ORDER BY keyword').all();
    return { icons };
  });

  // ============================================
  // POST /api/ingredient-icons — Neues Mapping (Admin)
  // ============================================
  fastify.post('/', {
    onRequest: [fastify.requireAdmin],
    schema: {
      description: 'Neues Zutaten-Icon-Mapping erstellen',
      tags: ['Zutaten-Icons'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['keyword', 'emoji'],
        properties: {
          keyword: { type: 'string', minLength: 1, maxLength: 100 },
          emoji: { type: 'string', minLength: 1, maxLength: 10 },
        },
      },
    },
  }, async (request, reply) => {
    const { keyword, emoji } = request.body;
    const normalized = keyword.trim().toLowerCase();

    // Prüfen ob Keyword bereits existiert
    const existing = db.prepare('SELECT id FROM ingredient_icons WHERE keyword = ?').get(normalized);
    if (existing) {
      return reply.status(409).send({ error: `Mapping für „${keyword}" existiert bereits.` });
    }

    const result = db.prepare('INSERT INTO ingredient_icons (keyword, emoji) VALUES (?, ?)').run(normalized, emoji.trim());

    return reply.status(201).send({
      id: result.lastInsertRowid,
      keyword: normalized,
      emoji: emoji.trim(),
      message: 'Mapping erstellt.',
    });
  });

  // ============================================
  // PUT /api/ingredient-icons/:id — Mapping aktualisieren (Admin)
  // ============================================
  fastify.put('/:id', {
    onRequest: [fastify.requireAdmin],
    schema: {
      description: 'Zutaten-Icon-Mapping aktualisieren',
      tags: ['Zutaten-Icons'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
      },
      body: {
        type: 'object',
        properties: {
          keyword: { type: 'string', minLength: 1, maxLength: 100 },
          emoji: { type: 'string', minLength: 1, maxLength: 10 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { keyword, emoji } = request.body;

    const existing = db.prepare('SELECT id FROM ingredient_icons WHERE id = ?').get(id);
    if (!existing) {
      return reply.status(404).send({ error: 'Mapping nicht gefunden.' });
    }

    const updates = [];
    const values = [];
    if (keyword) {
      const normalized = keyword.trim().toLowerCase();
      // Prüfen ob neues Keyword schon von anderem Mapping belegt ist
      const conflict = db.prepare('SELECT id FROM ingredient_icons WHERE keyword = ? AND id != ?').get(normalized, id);
      if (conflict) {
        return reply.status(409).send({ error: `Mapping für „${keyword}" existiert bereits.` });
      }
      updates.push('keyword = ?');
      values.push(normalized);
    }
    if (emoji) {
      updates.push('emoji = ?');
      values.push(emoji.trim());
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'Keine Änderungen angegeben.' });
    }

    values.push(id);
    db.prepare(`UPDATE ingredient_icons SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT id, keyword, emoji FROM ingredient_icons WHERE id = ?').get(id);
    return { ...updated, message: 'Mapping aktualisiert.' };
  });

  // ============================================
  // DELETE /api/ingredient-icons/:id — Mapping löschen (Admin)
  // ============================================
  fastify.delete('/:id', {
    onRequest: [fastify.requireAdmin],
    schema: {
      description: 'Zutaten-Icon-Mapping löschen',
      tags: ['Zutaten-Icons'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const result = db.prepare('DELETE FROM ingredient_icons WHERE id = ?').run(id);
    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Mapping nicht gefunden.' });
    }
    return { message: 'Mapping gelöscht.' };
  });

  // ============================================
  // POST /api/ingredient-icons/bulk — Mehrere Mappings auf einmal (Admin)
  // ============================================
  fastify.post('/bulk', {
    onRequest: [fastify.requireAdmin],
    schema: {
      description: 'Mehrere Zutaten-Icon-Mappings erstellen/aktualisieren',
      tags: ['Zutaten-Icons'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['icons'],
        properties: {
          icons: {
            type: 'array',
            items: {
              type: 'object',
              required: ['keyword', 'emoji'],
              properties: {
                keyword: { type: 'string' },
                emoji: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { icons } = request.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO ingredient_icons (keyword, emoji) VALUES (?, ?)');
    const upsertMany = db.transaction((items) => {
      let count = 0;
      for (const { keyword, emoji } of items) {
        stmt.run(keyword.trim().toLowerCase(), emoji.trim());
        count++;
      }
      return count;
    });
    const count = upsertMany(icons);
    return reply.status(201).send({ message: `${count} Mappings gespeichert.`, count });
  });
}
