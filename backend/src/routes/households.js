/**
 * ============================================
 * Haushalt-Routen (Mehrbenutzerbetrieb)
 * ============================================
 * CRUD für Haushalte, Einladungs-System,
 * Mitgliederverwaltung und Daten-Migration.
 */

import db from '../config/database.js';
import { randomBytes } from 'crypto';
import { getDefaultHousehold, isHouseholdMember, getUserHouseholdIds } from '../config/database.js';
import { getSetting } from '../config/settings.js';

/**
 * Erzeugt einen 8-stelligen alphanumerischen Invite-Code
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne I, O, 0, 1 (Verwechslungsgefahr)
  let code = '';
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export default async function householdRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ─────────────────────────────────────────────
  // GET / – Eigene Haushalte auflisten
  // ─────────────────────────────────────────────
  fastify.get('/', {
    schema: {
      description: 'Alle Haushalte des aktuellen Benutzers',
      tags: ['Haushalte'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const userId = request.user.id;

    const households = db.prepare(`
      SELECT h.*, hm.is_default, hm.joined_at,
        (SELECT COUNT(*) FROM household_members WHERE household_id = h.id) as member_count
      FROM households h
      JOIN household_members hm ON h.id = hm.household_id
      WHERE hm.user_id = ?
      ORDER BY hm.is_default DESC, h.created_at ASC
    `).all(userId);

    // Mitglieder für jeden Haushalt laden
    for (const hh of households) {
      hh.members = db.prepare(`
        SELECT u.id, u.username, u.display_name, hm.joined_at, hm.is_default
        FROM household_members hm
        JOIN users u ON hm.user_id = u.id
        WHERE hm.household_id = ?
        ORDER BY hm.joined_at ASC
      `).all(hh.id);
    }

    return { households };
  });

  // ─────────────────────────────────────────────
  // POST / – Neuen Haushalt erstellen
  // ─────────────────────────────────────────────
  fastify.post('/', {
    schema: {
      description: 'Neuen Haushalt erstellen',
      tags: ['Haushalte'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { name } = request.body;

    // Limit prüfen
    const maxHouseholds = parseInt(getSetting('max_households_per_user') || '3');
    const currentCount = db.prepare(
      'SELECT COUNT(*) as count FROM household_members WHERE user_id = ?'
    ).get(userId).count;

    if (currentCount >= maxHouseholds) {
      return reply.status(400).send({
        error: `Du kannst maximal ${maxHouseholds} Haushalten beitreten.`,
      });
    }

    // Invite-Code generieren (48h gültig)
    const inviteCode = generateInviteCode();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const result = db.transaction(() => {
      // Haushalt erstellen
      const { lastInsertRowid: householdId } = db.prepare(`
        INSERT INTO households (name, invite_code, invite_code_expires_at, created_by)
        VALUES (?, ?, ?, ?)
      `).run(name, inviteCode, expiresAt, userId);

      // Ersteller als Mitglied hinzufügen (Standard-Haushalt wenn erster)
      const isFirst = currentCount === 0 ? 1 : 0;
      db.prepare(`
        INSERT INTO household_members (household_id, user_id, is_default)
        VALUES (?, ?, ?)
      `).run(householdId, userId, isFirst);

      // Aktivitäts-Log
      db.prepare(`
        INSERT INTO household_activity (household_id, user_id, action, details)
        VALUES (?, ?, 'household:created', ?)
      `).run(householdId, userId, JSON.stringify({ name }));

      return householdId;
    })();

    const household = db.prepare('SELECT * FROM households WHERE id = ?').get(result);

    return reply.status(201).send({
      message: `Haushalt "${name}" erstellt!`,
      household: {
        ...household,
        member_count: 1,
        members: [{
          id: userId,
          username: request.user.username,
          joined_at: new Date().toISOString(),
        }],
      },
    });
  });

  // ─────────────────────────────────────────────
  // GET /:id – Haushalt-Details
  // ─────────────────────────────────────────────
  fastify.get('/:id', {
    schema: {
      description: 'Haushalt-Details mit Mitgliedern',
      tags: ['Haushalte'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const householdId = parseInt(request.params.id);
    const userId = request.user.id;

    if (!isHouseholdMember(userId, householdId)) {
      return reply.status(403).send({ error: 'Kein Zugriff auf diesen Haushalt.' });
    }

    const household = db.prepare('SELECT * FROM households WHERE id = ?').get(householdId);
    if (!household) {
      return reply.status(404).send({ error: 'Haushalt nicht gefunden.' });
    }

    household.members = db.prepare(`
      SELECT u.id, u.username, u.display_name, hm.joined_at, hm.is_default
      FROM household_members hm
      JOIN users u ON hm.user_id = u.id
      WHERE hm.household_id = ?
      ORDER BY hm.joined_at ASC
    `).all(householdId);

    household.member_count = household.members.length;

    // Statistiken
    household.stats = {
      recipes: db.prepare('SELECT COUNT(*) as count FROM recipes WHERE household_id = ?').get(householdId).count,
      pantry_items: db.prepare('SELECT COUNT(*) as count FROM pantry WHERE household_id = ?').get(householdId).count,
    };

    return { household };
  });

  // ─────────────────────────────────────────────
  // PUT /:id – Haushalt umbenennen
  // ─────────────────────────────────────────────
  fastify.put('/:id', {
    schema: {
      description: 'Haushalt umbenennen',
      tags: ['Haushalte'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 },
        },
      },
    },
  }, async (request, reply) => {
    const householdId = parseInt(request.params.id);
    const userId = request.user.id;

    if (!isHouseholdMember(userId, householdId)) {
      return reply.status(403).send({ error: 'Kein Zugriff auf diesen Haushalt.' });
    }

    const { name } = request.body;
    if (name) {
      db.prepare('UPDATE households SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(name, householdId);
    }

    return { message: 'Haushalt aktualisiert!' };
  });

  // ─────────────────────────────────────────────
  // DELETE /:id – Haushalt auflösen
  // ─────────────────────────────────────────────
  fastify.delete('/:id', {
    schema: {
      description: 'Haushalt auflösen (nur Ersteller). Daten werden den jeweiligen Erstellern als private Daten zurückgegeben.',
      tags: ['Haushalte'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const householdId = parseInt(request.params.id);
    const userId = request.user.id;

    const household = db.prepare('SELECT * FROM households WHERE id = ?').get(householdId);
    if (!household) {
      return reply.status(404).send({ error: 'Haushalt nicht gefunden.' });
    }

    if (household.created_by !== userId) {
      return reply.status(403).send({ error: 'Nur der Ersteller kann den Haushalt auflösen.' });
    }

    db.transaction(() => {
      // Alle Haushalt-Daten zurück zu privaten Daten machen
      // Rezepte → created_by_user_id wird owner, household_id = NULL
      db.prepare(`
        UPDATE recipes SET household_id = NULL
        WHERE household_id = ?
      `).run(householdId);

      // Andere Tabellen: household_id = NULL
      for (const table of ['categories', 'collections', 'meal_plans', 'shopping_lists',
                           'pantry', 'ingredient_aliases', 'blocked_ingredients', 'recipe_blocks']) {
        db.prepare(`UPDATE ${table} SET household_id = NULL WHERE household_id = ?`).run(householdId);
      }

      // Haushalt löschen (CASCADE löscht household_members + household_activity)
      db.prepare('DELETE FROM households WHERE id = ?').run(householdId);
    })();

    return { message: 'Haushalt aufgelöst. Daten wurden privatisiert.' };
  });

  // ─────────────────────────────────────────────
  // POST /:id/invite – Neuen Invite-Code generieren
  // ─────────────────────────────────────────────
  fastify.post('/:id/invite', {
    schema: {
      description: 'Neuen Einladungs-Code generieren (alter wird ungültig)',
      tags: ['Haushalte'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          expires_hours: { type: 'integer', minimum: 1, maximum: 168, default: 48 },
        },
      },
    },
  }, async (request, reply) => {
    const householdId = parseInt(request.params.id);
    const userId = request.user.id;

    if (!isHouseholdMember(userId, householdId)) {
      return reply.status(403).send({ error: 'Kein Zugriff auf diesen Haushalt.' });
    }

    const expiresHours = request.body?.expires_hours || 48;
    const inviteCode = generateInviteCode();
    const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();

    db.prepare(`
      UPDATE households SET invite_code = ?, invite_code_expires_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(inviteCode, expiresAt, householdId);

    return {
      invite_code: inviteCode,
      expires_at: expiresAt,
      message: 'Neuer Einladungs-Code generiert!',
    };
  });

  // ─────────────────────────────────────────────
  // POST /join – Per Invite-Code beitreten
  // ─────────────────────────────────────────────
  fastify.post('/join', {
    config: {
      rateLimit: { max: 5, timeWindow: '15 minutes' },
    },
    schema: {
      description: 'Einem Haushalt per Einladungs-Code beitreten',
      tags: ['Haushalte'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['invite_code'],
        properties: {
          invite_code: { type: 'string', minLength: 8, maxLength: 8 },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { invite_code } = request.body;

    // Code normalisieren (Groß-/Kleinschreibung egal)
    const code = invite_code.toUpperCase().trim();

    const household = db.prepare(`
      SELECT * FROM households
      WHERE invite_code = ? AND invite_code_expires_at > datetime('now')
    `).get(code);

    if (!household) {
      return reply.status(400).send({
        error: 'Ungültiger oder abgelaufener Einladungs-Code.',
      });
    }

    // Bereits Mitglied?
    if (isHouseholdMember(userId, household.id)) {
      return reply.status(409).send({
        error: 'Du bist bereits Mitglied dieses Haushalts.',
      });
    }

    // Limit prüfen
    const maxMembers = parseInt(getSetting('max_household_members') || '10');
    const memberCount = db.prepare(
      'SELECT COUNT(*) as count FROM household_members WHERE household_id = ?'
    ).get(household.id).count;

    if (memberCount >= maxMembers) {
      return reply.status(400).send({
        error: `Dieser Haushalt hat das Mitglieder-Limit (${maxMembers}) erreicht.`,
      });
    }

    // Max Haushalte pro User prüfen
    const maxHouseholds = parseInt(getSetting('max_households_per_user') || '3');
    const userCount = db.prepare(
      'SELECT COUNT(*) as count FROM household_members WHERE user_id = ?'
    ).get(userId).count;

    if (userCount >= maxHouseholds) {
      return reply.status(400).send({
        error: `Du kannst maximal ${maxHouseholds} Haushalten beitreten.`,
      });
    }

    db.transaction(() => {
      // Als erster Haushalt = Standard
      const isFirst = userCount === 0 ? 1 : 0;
      db.prepare(`
        INSERT INTO household_members (household_id, user_id, is_default)
        VALUES (?, ?, ?)
      `).run(household.id, userId, isFirst);

      // Aktivitäts-Log
      db.prepare(`
        INSERT INTO household_activity (household_id, user_id, action, details)
        VALUES (?, ?, 'member:joined', ?)
      `).run(household.id, userId, JSON.stringify({ username: request.user.username }));
    })();

    return {
      message: `Du bist dem Haushalt "${household.name}" beigetreten!`,
      household_id: household.id,
      household_name: household.name,
    };
  });

  // ─────────────────────────────────────────────
  // DELETE /:id/leave – Haushalt verlassen
  // ─────────────────────────────────────────────
  fastify.delete('/:id/leave', {
    schema: {
      description: 'Haushalt verlassen. Eigene private Daten bleiben erhalten.',
      tags: ['Haushalte'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const householdId = parseInt(request.params.id);
    const userId = request.user.id;

    if (!isHouseholdMember(userId, householdId)) {
      return reply.status(404).send({ error: 'Du bist kein Mitglied dieses Haushalts.' });
    }

    const memberCount = db.prepare(
      'SELECT COUNT(*) as count FROM household_members WHERE household_id = ?'
    ).get(householdId).count;

    db.transaction(() => {
      // Mitgliedschaft entfernen
      db.prepare('DELETE FROM household_members WHERE household_id = ? AND user_id = ?')
        .run(householdId, userId);

      // Aktivitäts-Log
      db.prepare(`
        INSERT INTO household_activity (household_id, user_id, action, details)
        VALUES (?, ?, 'member:left', ?)
      `).run(householdId, userId, JSON.stringify({ username: request.user.username }));

      // Letztes Mitglied → Haushalt auflösen
      if (memberCount <= 1) {
        // Daten privatisieren
        db.prepare('UPDATE recipes SET household_id = NULL WHERE household_id = ?').run(householdId);
        for (const table of ['categories', 'collections', 'meal_plans', 'shopping_lists',
                             'pantry', 'ingredient_aliases', 'blocked_ingredients', 'recipe_blocks']) {
          db.prepare(`UPDATE ${table} SET household_id = NULL WHERE household_id = ?`).run(householdId);
        }
        db.prepare('DELETE FROM households WHERE id = ?').run(householdId);
      }
    })();

    return { message: 'Haushalt verlassen.' };
  });

  // ─────────────────────────────────────────────
  // DELETE /:id/members/:userId – Mitglied entfernen
  // ─────────────────────────────────────────────
  fastify.delete('/:id/members/:userId', {
    schema: {
      description: 'Mitglied aus Haushalt entfernen (nur Ersteller)',
      tags: ['Haushalte'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const householdId = parseInt(request.params.id);
    const targetUserId = parseInt(request.params.userId);
    const userId = request.user.id;

    const household = db.prepare('SELECT * FROM households WHERE id = ?').get(householdId);
    if (!household) {
      return reply.status(404).send({ error: 'Haushalt nicht gefunden.' });
    }

    // Nur Ersteller darf andere entfernen
    if (household.created_by !== userId) {
      return reply.status(403).send({ error: 'Nur der Ersteller kann Mitglieder entfernen.' });
    }

    // Sich selbst kann man nicht entfernen (→ leave benutzen)
    if (targetUserId === userId) {
      return reply.status(400).send({ error: 'Nutze "Haushalt verlassen" stattdessen.' });
    }

    const result = db.prepare(
      'DELETE FROM household_members WHERE household_id = ? AND user_id = ?'
    ).run(householdId, targetUserId);

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Mitglied nicht gefunden.' });
    }

    // Aktivitäts-Log
    const targetUser = db.prepare('SELECT username FROM users WHERE id = ?').get(targetUserId);
    db.prepare(`
      INSERT INTO household_activity (household_id, user_id, action, details)
      VALUES (?, ?, 'member:removed', ?)
    `).run(householdId, userId, JSON.stringify({
      removed_user: targetUser?.username,
      removed_by: request.user.username,
    }));

    return { message: 'Mitglied entfernt.' };
  });

  // ─────────────────────────────────────────────
  // PUT /:id/default – Als Standard-Haushalt setzen
  // ─────────────────────────────────────────────
  fastify.put('/:id/default', {
    schema: {
      description: 'Diesen Haushalt als Standard setzen',
      tags: ['Haushalte'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const householdId = parseInt(request.params.id);
    const userId = request.user.id;

    if (!isHouseholdMember(userId, householdId)) {
      return reply.status(403).send({ error: 'Kein Zugriff auf diesen Haushalt.' });
    }

    db.transaction(() => {
      // Alle auf nicht-default setzen
      db.prepare('UPDATE household_members SET is_default = 0 WHERE user_id = ?').run(userId);
      // Diesen als default
      db.prepare('UPDATE household_members SET is_default = 1 WHERE household_id = ? AND user_id = ?')
        .run(householdId, userId);
    })();

    return { message: 'Standard-Haushalt gesetzt.' };
  });

  // ─────────────────────────────────────────────
  // GET /:id/activity – Aktivitäts-Feed
  // ─────────────────────────────────────────────
  fastify.get('/:id/activity', {
    schema: {
      description: 'Aktivitäts-Feed des Haushalts',
      tags: ['Haushalte'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const householdId = parseInt(request.params.id);
    const userId = request.user.id;

    if (!isHouseholdMember(userId, householdId)) {
      return reply.status(403).send({ error: 'Kein Zugriff auf diesen Haushalt.' });
    }

    const limit = request.query.limit || 20;
    const offset = request.query.offset || 0;

    const activities = db.prepare(`
      SELECT ha.*, u.username, u.display_name
      FROM household_activity ha
      LEFT JOIN users u ON ha.user_id = u.id
      WHERE ha.household_id = ?
      ORDER BY ha.created_at DESC
      LIMIT ? OFFSET ?
    `).all(householdId, limit, offset);

    const total = db.prepare(
      'SELECT COUNT(*) as count FROM household_activity WHERE household_id = ?'
    ).get(householdId).count;

    return {
      activities: activities.map(a => ({
        ...a,
        details: a.details ? JSON.parse(a.details) : null,
      })),
      total,
      hasMore: offset + limit < total,
    };
  });

  // ─────────────────────────────────────────────
  // POST /:id/migrate – Bestehende Daten in Haushalt verschieben
  // ─────────────────────────────────────────────
  fastify.post('/:id/migrate', {
    schema: {
      description: 'Eigene Daten in den Haushalt migrieren. Verschiebt Rezepte, Kategorien, Sammlungen, Wochenpläne, Einkaufslisten, Pantry etc.',
      tags: ['Haushalte'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          exclude_recipe_ids: {
            type: 'array',
            items: { type: 'integer' },
            default: [],
            description: 'Rezept-IDs die privat bleiben sollen',
          },
          include_categories: { type: 'boolean', default: true },
          include_collections: { type: 'boolean', default: true },
          include_meal_plans: { type: 'boolean', default: true },
          include_shopping_lists: { type: 'boolean', default: true },
          include_pantry: { type: 'boolean', default: true },
          include_aliases: { type: 'boolean', default: true },
          include_blocks: { type: 'boolean', default: true },
        },
      },
    },
  }, async (request, reply) => {
    const householdId = parseInt(request.params.id);
    const userId = request.user.id;

    if (!isHouseholdMember(userId, householdId)) {
      return reply.status(403).send({ error: 'Kein Zugriff auf diesen Haushalt.' });
    }

    const opts = request.body || {};
    const excludeIds = new Set(opts.exclude_recipe_ids || []);

    const stats = db.transaction(() => {
      const result = {};

      // Rezepte migrieren (außer ausgeschlossene)
      if (excludeIds.size > 0) {
        const placeholders = [...excludeIds].map(() => '?').join(',');
        result.recipes = db.prepare(`
          UPDATE recipes SET household_id = ?, created_by_user_id = COALESCE(created_by_user_id, user_id)
          WHERE user_id = ? AND household_id IS NULL AND id NOT IN (${placeholders})
        `).run(householdId, userId, ...excludeIds).changes;
      } else {
        result.recipes = db.prepare(`
          UPDATE recipes SET household_id = ?, created_by_user_id = COALESCE(created_by_user_id, user_id)
          WHERE user_id = ? AND household_id IS NULL
        `).run(householdId, userId).changes;
      }

      // Kategorien
      if (opts.include_categories !== false) {
        result.categories = db.prepare(
          'UPDATE categories SET household_id = ? WHERE user_id = ? AND household_id IS NULL'
        ).run(householdId, userId).changes;
      }

      // Sammlungen
      if (opts.include_collections !== false) {
        result.collections = db.prepare(
          'UPDATE collections SET household_id = ? WHERE user_id = ? AND household_id IS NULL'
        ).run(householdId, userId).changes;
      }

      // Wochenpläne
      if (opts.include_meal_plans !== false) {
        result.meal_plans = db.prepare(
          'UPDATE meal_plans SET household_id = ? WHERE user_id = ? AND household_id IS NULL'
        ).run(householdId, userId).changes;
      }

      // Einkaufslisten
      if (opts.include_shopping_lists !== false) {
        result.shopping_lists = db.prepare(
          'UPDATE shopping_lists SET household_id = ? WHERE user_id = ? AND household_id IS NULL'
        ).run(householdId, userId).changes;
      }

      // Pantry
      if (opts.include_pantry !== false) {
        result.pantry = db.prepare(
          'UPDATE pantry SET household_id = ? WHERE user_id = ? AND household_id IS NULL'
        ).run(householdId, userId).changes;
      }

      // Zutaten-Aliase
      if (opts.include_aliases !== false) {
        result.ingredient_aliases = db.prepare(
          'UPDATE ingredient_aliases SET household_id = ? WHERE user_id = ? AND household_id IS NULL'
        ).run(householdId, userId).changes;
        result.blocked_ingredients = db.prepare(
          'UPDATE blocked_ingredients SET household_id = ? WHERE user_id = ? AND household_id IS NULL'
        ).run(householdId, userId).changes;
      }

      // Rezept-Sperren
      if (opts.include_blocks !== false) {
        result.recipe_blocks = db.prepare(
          'UPDATE recipe_blocks SET household_id = ? WHERE user_id = ? AND household_id IS NULL'
        ).run(householdId, userId).changes;
      }

      // Aktivitäts-Log
      db.prepare(`
        INSERT INTO household_activity (household_id, user_id, action, details)
        VALUES (?, ?, 'data:migrated', ?)
      `).run(householdId, userId, JSON.stringify(result));

      return result;
    })();

    return {
      message: 'Daten erfolgreich migriert!',
      migrated: stats,
    };
  });

  // ─────────────────────────────────────────────
  // GET /:id/export – Haushalt-Daten exportieren
  // ─────────────────────────────────────────────
  fastify.get('/:id/export', {
    schema: {
      description: 'Alle Daten des Haushalts als JSON exportieren',
      tags: ['Haushalte'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const householdId = parseInt(request.params.id);
    const userId = request.user.id;

    if (!isHouseholdMember(userId, householdId)) {
      return reply.status(403).send({ error: 'Kein Zugriff auf diesen Haushalt.' });
    }

    const household = db.prepare('SELECT * FROM households WHERE id = ?').get(householdId);
    const members = db.prepare(`
      SELECT u.username, u.display_name, hm.joined_at
      FROM household_members hm
      JOIN users u ON hm.user_id = u.id
      WHERE hm.household_id = ?
    `).all(householdId);

    const recipes = db.prepare('SELECT * FROM recipes WHERE household_id = ?').all(householdId);
    const categories = db.prepare('SELECT * FROM categories WHERE household_id = ?').all(householdId);
    const collections = db.prepare('SELECT * FROM collections WHERE household_id = ?').all(householdId);
    const pantryItems = db.prepare(
      'SELECT ingredient_name, amount, unit, category, expiry_date, notes, is_permanent FROM pantry WHERE household_id = ?'
    ).all(householdId);

    // Rezepte mit Details anreichern
    const exportedRecipes = recipes.map(recipe => {
      const ingredients = db.prepare(
        'SELECT name, amount, unit, group_name, sort_order, is_optional, notes FROM ingredients WHERE recipe_id = ? ORDER BY sort_order'
      ).all(recipe.id);
      const steps = db.prepare(
        'SELECT step_number, title, instruction, duration_minutes FROM cooking_steps WHERE recipe_id = ? ORDER BY step_number'
      ).all(recipe.id);
      const cats = db.prepare(`
        SELECT c.name, c.icon, c.color FROM categories c
        JOIN recipe_categories rc ON c.id = rc.category_id
        WHERE rc.recipe_id = ?
      `).all(recipe.id);

      return {
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        total_time: recipe.total_time,
        difficulty: recipe.difficulty,
        is_favorite: recipe.is_favorite,
        notes: recipe.notes,
        categories: cats,
        ingredients,
        steps,
      };
    });

    reply.header('Content-Disposition', `attachment; filename="haushalt-${household.name}-export.json"`);
    return {
      export_version: '1.0',
      export_date: new Date().toISOString(),
      household: {
        name: household.name,
        members,
      },
      recipes: exportedRecipes,
      categories: categories.map(c => ({ name: c.name, icon: c.icon, color: c.color })),
      collections: collections.map(c => ({ name: c.name, icon: c.icon, color: c.color })),
      pantry: pantryItems,
    };
  });
}
