/**
 * ============================================
 * Einkaufslisten-Routen
 * ============================================
 * Generierung und Verwaltung von Einkaufslisten
 */

import db from '../config/database.js';
import { generateShoppingList, saveShoppingList, processPurchase } from '../services/shopping-list.js';

export default async function shoppingRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  /**
   * POST /api/shopping/generate
   * Einkaufsliste aus Wochenplan generieren
   */
  fastify.post('/generate', {
    schema: {
      description: 'Einkaufsliste aus Wochenplan generieren',
      tags: ['Einkaufsliste'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['mealPlanId'],
        properties: {
          mealPlanId: { type: 'integer' },
          name: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { mealPlanId, name } = request.body;

    // Prüfen ob Plan existiert und dem User gehört
    const plan = db.prepare(
      'SELECT * FROM meal_plans WHERE id = ? AND user_id = ?'
    ).get(mealPlanId, userId);

    if (!plan) {
      return reply.status(404).send({ error: 'Wochenplan nicht gefunden' });
    }

    // Einkaufsliste generieren (mit Vorratsschrank-Abgleich)
    const shoppingData = generateShoppingList(userId, mealPlanId);

    // Speichern
    const listId = saveShoppingList(userId, mealPlanId, shoppingData.items, name);

    return {
      listId,
      ...shoppingData,
      message: 'Einkaufsliste generiert!',
    };
  });

  /**
   * GET /api/shopping/list
   * Aktive Einkaufsliste abrufen
   */
  fastify.get('/list', {
    schema: { description: 'Aktive Einkaufsliste', tags: ['Einkaufsliste'], security: [{ bearerAuth: [] }] },
  }, async (request) => {
    const list = db.prepare(
      'SELECT * FROM shopping_lists WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1'
    ).get(request.user.id);

    if (!list) {
      return { list: null, items: [] };
    }

    const items = db.prepare(
      'SELECT * FROM shopping_list_items WHERE shopping_list_id = ? ORDER BY is_checked, ingredient_name'
    ).all(list.id);

    return { list, items };
  });

  /**
   * GET /api/shopping/lists
   * Alle Einkaufslisten (auch vergangene)
   */
  fastify.get('/lists', {
    schema: { description: 'Alle Einkaufslisten', tags: ['Einkaufsliste'], security: [{ bearerAuth: [] }] },
  }, async (request) => {
    const lists = db.prepare(`
      SELECT sl.*, COUNT(sli.id) as item_count,
        SUM(CASE WHEN sli.is_checked = 1 THEN 1 ELSE 0 END) as checked_count
      FROM shopping_lists sl
      LEFT JOIN shopping_list_items sli ON sl.id = sli.shopping_list_id
      WHERE sl.user_id = ?
      GROUP BY sl.id
      ORDER BY sl.created_at DESC
    `).all(request.user.id);

    return { lists };
  });

  /**
   * PUT /api/shopping/item/:id/check
   * Einkaufsitem abhaken/entabhaken
   */
  fastify.put('/item/:id/check', {
    schema: { description: 'Item abhaken', tags: ['Einkaufsliste'], security: [{ bearerAuth: [] }] },
  }, async (request) => {
    db.prepare(`
      UPDATE shopping_list_items SET is_checked = NOT is_checked
      WHERE id = ? AND shopping_list_id IN (SELECT id FROM shopping_lists WHERE user_id = ?)
    `).run(request.params.id, request.user.id);

    return { message: 'Status aktualisiert' };
  });

  /**
   * PUT /api/shopping/item/:id/rewe
   * REWE-Produkt einem Einkaufsitem zuordnen
   */
  fastify.put('/item/:id/rewe', {
    schema: {
      description: 'REWE-Produkt zuordnen',
      tags: ['Einkaufsliste'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const { rewe_product_id, rewe_product_name, rewe_price, rewe_package_size } = request.body;

    db.prepare(`
      UPDATE shopping_list_items
      SET rewe_product_id=?, rewe_product_name=?, rewe_price=?, rewe_package_size=?
      WHERE id = ? AND shopping_list_id IN (SELECT id FROM shopping_lists WHERE user_id = ?)
    `).run(rewe_product_id, rewe_product_name, rewe_price, rewe_package_size, request.params.id, request.user.id);

    return { message: 'REWE-Produkt zugeordnet' };
  });

  /**
   * POST /api/shopping/:listId/complete
   * Einkauf abschließen (Überschüsse in Vorratsschrank)
   */
  fastify.post('/:listId/complete', {
    schema: {
      description: 'Einkauf abschließen und Überschüsse in Vorratsschrank',
      tags: ['Einkaufsliste'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          purchasedItems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                itemId: { type: 'integer' },
                name: { type: 'string' },
                reweProductName: { type: 'string' },
                rewePrice: { type: 'number' },
                rewePackageSize: { type: 'string' },
                surplus: { type: 'number' },
                unit: { type: 'string' },
                category: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request) => {
    const userId = request.user.id;
    const { purchasedItems } = request.body;

    // Einkauf verarbeiten (Überschüsse in Vorratsschrank)
    if (purchasedItems?.length) {
      processPurchase(userId, request.params.listId, purchasedItems);
    }

    // Liste als inaktiv markieren
    db.prepare(
      'UPDATE shopping_lists SET is_active = 0 WHERE id = ? AND user_id = ?'
    ).run(request.params.listId, userId);

    return { message: 'Einkauf abgeschlossen! Überschüsse wurden im Vorratsschrank gespeichert.' };
  });
}
