/**
 * ============================================
 * Zutat-Alias-Routen
 * ============================================
 * Verwaltung von Zutat-Zusammenfassungen:
 * "Gurke Mini" → "Gurke-Mini" usw.
 *
 * Aliase werden beim Generieren der Einkaufsliste
 * automatisch angewandt, um doppelte Einträge zu vermeiden.
 */

import db from '../config/database.js';

export default async function ingredientAliasRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ─────────────────────────────────────────────
  // GET / – Alle Aliase des Benutzers
  // ─────────────────────────────────────────────
  fastify.get('/', {
    schema: {
      description: 'Alle Zutat-Aliase des Benutzers abrufen',
      tags: ['Zutat-Aliase'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const aliases = db.prepare(
      'SELECT * FROM ingredient_aliases WHERE user_id = ? ORDER BY canonical_name, alias_name'
    ).all(request.user.id);

    // Gruppiert nach canonical_name für bessere Darstellung
    const grouped = {};
    for (const a of aliases) {
      if (!grouped[a.canonical_name]) {
        grouped[a.canonical_name] = { canonical_name: a.canonical_name, aliases: [] };
      }
      grouped[a.canonical_name].aliases.push({ id: a.id, alias_name: a.alias_name, created_at: a.created_at });
    }

    return { aliases, grouped: Object.values(grouped) };
  });

  // ─────────────────────────────────────────────
  // POST / – Neuen Alias erstellen
  // ─────────────────────────────────────────────
  fastify.post('/', {
    schema: {
      description: 'Neuen Zutat-Alias erstellen (z.B. "Gurke Mini" → "Gurke-Mini")',
      tags: ['Zutat-Aliase'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['canonical_name', 'alias_name'],
        properties: {
          canonical_name: { type: 'string', minLength: 1 },
          alias_name: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { canonical_name, alias_name } = request.body;

    // Keine Selbst-Aliase
    if (canonical_name.toLowerCase().trim() === alias_name.toLowerCase().trim()) {
      return reply.status(400).send({ error: 'Alias und Hauptname dürfen nicht identisch sein.' });
    }

    // Prüfen ob der Alias-Name bereits als canonical_name eines anderen Alias existiert
    // Falls ja, cascade: alle Aliase dieses canonical_name werden auf den neuen canonical_name umgebogen
    const existingAsCanonical = db.prepare(
      'SELECT * FROM ingredient_aliases WHERE user_id = ? AND canonical_name = ? COLLATE NOCASE'
    ).all(userId, alias_name.trim());

    const transaction = db.transaction(() => {
      // Cascade: Wenn alias_name selbst ein canonical_name war, alle seine Aliase umhängen
      if (existingAsCanonical.length > 0) {
        db.prepare(
          'UPDATE ingredient_aliases SET canonical_name = ? WHERE user_id = ? AND canonical_name = ? COLLATE NOCASE'
        ).run(canonical_name.trim(), userId, alias_name.trim());
      }

      // Neuen Alias einfügen (oder ignorieren wenn schon vorhanden)
      db.prepare(
        'INSERT OR REPLACE INTO ingredient_aliases (user_id, canonical_name, alias_name) VALUES (?, ?, ?)'
      ).run(userId, canonical_name.trim(), alias_name.trim());
    });

    transaction();

    return reply.status(201).send({ success: true });
  });

  // ─────────────────────────────────────────────
  // POST /merge – Zwei Einkauflisten-Items zusammenlegen
  // ─────────────────────────────────────────────
  fastify.post('/merge', {
    schema: {
      description: 'Zwei Einkaufslisten-Items zusammenlegen + Alias erstellen',
      tags: ['Zutat-Aliase'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['source_item_ids', 'target_item_id', 'canonical_name'],
        properties: {
          source_item_ids: {
            type: 'array',
            items: { type: 'integer' },
            minItems: 1,
            description: 'Items die zusammengelegt werden (werden gelöscht)',
          },
          target_item_id: { type: 'integer', description: 'Ziel-Item (wird aktualisiert)' },
          canonical_name: { type: 'string', minLength: 1, description: 'Gewählter Hauptname' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { source_item_ids, target_item_id, canonical_name } = request.body;

    // Ziel-Item laden
    const targetItem = db.prepare(`
      SELECT sli.* FROM shopping_list_items sli
      JOIN shopping_lists sl ON sli.shopping_list_id = sl.id
      WHERE sli.id = ? AND sl.user_id = ?
    `).get(target_item_id, userId);

    if (!targetItem) {
      return reply.status(404).send({ error: 'Ziel-Artikel nicht gefunden.' });
    }

    // Source-Items laden
    const sourceItems = [];
    for (const sourceId of source_item_ids) {
      const item = db.prepare(`
        SELECT sli.* FROM shopping_list_items sli
        JOIN shopping_lists sl ON sli.shopping_list_id = sl.id
        WHERE sli.id = ? AND sl.user_id = ?
      `).get(sourceId, userId);
      if (!item) {
        return reply.status(404).send({ error: `Artikel mit ID ${sourceId} nicht gefunden.` });
      }
      sourceItems.push(item);
    }

    const transaction = db.transaction(() => {
      let totalAmount = targetItem.amount || 0;
      let newUnit = targetItem.unit;
      let targetRecipeIds = [];
      try { targetRecipeIds = JSON.parse(targetItem.recipe_ids || '[]'); } catch {}
      let totalPantryDeducted = 0;

      // Alle Source-Items in das Ziel mergen
      const allNames = [targetItem.ingredient_name];
      for (const sourceItem of sourceItems) {
        totalAmount += (sourceItem.amount || 0);
        if (!newUnit && sourceItem.unit) newUnit = sourceItem.unit;

        let sourceRecipeIds = [];
        try { sourceRecipeIds = JSON.parse(sourceItem.recipe_ids || '[]'); } catch {}
        targetRecipeIds = [...new Set([...targetRecipeIds, ...sourceRecipeIds])];

        totalPantryDeducted += (sourceItem.pantry_deducted || 0);
        allNames.push(sourceItem.ingredient_name);

        // Source-Item löschen
        db.prepare('DELETE FROM shopping_list_items WHERE id = ?').run(sourceItem.id);
      }

      // Ziel-Item aktualisieren
      db.prepare(`
        UPDATE shopping_list_items
        SET ingredient_name = ?, amount = ?, unit = ?, recipe_ids = ?,
            pantry_deducted = pantry_deducted + ?
        WHERE id = ?
      `).run(
        canonical_name.trim(),
        totalAmount,
        newUnit,
        JSON.stringify(targetRecipeIds),
        totalPantryDeducted,
        target_item_id
      );

      // Aliase erstellen (alle abweichenden Namen → canonical)
      for (const name of allNames) {
        if (name.toLowerCase().trim() !== canonical_name.toLowerCase().trim()) {
          db.prepare(
            'INSERT OR REPLACE INTO ingredient_aliases (user_id, canonical_name, alias_name) VALUES (?, ?, ?)'
          ).run(userId, canonical_name.trim(), name.trim());
        }
      }
    });

    transaction();

    // Aktualisierte Liste zurückgeben
    const list = db.prepare(
      'SELECT * FROM shopping_lists WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1'
    ).get(userId);

    if (!list) return reply.send({ success: true, items: [] });

    const items = db.prepare(
      'SELECT * FROM shopping_list_items WHERE shopping_list_id = ? ORDER BY ingredient_name'
    ).all(list.id);

    return { success: true, items, listId: list.id };
  });

  // ─────────────────────────────────────────────
  // DELETE /:id – Alias löschen
  // ─────────────────────────────────────────────
  fastify.delete('/:id', {
    schema: {
      description: 'Zutat-Alias löschen',
      tags: ['Zutat-Aliase'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
      },
    },
  }, async (request, reply) => {
    const result = db.prepare(
      'DELETE FROM ingredient_aliases WHERE id = ? AND user_id = ?'
    ).run(request.params.id, request.user.id);

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Alias nicht gefunden.' });
    }

    return { success: true };
  });
}
