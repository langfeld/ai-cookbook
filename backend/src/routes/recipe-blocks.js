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

  // ─────────────────────────────────────────────
  // GET /export – Rezept-Sperren exportieren
  // ─────────────────────────────────────────────
  fastify.get('/export', {
    schema: {
      description: 'Eigene Rezept-Sperren als JSON exportieren',
      tags: ['Rezept-Sperren'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;

    const blocks = db.prepare(`
      SELECT rb.*, r.title as recipe_title, u.username as owner
      FROM recipe_blocks rb
      JOIN recipes r ON rb.recipe_id = r.id
      JOIN users u ON rb.user_id = u.id
      WHERE rb.user_id = ?
      ORDER BY rb.blocked_until ASC
    `).all(userId);

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'Zauberjournal',
      type: 'recipe_blocks',
      block_count: blocks.length,
      blocks: blocks.map(b => ({
        recipe_title: b.recipe_title,
        recipe_id: b.recipe_id,
        blocked_until: b.blocked_until,
        reason: b.reason,
        created_at: b.created_at,
        owner: b.owner,
      })),
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="rezept-sperren-export-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  // ─────────────────────────────────────────────
  // POST /import – Rezept-Sperren importieren
  // ─────────────────────────────────────────────
  fastify.post('/import', {
    schema: {
      description: 'Rezept-Sperren aus JSON importieren',
      tags: ['Rezept-Sperren'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    let importData;

    const contentType = request.headers['content-type'] || '';
    if (contentType.includes('multipart')) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          try {
            importData = JSON.parse(buffer.toString('utf-8'));
          } catch {
            return reply.status(400).send({ error: 'Ungültiges JSON-Format.' });
          }
        }
      }
    } else {
      importData = request.body;
    }

    if (!importData?.blocks || !Array.isArray(importData.blocks)) {
      return reply.status(400).send({ error: 'Ungültiges Export-Format. Erwartet: { blocks: [...] }' });
    }

    if (importData.blocks.length === 0) {
      return reply.status(400).send({ error: 'Keine Sperren zum Importieren gefunden.' });
    }

    if (importData.blocks.length > 500) {
      return reply.status(400).send({ error: 'Maximal 500 Sperren pro Import erlaubt.' });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    const findRecipe = db.prepare(
      'SELECT id FROM recipes WHERE user_id = ? AND LOWER(title) = LOWER(?)'
    );
    const findExisting = db.prepare(
      'SELECT id FROM recipe_blocks WHERE user_id = ? AND recipe_id = ?'
    );
    const insertBlock = db.prepare(
      'INSERT INTO recipe_blocks (user_id, recipe_id, blocked_until, reason) VALUES (?, ?, ?, ?)'
    );
    const updateBlock = db.prepare(
      'UPDATE recipe_blocks SET blocked_until = ?, reason = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?'
    );

    const transaction = db.transaction(() => {
      for (const block of importData.blocks) {
        // Rezept per Titel oder ID finden
        let recipeId = block.recipe_id;
        if (block.recipe_title) {
          const recipe = findRecipe.get(userId, block.recipe_title);
          if (recipe) recipeId = recipe.id;
        }
        if (!recipeId) { skipped++; continue; }

        if (!block.blocked_until || !/^\d{4}-\d{2}-\d{2}/.test(block.blocked_until)) { skipped++; continue; }

        const existing = findExisting.get(userId, recipeId);
        if (existing) {
          updateBlock.run(String(block.blocked_until).slice(0, 30), block.reason ? String(block.reason).trim().slice(0, 500) : null, existing.id);
          updated++;
        } else {
          insertBlock.run(userId, recipeId, String(block.blocked_until).slice(0, 30), block.reason ? String(block.reason).trim().slice(0, 500) : null);
          imported++;
        }
      }
    });

    transaction();

    return {
      message: `${imported} neu importiert, ${updated} aktualisiert, ${skipped} übersprungen.`,
      imported,
      updated,
      skipped,
    };
  });
}
