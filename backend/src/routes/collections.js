/**
 * ============================================
 * Sammlungen-Routen (Collections)
 * ============================================
 * CRUD für Sammlungen + Rezept-Zuordnung (n:m).
 * Jeder Benutzer kann eigene Sammlungen erstellen
 * und Rezepte zu mehreren Sammlungen hinzufügen.
 */

import db from '../config/database.js';
import { householdWhereClause } from '../config/database.js';

export default async function collectionsRoutes(fastify) {
  fastify.addHook('onRequest', fastify.resolveHousehold);

  // ─────────────────────────────────────────────
  // GET / – Alle Sammlungen des Benutzers
  // ─────────────────────────────────────────────
  fastify.get('/', {
    schema: {
      description: 'Alle Sammlungen des Benutzers mit Rezeptanzahl',
      tags: ['Sammlungen'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const hhWhere = householdWhereClause(request.user.id, request.householdId, 'c');
    const collections = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM recipe_collections rc WHERE rc.collection_id = c.id) as recipe_count
      FROM collections c
      WHERE ${hhWhere.clause}
      ORDER BY c.sort_order ASC, c.name ASC
    `).all(...hhWhere.params);

    return { collections };
  });

  // ─────────────────────────────────────────────
  // POST / – Neue Sammlung erstellen
  // ─────────────────────────────────────────────
  fastify.post('/', {
    schema: {
      description: 'Neue Sammlung erstellen',
      tags: ['Sammlungen'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          icon: { type: 'string', maxLength: 10, default: '📁' },
          color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', default: '#6366f1' },
        },
      },
    },
  }, async (request, reply) => {
    const { name, icon = '📁', color = '#6366f1' } = request.body;
    const userId = request.user.id;
    const hhWhere = householdWhereClause(userId, request.householdId);

    // Prüfen ob Name bereits existiert
    const existing = db.prepare(
      `SELECT id FROM collections WHERE (${hhWhere.clause}) AND name = ?`
    ).get(...hhWhere.params, name);
    if (existing) {
      return reply.status(409).send({ error: `Sammlung "${name}" existiert bereits.` });
    }

    // Höchste Sortierreihenfolge ermitteln
    const maxOrder = db.prepare(
      `SELECT COALESCE(MAX(sort_order), 0) as max_order FROM collections WHERE (${hhWhere.clause})`
    ).get(...hhWhere.params).max_order;

    const { lastInsertRowid } = db.prepare(
      'INSERT INTO collections (user_id, name, icon, color, sort_order, household_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, name, icon, color, maxOrder + 1, request.householdId || null);

    const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(lastInsertRowid);
    return { message: `Sammlung "${name}" erstellt!`, collection: { ...collection, recipe_count: 0 } };
  });

  // ─────────────────────────────────────────────
  // PUT /:id – Sammlung bearbeiten
  // ─────────────────────────────────────────────
  fastify.put('/:id', {
    schema: {
      description: 'Sammlung bearbeiten',
      tags: ['Sammlungen'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          icon: { type: 'string', maxLength: 10 },
          color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, icon, color } = request.body;
    const hhWhere = householdWhereClause(request.user.id, request.householdId);

    const result = db.prepare(`
      UPDATE collections
      SET name = COALESCE(?, name),
          icon = COALESCE(?, icon),
          color = COALESCE(?, color),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND (${hhWhere.clause})
    `).run(name, icon, color, id, ...hhWhere.params);

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Sammlung nicht gefunden.' });
    }

    const collection = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM recipe_collections rc WHERE rc.collection_id = c.id) as recipe_count
      FROM collections c WHERE c.id = ?
    `).get(id);

    return { message: 'Sammlung aktualisiert!', collection };
  });

  // ─────────────────────────────────────────────
  // DELETE /:id – Sammlung löschen
  // ─────────────────────────────────────────────
  fastify.delete('/:id', {
    schema: {
      description: 'Sammlung löschen (Rezepte bleiben erhalten)',
      tags: ['Sammlungen'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const hhWhere = householdWhereClause(request.user.id, request.householdId);
    const result = db.prepare(
      `DELETE FROM collections WHERE id = ? AND (${hhWhere.clause})`
    ).run(request.params.id, ...hhWhere.params);

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Sammlung nicht gefunden.' });
    }

    return { message: 'Sammlung gelöscht.' };
  });

  // ─────────────────────────────────────────────
  // GET /:id/recipes – Rezepte einer Sammlung
  // ─────────────────────────────────────────────
  fastify.get('/:id/recipes', {
    schema: {
      description: 'Alle Rezepte einer Sammlung laden',
      tags: ['Sammlungen'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params;

    // Prüfen ob Sammlung dem Benutzer gehört
    const hhWhere = householdWhereClause(request.user.id, request.householdId);
    const collection = db.prepare(
      `SELECT id FROM collections WHERE id = ? AND (${hhWhere.clause})`
    ).get(id, ...hhWhere.params);
    if (!collection) {
      return reply.status(404).send({ error: 'Sammlung nicht gefunden.' });
    }

    const recipes = db.prepare(`
      SELECT r.*, rc.added_at as collection_added_at,
        GROUP_CONCAT(DISTINCT c.name) as category_names
      FROM recipes r
      JOIN recipe_collections rc ON r.id = rc.recipe_id
      LEFT JOIN recipe_categories rcat ON r.id = rcat.recipe_id
      LEFT JOIN categories c ON rcat.category_id = c.id
      WHERE rc.collection_id = ?
      GROUP BY r.id
      ORDER BY rc.added_at DESC
    `).all(id);

    return { recipes };
  });

  // ─────────────────────────────────────────────
  // POST /:id/recipes – Rezept(e) zu Sammlung hinzufügen
  // ─────────────────────────────────────────────
  fastify.post('/:id/recipes', {
    schema: {
      description: 'Rezept(e) zu einer Sammlung hinzufügen',
      tags: ['Sammlungen'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['recipeIds'],
        properties: {
          recipeIds: {
            type: 'array',
            items: { type: 'integer' },
            minItems: 1,
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { recipeIds } = request.body;

    // Prüfen ob Sammlung dem Benutzer gehört
    const hhWhere = householdWhereClause(request.user.id, request.householdId);
    const collection = db.prepare(
      `SELECT id, name FROM collections WHERE id = ? AND (${hhWhere.clause})`
    ).get(id, ...hhWhere.params);
    if (!collection) {
      return reply.status(404).send({ error: 'Sammlung nicht gefunden.' });
    }

    const stmt = db.prepare(
      'INSERT OR IGNORE INTO recipe_collections (recipe_id, collection_id) VALUES (?, ?)'
    );

    let addedCount = 0;
    const insertMany = db.transaction(() => {
      for (const recipeId of recipeIds) {
        const result = stmt.run(recipeId, id);
        if (result.changes > 0) addedCount++;
      }
    });
    insertMany();

    return {
      message: addedCount > 0
        ? `${addedCount} Rezept${addedCount !== 1 ? 'e' : ''} zu "${collection.name}" hinzugefügt!`
        : 'Alle Rezepte waren bereits in der Sammlung.',
      addedCount,
    };
  });

  // ─────────────────────────────────────────────
  // DELETE /:id/recipes – Mehrere Rezepte aus Sammlung entfernen (Batch)
  // ─────────────────────────────────────────────
  fastify.delete('/:id/recipes', {
    schema: {
      description: 'Mehrere Rezepte aus einer Sammlung entfernen',
      tags: ['Sammlungen'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['recipeIds'],
        properties: {
          recipeIds: {
            type: 'array',
            items: { type: 'integer' },
            minItems: 1,
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { recipeIds } = request.body;

    // Prüfen ob Sammlung dem Benutzer gehört
    const hhWhere = householdWhereClause(request.user.id, request.householdId);
    const collection = db.prepare(
      `SELECT id, name FROM collections WHERE id = ? AND (${hhWhere.clause})`
    ).get(id, ...hhWhere.params);
    if (!collection) {
      return reply.status(404).send({ error: 'Sammlung nicht gefunden.' });
    }

    const stmt = db.prepare(
      'DELETE FROM recipe_collections WHERE recipe_id = ? AND collection_id = ?'
    );

    let removedCount = 0;
    const removeMany = db.transaction(() => {
      for (const recipeId of recipeIds) {
        const result = stmt.run(recipeId, id);
        if (result.changes > 0) removedCount++;
      }
    });
    removeMany();

    return {
      message: removedCount > 0
        ? `${removedCount} Rezept${removedCount !== 1 ? 'e' : ''} aus "${collection.name}" entfernt.`
        : 'Keines der Rezepte war in dieser Sammlung.',
      removedCount,
    };
  });

  // ─────────────────────────────────────────────
  // DELETE /:id/recipes/:recipeId – Rezept aus Sammlung entfernen
  // ─────────────────────────────────────────────
  fastify.delete('/:id/recipes/:recipeId', {
    schema: {
      description: 'Rezept aus einer Sammlung entfernen',
      tags: ['Sammlungen'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id, recipeId } = request.params;

    // Prüfen ob Sammlung dem Benutzer gehört
    const hhWhere = householdWhereClause(request.user.id, request.householdId);
    const collection = db.prepare(
      `SELECT id FROM collections WHERE id = ? AND (${hhWhere.clause})`
    ).get(id, ...hhWhere.params);
    if (!collection) {
      return reply.status(404).send({ error: 'Sammlung nicht gefunden.' });
    }

    const result = db.prepare(
      'DELETE FROM recipe_collections WHERE recipe_id = ? AND collection_id = ?'
    ).run(recipeId, id);

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Rezept war nicht in dieser Sammlung.' });
    }

    return { message: 'Rezept aus Sammlung entfernt.' };
  });

  // ─────────────────────────────────────────────
  // GET /export – Sammlungen exportieren
  // ─────────────────────────────────────────────
  fastify.get('/export', {
    schema: {
      description: 'Eigene Sammlungen als JSON exportieren',
      tags: ['Sammlungen'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const hhWhere = householdWhereClause(userId, request.householdId, 'c');

    const collections = db.prepare(`
      SELECT c.* FROM collections c
      WHERE ${hhWhere.clause}
      ORDER BY c.sort_order ASC, c.name ASC
    `).all(...hhWhere.params);

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'Zauberjournal',
      type: 'collections',
      collection_count: collections.length,
      collections: collections.map(col => {
        // Rezepttitel für diese Sammlung laden
        const recipeTitles = db.prepare(`
          SELECT r.title FROM recipes r
          JOIN recipe_collections rc ON r.id = rc.recipe_id
          WHERE rc.collection_id = ?
          ORDER BY rc.added_at DESC
        `).all(col.id).map(r => r.title);

        return {
          name: col.name,
          icon: col.icon,
          color: col.color,
          sort_order: col.sort_order,
          recipe_titles: recipeTitles,
        };
      }),
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="sammlungen-export-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  // ─────────────────────────────────────────────
  // POST /import – Sammlungen importieren
  // ─────────────────────────────────────────────
  fastify.post('/import', {
    schema: {
      description: 'Sammlungen aus JSON importieren',
      tags: ['Sammlungen'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const hhWhere = householdWhereClause(userId, request.householdId);
    let importData;

    // Multipart oder JSON-Body
    if (request.isMultipart()) {
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: 'Keine Datei hochgeladen.' });
      const buffer = await data.toBuffer();
      const text = buffer.toString('utf-8').replace(/^\uFEFF/, '').trim();
      try {
        importData = JSON.parse(text);
      } catch {
        return reply.status(400).send({ error: 'Ungültiges JSON-Format.' });
      }
    } else {
      importData = request.body;
    }

    // Validierung
    if (!importData || !Array.isArray(importData.collections)) {
      return reply.status(400).send({ error: 'Ungültiges Format: "collections"-Array erwartet.' });
    }
    if (importData.source && importData.source !== 'Zauberjournal') {
      return reply.status(400).send({ error: 'Ungültige Import-Quelle.' });
    }
    if (importData.collections.length > 500) {
      return reply.status(400).send({ error: 'Maximal 500 Sammlungen erlaubt.' });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let recipesLinked = 0;

    // Alle Rezepte des Users für Titel-Matching
    const userRecipes = db.prepare(`SELECT id, title FROM recipes WHERE (${hhWhere.clause})`).all(...hhWhere.params);
    const recipeTitleMap = new Map(userRecipes.map(r => [r.title.toLowerCase(), r.id]));

    const transaction = db.transaction(() => {
      for (const col of importData.collections) {
        if (!col.name || typeof col.name !== 'string') {
          skipped++;
          continue;
        }

        const name = col.name.trim().slice(0, 100);
        const icon = (col.icon || '📁').slice(0, 10);
        const color = /^#[0-9a-fA-F]{6}$/.test(col.color) ? col.color : '#6366f1';
        const sortOrder = typeof col.sort_order === 'number' ? Math.min(Math.max(Math.floor(col.sort_order), 0), 9999) : 0;

        // Existiert die Sammlung schon?
        const existing = db.prepare(
          `SELECT id FROM collections WHERE (${hhWhere.clause}) AND name = ? COLLATE NOCASE`
        ).get(...hhWhere.params, name);

        let collectionId;
        if (existing) {
          // Aktualisieren
          db.prepare(
            'UPDATE collections SET icon = ?, color = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
          ).run(icon, color, sortOrder, existing.id);
          collectionId = existing.id;
          updated++;
        } else {
          // Neu erstellen
          const result = db.prepare(
            'INSERT INTO collections (user_id, name, icon, color, sort_order, household_id) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(userId, name, icon, color, sortOrder, request.householdId || null);
          collectionId = result.lastInsertRowid;
          imported++;
        }

        // Rezepte verknüpfen (per Titel-Matching)
        if (Array.isArray(col.recipe_titles)) {
          const titles = col.recipe_titles.slice(0, 200); // Max 200 Rezepte pro Sammlung
          for (const title of titles) {
            if (typeof title !== 'string') continue;
            const recipeId = recipeTitleMap.get(title.toLowerCase());
            if (recipeId) {
              const res = db.prepare(
                'INSERT OR IGNORE INTO recipe_collections (recipe_id, collection_id) VALUES (?, ?)'
              ).run(recipeId, collectionId);
              if (res.changes > 0) recipesLinked++;
            }
          }
        }
      }
    });
    transaction();

    return {
      message: `${imported} neu importiert, ${updated} aktualisiert, ${skipped} übersprungen. ${recipesLinked} Rezept-Zuordnungen erstellt.`,
      imported,
      updated,
      skipped,
      recipes_linked: recipesLinked,
    };
  });

  // ─────────────────────────────────────────────
  // GET /for-recipe/:recipeId – Sammlungen eines Rezepts
  // ─────────────────────────────────────────────
  fastify.get('/for-recipe/:recipeId', {
    schema: {
      description: 'Alle Sammlungen abrufen, in denen ein Rezept enthalten ist',
      tags: ['Sammlungen'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const { recipeId } = request.params;

    const hhWhere = householdWhereClause(request.user.id, request.householdId, 'c');
    const collections = db.prepare(`
      SELECT c.*, rc.added_at as collection_added_at
      FROM collections c
      JOIN recipe_collections rc ON c.id = rc.collection_id
      WHERE rc.recipe_id = ? AND (${hhWhere.clause})
      ORDER BY c.sort_order ASC, c.name ASC
    `).all(recipeId, ...hhWhere.params);

    return { collections };
  });
}
