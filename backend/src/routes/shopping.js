/**
 * ============================================
 * Einkaufslisten-Routen
 * ============================================
 * Generierung und Verwaltung von Einkaufslisten
 */

import db from '../config/database.js';
import { generateShoppingList, saveShoppingList, processPurchase } from '../services/shopping-list.js';
import { buildReweProductUrl, calculatePackagesNeeded, parsePackageSize } from '../services/rewe-api.js';

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
          excludePastDays: {
            type: 'boolean',
            default: true,
            description: 'Vergangene Tage der Woche von der Einkaufsliste ausschließen',
          },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { mealPlanId, name, excludePastDays = true } = request.body;

    // Prüfen ob Plan existiert und dem User gehört
    const plan = db.prepare(
      'SELECT * FROM meal_plans WHERE id = ? AND user_id = ?'
    ).get(mealPlanId, userId);

    if (!plan) {
      return reply.status(404).send({ error: 'Wochenplan nicht gefunden' });
    }

    // Einkaufsliste generieren (mit Vorratsschrank-Abgleich)
    const shoppingData = generateShoppingList(userId, mealPlanId, { excludePastDays });

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
        price: item.rewe_price,           // Cent (Einzelpackung)
        quantity: item.rewe_quantity || 1, // Anzahl benötigter Packungen
        packageSize: item.rewe_package_size,
        imageUrl: item.rewe_image_url || null,
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
   * GET /api/shopping/lists/:id
   * Einzelne Einkaufsliste mit allen Items laden (auch inaktive)
   */
  fastify.get('/lists/:id', {
    schema: { description: 'Einkaufsliste mit Items laden', tags: ['Einkaufsliste'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const list = db.prepare(
      'SELECT * FROM shopping_lists WHERE id = ? AND user_id = ?'
    ).get(request.params.id, request.user.id);

    if (!list) {
      return reply.status(404).send({ error: 'Einkaufsliste nicht gefunden' });
    }

    const items = db.prepare(
      'SELECT * FROM shopping_list_items WHERE shopping_list_id = ? ORDER BY is_checked, ingredient_name'
    ).all(list.id);

    // Rezept-Infos laden (wie in GET /list)
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

    const enrichedItems = items.map(item => {
      let recipeIds = [];
      try { recipeIds = JSON.parse(item.recipe_ids || '[]'); } catch { /* */ }

      const rewe_product = item.rewe_product_id ? {
        id: item.rewe_product_id,
        name: item.rewe_product_name,
        price: item.rewe_price,
        quantity: item.rewe_quantity || 1,
        packageSize: item.rewe_package_size,
        imageUrl: item.rewe_image_url || null,
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
   * PUT /api/shopping/lists/:id/activate
   * Einkaufsliste (wieder) aktivieren
   */
  fastify.put('/lists/:id/activate', {
    schema: { description: 'Einkaufsliste reaktivieren', tags: ['Einkaufsliste'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const userId = request.user.id;
    const listId = Number(request.params.id);

    // Prüfen ob Liste existiert und dem User gehört
    const list = db.prepare(
      'SELECT * FROM shopping_lists WHERE id = ? AND user_id = ?'
    ).get(listId, userId);

    if (!list) {
      return reply.status(404).send({ error: 'Einkaufsliste nicht gefunden' });
    }

    // Alle anderen Listen deaktivieren, diese aktivieren
    db.prepare('UPDATE shopping_lists SET is_active = 0 WHERE user_id = ?').run(userId);
    db.prepare('UPDATE shopping_lists SET is_active = 1 WHERE id = ?').run(listId);

    return { message: 'Einkaufsliste aktiviert', listId };
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
          imageUrl: { type: ['string', 'null'] },
        },
      },
    },
  }, async (request, reply) => {
    const { productId, productName, price, packageSize, imageUrl } = request.body;

    // 1. Item in der Einkaufsliste aktualisieren (inkl. Menge/Einheit für Mengenberechnung)
    const item = db.prepare(`
      SELECT sli.id, sli.ingredient_name, sli.amount, sli.unit FROM shopping_list_items sli
      JOIN shopping_lists sl ON sli.shopping_list_id = sl.id
      WHERE sli.id = ? AND sl.user_id = ?
    `).get(request.params.id, request.user.id);

    if (!item) {
      return reply.status(404).send({ error: 'Artikel nicht gefunden' });
    }

    // Packungsgröße parsen und benötigte Menge berechnen
    const pkgMatch = (packageSize || productName || '').match(/([\d.,]+)\s*(?:x\s*[\d.,]+\s*)?(g|kg|ml|l|stk|stück|st)\b/i);
    let pkgAmount = null, pkgUnit = null;
    if (pkgMatch) {
      pkgAmount = parseFloat(pkgMatch[1].replace(',', '.'));
      pkgUnit = pkgMatch[2].toLowerCase();
      if (pkgUnit === 'kg') { pkgAmount *= 1000; pkgUnit = 'g'; }
      else if (pkgUnit === 'l') { pkgAmount *= 1000; pkgUnit = 'ml'; }
    }

    // Stückzahl aus Multiplier-Wörtern erkennen (Duo=2, Trio=3, etc.)
    let pieceCount = null;
    const nameToCheck = (productName || '').toLowerCase();
    if (/\bduo\b/.test(nameToCheck)) pieceCount = 2;
    else if (/\btrio\b/.test(nameToCheck)) pieceCount = 3;
    else if (/\bdoppelpack\b/.test(nameToCheck)) pieceCount = 2;
    else {
      const erPackMatch = nameToCheck.match(/(\d+)er[\s-]?pack/);
      if (erPackMatch) pieceCount = parseInt(erPackMatch[1], 10);
    }

    const quantity = calculatePackagesNeeded(item.amount, item.unit, pkgAmount, pkgUnit, pieceCount);

    db.prepare(`
      UPDATE shopping_list_items
      SET rewe_product_id = ?, rewe_product_name = ?, rewe_price = ?, rewe_package_size = ?, rewe_quantity = ?, rewe_image_url = ?
      WHERE id = ?
    `).run(productId, productName, price, packageSize || null, quantity, imageUrl || null, item.id);

    // 2. Produkt-Präferenz speichern/aktualisieren (merkt sich die Auswahl für nächstes Mal)
    db.prepare(`
      INSERT INTO rewe_product_preferences (user_id, ingredient_name, rewe_product_id, rewe_product_name, rewe_price, rewe_package_size, rewe_image_url, times_selected, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, ingredient_name) DO UPDATE SET
        rewe_product_id = excluded.rewe_product_id,
        rewe_product_name = excluded.rewe_product_name,
        rewe_price = excluded.rewe_price,
        rewe_package_size = excluded.rewe_package_size,
        rewe_image_url = excluded.rewe_image_url,
        times_selected = times_selected + 1,
        updated_at = CURRENT_TIMESTAMP
    `).run(request.user.id, item.ingredient_name.toLowerCase().trim(), productId, productName, price, packageSize || null, imageUrl || null);

    return {
      message: 'REWE-Produkt aktualisiert',
      rewe_product: {
        id: productId,
        name: productName,
        price,
        quantity,
        packageSize: packageSize || null,
        imageUrl: imageUrl || null,
        url: buildReweProductUrl(productName, productId),
      },
      preferenceSaved: true,
    };
  });

  /**
   * PUT /api/shopping/item/:id/rewe-quantity
   * REWE-Packungsanzahl manuell anpassen
   */
  fastify.put('/item/:id/rewe-quantity', {
    schema: {
      description: 'REWE-Packungsanzahl ändern',
      tags: ['Einkaufsliste'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { quantity } = request.body;
    const result = db.prepare(`
      UPDATE shopping_list_items SET rewe_quantity = ?
      WHERE id = ? AND rewe_product_id IS NOT NULL
        AND shopping_list_id IN (SELECT id FROM shopping_lists WHERE user_id = ?)
    `).run(quantity, request.params.id, request.user.id);

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Artikel nicht gefunden oder kein REWE-Produkt zugewiesen' });
    }

    return { message: 'Menge aktualisiert', quantity };
  });

  /**
   * POST /api/shopping/item/:id/to-pantry
   * Einzelnes Item in den Vorratsschrank verschieben
   */
  fastify.post('/item/:id/to-pantry', {
    schema: {
      description: 'Item in den Vorratsschrank verschieben',
      tags: ['Einkaufsliste'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;

    // Item laden und prüfen ob es dem User gehört
    const item = db.prepare(`
      SELECT sli.* FROM shopping_list_items sli
      JOIN shopping_lists sl ON sli.shopping_list_id = sl.id
      WHERE sli.id = ? AND sl.user_id = ?
    `).get(request.params.id, userId);

    if (!item) {
      return reply.status(404).send({ error: 'Artikel nicht gefunden' });
    }

    const ingredientName = item.ingredient_name.trim();
    let amount = item.amount || 1;
    let unit = item.unit || 'Stk.';

    // Wenn REWE-Produkt zugeordnet: tatsächlich gekaufte Menge berechnen
    if (item.rewe_package_size) {
      const parsed = parsePackageSize(item.rewe_package_size);
      if (parsed.amount && parsed.unit) {
        const reweQty = item.rewe_quantity || 1;
        let totalPurchased = parsed.amount * reweQty;
        let purchasedUnit = parsed.unit;

        // Einheit an die Rezept-/Listen-Einheit angleichen
        const origUnit = (item.unit || '').toLowerCase();
        if (origUnit === 'kg' && purchasedUnit === 'g') {
          totalPurchased /= 1000;
          purchasedUnit = 'kg';
        } else if (origUnit === 'l' && purchasedUnit === 'ml') {
          totalPurchased /= 1000;
          purchasedUnit = 'l';
        }

        amount = totalPurchased;
        unit = purchasedUnit;
      }
    }

    // Prüfen ob Zutat schon im Vorratsschrank existiert → Menge addieren
    const existing = db.prepare(
      'SELECT * FROM pantry WHERE user_id = ? AND LOWER(ingredient_name) = LOWER(?)'
    ).get(userId, ingredientName);

    let pantryId;
    if (existing) {
      db.prepare(
        'UPDATE pantry SET amount = amount + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(amount, existing.id);
      pantryId = existing.id;
    } else {
      const result = db.prepare(
        "INSERT INTO pantry (user_id, ingredient_name, amount, unit, category) VALUES (?, ?, ?, ?, 'Sonstiges')"
      ).run(userId, ingredientName, amount, unit);
      pantryId = result.lastInsertRowid;
    }

    // Item von der Einkaufsliste entfernen
    db.prepare('DELETE FROM shopping_list_items WHERE id = ?').run(item.id);

    return {
      message: `${ingredientName} in den Vorratsschrank verschoben`,
      pantryId,
      updated: !!existing,
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
          includeAll: {
            type: 'boolean',
            default: false,
            description: 'Alle Items einbeziehen (nicht nur abgehakte) – z.B. nach Bring!/REWE-Export',
          },
        },
      },
    },
  }, async (request) => {
    const userId = request.user.id;
    const listId = Number(request.params.listId);
    let { purchasedItems, includeAll = false } = request.body;

    // Wenn keine Items mitgeschickt wurden, Items aus der DB nehmen
    if (!purchasedItems?.length) {
      const condition = includeAll ? '' : ' AND is_checked = 1';
      purchasedItems = db.prepare(
        `SELECT ingredient_name, amount, unit, rewe_package_size, rewe_quantity FROM shopping_list_items WHERE shopping_list_id = ?${condition}`
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

  // ─────────────────────────────────────────────
  // GET /export – Einkaufslisten exportieren
  // ─────────────────────────────────────────────
  fastify.get('/export', {
    schema: {
      description: 'Eigene Einkaufslisten als JSON exportieren',
      tags: ['Einkaufsliste'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;

    const lists = db.prepare(`
      SELECT sl.*, u.username as owner
      FROM shopping_lists sl
      JOIN users u ON sl.user_id = u.id
      WHERE sl.user_id = ?
      ORDER BY sl.created_at DESC
    `).all(userId);

    const items = db.prepare(`
      SELECT sli.*, r.title as recipe_title
      FROM shopping_list_items sli
      JOIN shopping_lists sl ON sli.shopping_list_id = sl.id
      LEFT JOIN recipes r ON sli.recipe_id = r.id
      WHERE sl.user_id = ?
      ORDER BY sli.shopping_list_id, sli.ingredient_name
    `).all(userId);

    const listsWithItems = lists.map(list => ({
      name: list.name,
      is_active: list.is_active,
      created_at: list.created_at,
      owner: list.owner,
      items: items
        .filter(i => i.shopping_list_id === list.id)
        .map(i => ({
          ingredient_name: i.ingredient_name,
          amount: i.amount,
          unit: i.unit,
          is_checked: i.is_checked,
          recipe_title: i.recipe_title,
          rewe_product_name: i.rewe_product_name,
          rewe_price: i.rewe_price,
        })),
    }));

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'AI Cookbook',
      type: 'shopping_lists',
      list_count: listsWithItems.length,
      lists: listsWithItems,
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="einkaufslisten-export-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  // ─────────────────────────────────────────────
  // POST /import – Einkaufslisten importieren
  // ─────────────────────────────────────────────
  fastify.post('/import', {
    schema: {
      description: 'Einkaufslisten aus JSON importieren',
      tags: ['Einkaufsliste'],
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

    if (!importData?.lists || !Array.isArray(importData.lists)) {
      return reply.status(400).send({ error: 'Ungültiges Export-Format. Erwartet: { lists: [...] }' });
    }

    if (importData.lists.length === 0) {
      return reply.status(400).send({ error: 'Keine Einkaufslisten zum Importieren gefunden.' });
    }

    if (importData.lists.length > 500) {
      return reply.status(400).send({ error: 'Maximal 500 Listen pro Import erlaubt.' });
    }

    let imported = 0;
    let itemsImported = 0;

    const insertList = db.prepare(
      'INSERT INTO shopping_lists (user_id, name, is_active) VALUES (?, ?, ?)'
    );
    const insertItem = db.prepare(
      'INSERT INTO shopping_list_items (shopping_list_id, ingredient_name, amount, unit, is_checked) VALUES (?, ?, ?, ?, ?)'
    );

    const transaction = db.transaction(() => {
      for (const list of importData.lists) {
        const name = list.name || `Import ${new Date().toLocaleDateString('de-DE')}`;
        const { lastInsertRowid } = insertList.run(userId, name, 0); // Importierte Listen immer inaktiv
        const listId = Number(lastInsertRowid);
        imported++;

        if (list.items?.length) {
          for (const item of list.items) {
            if (!item.ingredient_name) continue;
            insertItem.run(
              listId,
              item.ingredient_name,
              item.amount || null,
              item.unit || null,
              item.is_checked ? 1 : 0
            );
            itemsImported++;
          }
        }
      }
    });

    transaction();

    return {
      message: `${imported} Listen importiert, ${itemsImported} Artikel.`,
      imported,
      items_imported: itemsImported,
    };
  });
}
