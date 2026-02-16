/**
 * ============================================
 * Einkaufslisten-Routen
 * ============================================
 * Generierung und Verwaltung von Einkaufslisten
 */

import db from '../config/database.js';
import { generateShoppingList, saveShoppingList, processPurchase } from '../services/shopping-list.js';
import { buildReweProductUrl } from '../services/rewe-api.js';

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

    // Manuelle Items aus der aktuellen aktiven Liste sichern (bevor sie deaktiviert wird)
    const oldList = db.prepare(
      'SELECT id FROM shopping_lists WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1'
    ).get(userId);
    let manualItems = [];
    if (oldList) {
      manualItems = db.prepare(
        "SELECT ingredient_name, amount, unit, is_checked FROM shopping_list_items WHERE shopping_list_id = ? AND (recipe_ids IS NULL OR recipe_ids = '[]')"
      ).all(oldList.id);
    }

    // Speichern (deaktiviert alte Liste, erstellt neue)
    const listId = saveShoppingList(userId, mealPlanId, shoppingData.items, name);

    // Manuelle Items in die neue Liste übernehmen
    if (manualItems.length > 0) {
      const insertManual = db.prepare(
        "INSERT INTO shopping_list_items (shopping_list_id, ingredient_name, amount, unit, is_checked, recipe_ids) VALUES (?, ?, ?, ?, ?, '[]')"
      );
      for (const item of manualItems) {
        insertManual.run(listId, item.ingredient_name, item.amount, item.unit, item.is_checked);
      }
    }

    return {
      listId,
      ...shoppingData,
      manualItemsKept: manualItems.length,
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

    // Items mit Rezept-Details und REWE-Daten anreichern
    const enrichedItems = items.map(item => {
      let recipeIds = [];
      try { recipeIds = JSON.parse(item.recipe_ids || '[]'); } catch { /* */ }

      // REWE-Produkt als verschachteltes Objekt aufbauen (Frontend erwartet item.rewe_product)
      const rewe_product = item.rewe_product_id ? {
        id: item.rewe_product_id,
        name: item.rewe_product_name,
        price: item.rewe_price,           // Cent
        packageSize: item.rewe_package_size,
        url: buildReweProductUrl(item.rewe_product_name, item.rewe_product_id),
      } : null;

      return {
        ...item,
        recipes: recipeIds.map(id => recipeLookup[id]).filter(Boolean),
        rewe_product,
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
   * DELETE /api/shopping/item/:id
   * Einzelnes Item von der Einkaufsliste löschen
   */
  fastify.delete('/item/:id', {
    schema: {
      description: 'Item von Einkaufsliste löschen',
      tags: ['Einkaufsliste'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const result = db.prepare(`
      DELETE FROM shopping_list_items
      WHERE id = ? AND shopping_list_id IN (SELECT id FROM shopping_lists WHERE user_id = ?)
    `).run(request.params.id, request.user.id);

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Artikel nicht gefunden' });
    }

    return { message: 'Artikel gelöscht' };
  });

  /**
   * PUT /api/shopping/item/:id/rewe-product
   * REWE-Produkt manuell für ein Einkaufsitem auswählen/ändern
   */
  fastify.put('/item/:id/rewe-product', {
    schema: {
      description: 'REWE-Produkt für Item auswählen',
      tags: ['Einkaufsliste'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['productId', 'productName', 'price'],
        properties: {
          productId: { type: 'string' },
          productName: { type: 'string' },
          price: { type: ['number', 'null'] },
          packageSize: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { productId, productName, price, packageSize } = request.body;

    const result = db.prepare(`
      UPDATE shopping_list_items
      SET rewe_product_id = ?, rewe_product_name = ?, rewe_price = ?, rewe_package_size = ?
      WHERE id = ? AND shopping_list_id IN (SELECT id FROM shopping_lists WHERE user_id = ?)
    `).run(productId, productName, price, packageSize || null, request.params.id, request.user.id);

    if (!result.changes) {
      return reply.status(404).send({ error: 'Artikel nicht gefunden' });
    }

    return {
      message: 'REWE-Produkt aktualisiert',
      rewe_product: {
        id: productId,
        name: productName,
        price,
        packageSize: packageSize || null,
        url: buildReweProductUrl(productName, productId),
      },
    };
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
