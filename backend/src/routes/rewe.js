/**
 * ============================================
 * REWE Integration Routen
 * ============================================
 * Produktsuche und Preisabfrage bei REWE
 */

import { searchProducts, findBestProduct, matchShoppingListWithRewe } from '../services/rewe-api.js';
import db from '../config/database.js';

export default async function reweRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  /**
   * GET /api/rewe/search
   * Produkte bei REWE suchen
   */
  fastify.get('/search', {
    schema: {
      description: 'REWE Produktsuche',
      tags: ['REWE'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 2 },
          limit: { type: 'integer', default: 10 },
        },
      },
    },
  }, async (request) => {
    const result = await searchProducts(request.query.q, {
      limit: request.query.limit,
    });
    return result;
  });

  /**
   * POST /api/rewe/match-ingredient
   * Bestes REWE-Produkt für eine Zutat finden
   */
  fastify.post('/match-ingredient', {
    schema: {
      description: 'Bestes REWE-Produkt für Zutat finden',
      tags: ['REWE'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['ingredient', 'amount', 'unit'],
        properties: {
          ingredient: { type: 'string' },
          amount: { type: 'number' },
          unit: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { ingredient, amount, unit } = request.body;
    const result = await findBestProduct(ingredient, amount, unit);
    return result || { error: 'Kein passendes Produkt gefunden' };
  });

  /**
   * POST /api/rewe/match-shopping-list
   * Gesamte Einkaufsliste mit REWE-Produkten matchen
   */
  fastify.post('/match-shopping-list', {
    schema: {
      description: 'Einkaufsliste mit REWE matchen',
      tags: ['REWE'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['listId'],
        properties: {
          listId: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const { listId } = request.body;

    // Einkaufslisten-Items laden
    const items = db.prepare(`
      SELECT sli.* FROM shopping_list_items sli
      JOIN shopping_lists sl ON sli.shopping_list_id = sl.id
      WHERE sl.id = ? AND sl.user_id = ? AND sli.is_checked = 0
    `).all(listId, request.user.id);

    if (!items.length) {
      return reply.status(404).send({ error: 'Keine offenen Items in der Einkaufsliste' });
    }

    const results = await matchShoppingListWithRewe(items.map(i => ({
      name: i.ingredient_name,
      amount: i.amount,
      unit: i.unit,
    })));

    // Gesamtpreis berechnen
    const totalEstimate = results.reduce((sum, r) => {
      return sum + (r.reweMatch?.product?.price || 0);
    }, 0);

    return {
      matches: results,
      totalEstimate,
      totalItems: results.length,
    };
  });

  /**
   * GET /api/rewe/markets
   * REWE-Märkte in der Nähe einer PLZ suchen
   * Nutzt die öffentliche REWE Shop-API (Marktauswahl nach PLZ)
   */
  fastify.get('/markets', {
    schema: {
      description: 'REWE-Märkte nach PLZ suchen',
      tags: ['REWE'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['search'],
        properties: {
          search: { type: 'string', minLength: 3 },
        },
      },
    },
  }, async (request, reply) => {
    const { search } = request.query;
    // Nur Ziffern für die PLZ extrahieren
    const zip = search.replace(/\D/g, '').slice(0, 5);
    if (zip.length < 4) {
      return reply.status(400).send({ markets: [], error: 'Bitte eine gültige PLZ eingeben (mind. 4 Ziffern).' });
    }

    const url = `https://www.rewe.de/shop/api/marketselection/zipcodes/${zip}/services/pickup`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Cookbook/1.0)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        return {
          markets: [],
          error: `REWE-API nicht erreichbar (Status ${response.status}). Bitte Markt-ID manuell eingeben.`,
        };
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        return { markets: [], error: 'Keine REWE-Märkte für diese PLZ gefunden.' };
      }

      // Nur echte Märkte (keine Abholstationen), maximal 20
      const markets = data
        .filter(m => !m.isPickupStation)
        .slice(0, 20)
        .map(m => ({
          id: m.wwIdent,
          name: m.companyName || m.displayName || 'REWE Markt',
          displayName: m.displayName || 'REWE Markt',
          street: m.street || '',
          city: m.city || '',
          zipCode: m.zipCode || '',
          distance: m.distance || null, // in Metern
        }));

      return { markets };
    } catch (err) {
      console.error('REWE Marktsuche fehlgeschlagen:', err.message);
      return {
        markets: [],
        error: 'Marktsuche fehlgeschlagen. Bitte versuche es erneut oder gib die Markt-ID manuell ein.',
      };
    }
  });
}
