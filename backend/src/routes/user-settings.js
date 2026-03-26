/**
 * ============================================
 * User-Settings Routen
 * ============================================
 * Per-User Einstellungen (Key-Value).
 * Erlaubt es einzelnen Nutzern, ihre Präferenzen zu speichern.
 */

import db from '../config/database.js';

// Erlaubte User-Setting-Keys (Whitelist)
const ALLOWED_USER_SETTINGS = new Set([
  'shopping_auto_ai_review',        // Automatischer KI-Check beim Generieren der Einkaufsliste
  'shopping_smart_dedup',           // Intelligente KI-Duplikaterkennung statt einfacher Aggregation
  'shopping_auto_ai_after_rewe',    // Automatischer KI-Check nach REWE-Abgleich
  'shopping_auto_ai_merge',         // Duplikate automatisch zusammenführen
  'shopping_auto_ai_adjust',        // Mengen automatisch anpassen
]);

export default async function userSettingsRoutes(fastify) {
  fastify.addHook('onRequest', fastify.resolveHousehold);

  /**
   * GET /api/user-settings
   * Alle User-Settings laden
   */
  fastify.get('/', {
    schema: {
      description: 'Alle User-Settings laden',
      tags: ['User-Settings'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const rows = db.prepare(
      'SELECT key, value FROM user_settings WHERE user_id = ?'
    ).all(request.user.id);

    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return { settings };
  });

  /**
   * PUT /api/user-settings/:key
   * Einzelnes User-Setting speichern
   */
  fastify.put('/:key', {
    schema: {
      description: 'User-Setting speichern',
      tags: ['User-Settings'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          key: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['value'],
        properties: {
          value: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { key } = request.params;
    const { value } = request.body;

    if (!ALLOWED_USER_SETTINGS.has(key)) {
      return reply.status(400).send({ error: `Ungültiger Setting-Key: ${key}` });
    }

    db.prepare(`
      INSERT INTO user_settings (user_id, household_id, key, value, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, key) DO UPDATE SET
        value = excluded.value,
        household_id = excluded.household_id,
        updated_at = CURRENT_TIMESTAMP
    `).run(request.user.id, request.householdId || null, key, value);

    return { message: 'Einstellung gespeichert', key, value };
  });
}
