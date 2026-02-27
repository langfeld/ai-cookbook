/**
 * ============================================
 * Zutat-Einstellungen-Routen
 * ============================================
 * Verwaltung von Zutat-Zusammenfassungen (Aliase)
 * und geblockten Zutaten:
 *
 * Aliase: "Gurke Mini" → "Gurke-Mini" usw.
 * Aliase werden beim Generieren der Einkaufsliste
 * automatisch angewandt, um doppelte Einträge zu vermeiden.
 *
 * Geblockte Zutaten: werden bei der Einkaufslisten-
 * Generierung komplett herausgefiltert.
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

  // ─────────────────────────────────────────────
  // GET /blocked – Alle geblockten Zutaten
  // ─────────────────────────────────────────────
  fastify.get('/blocked', {
    schema: {
      description: 'Alle geblockten Zutaten des Benutzers abrufen',
      tags: ['Zutat-Einstellungen'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const blocked = db.prepare(
      'SELECT * FROM blocked_ingredients WHERE user_id = ? ORDER BY ingredient_name'
    ).all(request.user.id);
    return { blocked };
  });

  // ─────────────────────────────────────────────
  // POST /blocked – Zutat blockieren
  // ─────────────────────────────────────────────
  fastify.post('/blocked', {
    schema: {
      description: 'Zutat für zukünftige Einkaufslisten blockieren',
      tags: ['Zutat-Einstellungen'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['ingredient_name'],
        properties: {
          ingredient_name: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const ingredientName = request.body.ingredient_name.trim();

    try {
      db.prepare(
        'INSERT OR IGNORE INTO blocked_ingredients (user_id, ingredient_name) VALUES (?, ?)'
      ).run(userId, ingredientName);
    } catch {
      // UNIQUE constraint – bereits geblockt, kein Fehler
    }

    return reply.status(201).send({ success: true, ingredient_name: ingredientName });
  });

  // ─────────────────────────────────────────────
  // DELETE /blocked/:id – Block aufheben
  // ─────────────────────────────────────────────
  fastify.delete('/blocked/:id', {
    schema: {
      description: 'Zutat-Block aufheben',
      tags: ['Zutat-Einstellungen'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
      },
    },
  }, async (request, reply) => {
    const result = db.prepare(
      'DELETE FROM blocked_ingredients WHERE id = ? AND user_id = ?'
    ).run(request.params.id, request.user.id);

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Geblockte Zutat nicht gefunden.' });
    }

    return { success: true };
  });

  // ─────────────────────────────────────────────
  // GET /export – Kombinierter Export (Aliase + Blocks)
  // ─────────────────────────────────────────────
  fastify.get('/export', {
    schema: {
      description: 'Zutaten-Einstellungen exportieren (Aliase + geblockte Zutaten)',
      tags: ['Zutat-Einstellungen'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;

    const aliases = db.prepare(
      'SELECT canonical_name, alias_name FROM ingredient_aliases WHERE user_id = ? ORDER BY canonical_name, alias_name'
    ).all(userId);

    const blocked = db.prepare(
      'SELECT ingredient_name FROM blocked_ingredients WHERE user_id = ? ORDER BY ingredient_name'
    ).all(userId);

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'Zauberjournal',
      type: 'ingredient-settings',
      alias_count: aliases.length,
      blocked_count: blocked.length,
      aliases: aliases.map(a => ({
        canonical_name: a.canonical_name,
        alias_name: a.alias_name,
      })),
      blocked_ingredients: blocked.map(b => ({
        ingredient_name: b.ingredient_name,
      })),
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="zutaten-einstellungen-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  // ─────────────────────────────────────────────
  // POST /import – Kombinierter Import (Aliase + Blocks)
  // ─────────────────────────────────────────────
  fastify.post('/import', {
    schema: {
      description: 'Zutaten-Einstellungen importieren (Aliase + geblockte Zutaten)',
      tags: ['Zutat-Einstellungen'],
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
            return reply.status(400).send({ error: 'Ungültiges JSON-Format in der Datei.' });
          }
        }
      }
    } else {
      importData = request.body;
    }

    if (!importData) {
      return reply.status(400).send({ error: 'Keine Daten zum Importieren.' });
    }

    // Kompatibilität: Altes Format (nur aliases) und neues Format (aliases + blocked_ingredients)
    const hasAliases = Array.isArray(importData.aliases);
    const hasBlocked = Array.isArray(importData.blocked_ingredients);

    if (!hasAliases && !hasBlocked) {
      return reply.status(400).send({ error: 'Ungültiges Export-Format. Erwartet: { aliases: [...] } und/oder { blocked_ingredients: [...] }' });
    }

    // Count-Limits
    if (hasAliases && importData.aliases.length > 5000) {
      return reply.status(400).send({ error: 'Maximal 5000 Aliase pro Import erlaubt.' });
    }
    if (hasBlocked && importData.blocked_ingredients.length > 5000) {
      return reply.status(400).send({ error: 'Maximal 5000 geblockte Zutaten pro Import erlaubt.' });
    }

    let aliasImported = 0, aliasUpdated = 0, aliasSkipped = 0;
    let blockedImported = 0, blockedSkipped = 0;

    const upsertAlias = db.prepare(`
      INSERT INTO ingredient_aliases (user_id, canonical_name, alias_name)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, alias_name) DO UPDATE SET
        canonical_name = excluded.canonical_name
    `);

    const findExistingAlias = db.prepare(
      'SELECT id FROM ingredient_aliases WHERE user_id = ? AND LOWER(alias_name) = LOWER(?)'
    );

    const insertBlocked = db.prepare(
      'INSERT OR IGNORE INTO blocked_ingredients (user_id, ingredient_name) VALUES (?, ?)'
    );

    const transaction = db.transaction(() => {
      // Aliase importieren
      if (hasAliases) {
        for (const alias of importData.aliases) {
          try {
            const canonicalName = String(alias.canonical_name || '').trim().slice(0, 300);
            const aliasName = String(alias.alias_name || '').trim().slice(0, 300);
            if (!canonicalName || !aliasName) { aliasSkipped++; continue; }

            const existing = findExistingAlias.get(userId, aliasName);
            upsertAlias.run(userId, canonicalName, aliasName);
            if (existing) { aliasUpdated++; } else { aliasImported++; }
          } catch {
            aliasSkipped++;
          }
        }
      }

      // Geblockte Zutaten importieren
      if (hasBlocked) {
        for (const item of importData.blocked_ingredients) {
          try {
            const name = String(item.ingredient_name || '').trim().slice(0, 300);
            if (!name) { blockedSkipped++; continue; }

            const result = insertBlocked.run(userId, name);
            if (result.changes > 0) { blockedImported++; } else { blockedSkipped++; }
          } catch {
            blockedSkipped++;
          }
        }
      }
    });

    transaction();

    return {
      message: `Aliase: ${aliasImported} neu, ${aliasUpdated} aktualisiert, ${aliasSkipped} übersprungen. Geblockte Zutaten: ${blockedImported} neu, ${blockedSkipped} übersprungen.`,
      aliases: { imported: aliasImported, updated: aliasUpdated, skipped: aliasSkipped },
      blocked: { imported: blockedImported, skipped: blockedSkipped },
    };
  });
}
