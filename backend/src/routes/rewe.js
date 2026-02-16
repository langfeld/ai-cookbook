/**
 * ============================================
 * REWE Integration Routen
 * ============================================
 * Einkaufslisten-Matching, Marktsuche und Produktlinks
 */

import { matchShoppingListWithRewe, searchProducts, scoreRelevance } from '../services/rewe-api.js';
import db from '../config/database.js';

export default async function reweRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  /**
   * GET /api/rewe/search-ingredient
   * REWE-Produkte für eine Zutat suchen (für Produkt-Auswahl)
   * Gibt bis zu 10 Produkte sortiert nach Preis zurück
   */
  fastify.get('/search-ingredient', {
    schema: {
      description: 'REWE-Produkte für Zutat suchen',
      tags: ['REWE'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 2 },
        },
      },
    },
  }, async (request) => {
    const query = request.query.q;
    const { products, error } = await searchProducts(query, { limit: 10 });

    if (error) {
      return { products: [], error };
    }

    // Relevanz-Score berechnen und nach Relevanz (absteigend), dann Preis (aufsteigend) sortieren
    const scored = products.map(p => ({
      ...p,
      relevance: scoreRelevance(p.name, query),
    }));

    const sorted = scored.sort((a, b) => {
      // Relevanz-Gruppen (10er-Schritte): innerhalb gleicher Gruppe nach Preis
      const groupA = Math.floor(a.relevance / 10);
      const groupB = Math.floor(b.relevance / 10);
      if (groupB !== groupA) return groupB - groupA;
      // Innerhalb gleicher Relevanz: günstigste zuerst
      if (!a.price && !b.price) return 0;
      if (!a.price) return 1;
      if (!b.price) return -1;
      return a.price - b.price;
    });

    return { products: sorted };
  });

  /**
   * POST /api/rewe/match-shopping-list
   * Gesamte Einkaufsliste mit REWE-Produkten matchen
   * Streamt Fortschritt als Server-Sent Events (SSE)
   */
  fastify.post('/match-shopping-list', {
    schema: {
      description: 'Einkaufsliste mit REWE matchen (SSE-Stream)',
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

    // SSE-Stream einrichten
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',   // nginx-Buffering verhindern
    });

    // Hilfsfunktion: SSE-Event senden
    const sendEvent = (type, data) => {
      reply.raw.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    // Start-Event
    sendEvent('start', { total: items.length });

    const results = await matchShoppingListWithRewe(
      items.map(i => ({
        name: i.ingredient_name,
        amount: i.amount,
        unit: i.unit,
      })),
      // onProgress-Callback → sendet SSE-Events
      (progress) => {
        sendEvent('progress', progress);
      },
    );

    // Ergebnisse in die Datenbank schreiben
    const updateStmt = db.prepare(`
      UPDATE shopping_list_items
      SET rewe_product_id = ?, rewe_product_name = ?, rewe_price = ?, rewe_package_size = ?
      WHERE shopping_list_id = ? AND ingredient_name = ?
    `);

    const saveAll = db.transaction(() => {
      for (let i = 0; i < results.length; i++) {
        const match = results[i].reweMatch;
        if (match?.product) {
          updateStmt.run(
            match.product.id || null,
            match.product.name || null,
            match.product.price || null,
            match.product.packageSize || null,
            listId,
            items[i].ingredient_name,
          );
        }
      }
    });
    saveAll();

    // Gesamtpreis berechnen (in Cent)
    const totalEstimate = results.reduce((sum, r) => {
      return sum + (r.reweMatch?.product?.price || 0);
    }, 0);

    const matchedCount = results.filter(r => r.reweMatch).length;

    // Abschluss-Event
    sendEvent('done', {
      totalItems: results.length,
      matchedCount,
      totalEstimate,
    });

    reply.raw.end();
    // Fastify soll die Response nicht nochmal senden
    return reply;
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
