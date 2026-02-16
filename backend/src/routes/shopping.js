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

    // Rezept-Infos (ID, Titel, Bild) für alle referenzierten Rezepte laden
    const allRecipeIds = new Set();
    for (const item of items) {
      try {
        const ids = JSON.parse(item.recipe_ids || '[]');
        ids.forEach(id => allRecipeIds.add(id));
      } catch { /* ignorieren */ }
    }

    let recipeLookup = {};
    if (allRecipeIds.size > 0) {
      const placeholders = [...allRecipeIds].map(() => '?').join(',');
      const recipes = db.prepare(
        `SELECT id, title, image_url FROM recipes WHERE id IN (${placeholders})`
      ).all(...allRecipeIds);
      for (const r of recipes) {
        recipeLookup[r.id] = r;
      }
    }

    // Items mit Rezept-Details anreichern
    const enrichedItems = items.map(item => {
      let recipeIds = [];
      try { recipeIds = JSON.parse(item.recipe_ids || '[]'); } catch { /* */ }
      return {
        ...item,
        recipes: recipeIds.map(id => recipeLookup[id]).filter(Boolean),
      };
    });

    return { list, items: enrichedItems };
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
   * POST /api/shopping/item/add
   * Manuell ein Item zur aktiven Einkaufsliste hinzufügen
   */
  fastify.post('/item/add', {
    schema: {
      description: 'Item manuell zur Einkaufsliste hinzufügen',
      tags: ['Einkaufsliste'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['ingredient_name'],
        properties: {
          ingredient_name: { type: 'string', minLength: 1 },
          amount: { type: 'number' },
          unit: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { ingredient_name, amount, unit } = request.body;

    // Aktive Liste finden oder neue erstellen
    let list = db.prepare(
      'SELECT * FROM shopping_lists WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1'
    ).get(userId);

    if (!list) {
      const { lastInsertRowid } = db.prepare(
        'INSERT INTO shopping_lists (user_id, name) VALUES (?, ?)'
      ).run(userId, 'Einkaufsliste');
      list = { id: lastInsertRowid };
    }

    const { lastInsertRowid: itemId } = db.prepare(`
      INSERT INTO shopping_list_items (shopping_list_id, ingredient_name, amount, unit, recipe_ids)
      VALUES (?, ?, ?, ?, '[]')
    `).run(list.id, ingredient_name.trim(), amount || null, unit || null);

    return {
      id: itemId,
      ingredient_name: ingredient_name.trim(),
      amount: amount || null,
      unit: unit || null,
      is_checked: 0,
      recipes: [],
      pantry_deducted: 0,
      message: 'Artikel hinzugefügt',
    };
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
                ingredient_name: { type: 'string' },
                amount: { type: 'number' },
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
    const listId = Number(request.params.listId);
    let { purchasedItems } = request.body;

    // Wenn keine Items mitgeschickt wurden, alle abgehakten Items aus der Liste nehmen
    if (!purchasedItems?.length) {
      purchasedItems = db.prepare(
        'SELECT ingredient_name, amount, unit FROM shopping_list_items WHERE shopping_list_id = ? AND is_checked = 1'
      ).all(listId);
    }

    // Gekaufte Items in Vorratsschrank übernehmen
    if (purchasedItems.length) {
      processPurchase(userId, listId, purchasedItems);
    }

    // Liste als inaktiv markieren
    db.prepare(
      'UPDATE shopping_lists SET is_active = 0 WHERE id = ? AND user_id = ?'
    ).run(listId, userId);

    return {
      message: 'Einkauf abgeschlossen! Gekaufte Artikel wurden im Vorratsschrank gespeichert.',
      pantryItemsAdded: purchasedItems.length,
    };
  });
}
