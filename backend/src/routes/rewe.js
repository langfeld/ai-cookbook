/**
 * ============================================
 * REWE Integration Routen
 * ============================================
 * Einkaufslisten-Matching, Marktsuche und Produktlinks
 */

import { matchShoppingListWithRewe, searchProducts, scoreRelevance, buildReweProductUrl } from '../services/rewe-api.js';
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

    // Gespeicherte Produkt-Präferenzen des Users laden
    const prefRows = db.prepare(
      'SELECT ingredient_name, rewe_product_id, rewe_product_name, rewe_price, rewe_package_size FROM rewe_product_preferences WHERE user_id = ?'
    ).all(request.user.id);

    const preferences = new Map(
      prefRows.map(p => [p.ingredient_name.toLowerCase().trim(), p])
    );

    console.log(`📦 ${preferences.size} gespeicherte Produkt-Präferenzen geladen`);

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
      // Optionen: gespeicherte Präferenzen + Preis-Update-Callback mitgeben
      {
        preferences,
        onPriceUpdate: (productId, ingredientName, newPrice, packageSize) => {
          // Preis in der Präferenz-Tabelle aktualisieren
          db.prepare(`
            UPDATE rewe_product_preferences
            SET rewe_price = ?, rewe_package_size = COALESCE(?, rewe_package_size), updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND ingredient_name = ?
          `).run(newPrice, packageSize || null, request.user.id, ingredientName.toLowerCase().trim());
        },
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

  /**
   * GET /api/rewe/preferences
   * Gespeicherte Produkt-Präferenzen des Users laden
   */
  fastify.get('/preferences', {
    schema: {
      description: 'Gespeicherte REWE Produkt-Präferenzen laden',
      tags: ['REWE'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const prefs = db.prepare(`
      SELECT id, ingredient_name, rewe_product_id, rewe_product_name, rewe_price, rewe_package_size, times_selected, updated_at
      FROM rewe_product_preferences
      WHERE user_id = ?
      ORDER BY ingredient_name ASC
    `).all(request.user.id);

    return { preferences: prefs, total: prefs.length };
  });

  /**
   * DELETE /api/rewe/preferences/:id
   * Einzelne Produkt-Präferenz löschen (vergessen)
   */
  fastify.delete('/preferences/:id', {
    schema: {
      description: 'Produkt-Präferenz löschen',
      tags: ['REWE'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const result = db.prepare(
      'DELETE FROM rewe_product_preferences WHERE id = ? AND user_id = ?'
    ).run(request.params.id, request.user.id);

    if (!result.changes) {
      return reply.status(404).send({ error: 'Präferenz nicht gefunden' });
    }
    return { message: 'Präferenz gelöscht' };
  });

  /**
   * DELETE /api/rewe/preferences
   * Alle Produkt-Präferenzen des Users löschen
   */
  fastify.delete('/preferences', {
    schema: {
      description: 'Alle Produkt-Präferenzen löschen',
      tags: ['REWE'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const result = db.prepare(
      'DELETE FROM rewe_product_preferences WHERE user_id = ?'
    ).run(request.user.id);
    return { message: `${result.changes} Präferenz(en) gelöscht`, deleted: result.changes };
  });

  /**
   * GET /api/rewe/cart-script
   * Generiert ein JavaScript-Bookmarklet/Script, das auf shop.rewe.de
   * alle gematchten Produkte automatisch in den Warenkorb legt.
   *
   * "Trick 17": Das Script läuft im Kontext von rewe.de und nutzt
   * deren interne Cart-API – kein CORS-Problem!
   */
  fastify.get('/cart-script', {
    schema: {
      description: 'REWE Warenkorb-Script generieren (Bookmarklet)',
      tags: ['REWE'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const userId = request.user.id;

    // Aktive Liste mit REWE-Produkt-IDs laden
    const activeList = db.prepare(
      'SELECT id FROM shopping_lists WHERE user_id = ? AND is_active = 1'
    ).get(userId);

    if (!activeList) {
      return { error: 'Keine aktive Einkaufsliste.' };
    }

    const items = db.prepare(`
      SELECT ingredient_name, rewe_product_id, rewe_product_name, rewe_price
      FROM shopping_list_items
      WHERE shopping_list_id = ? AND is_checked = 0 AND rewe_product_id IS NOT NULL
    `).all(activeList.id);

    if (!items.length) {
      return { error: 'Keine REWE-Produkte zugeordnet.' };
    }

    // Produkt-Daten für das Script aufbereiten (inkl. URL für Fallback)
    const products = items.map(i => ({
      id: String(i.rewe_product_id),
      name: i.rewe_product_name || i.ingredient_name,
      price: i.rewe_price,
      url: buildReweProductUrl(i.rewe_product_name || i.ingredient_name, i.rewe_product_id),
    }));

    // JavaScript-Script generieren, das auf rewe.de läuft
    const script = generateReweCartScript(products);

    return {
      products,
      script,
      productCount: products.length,
      instructions: [
        '1. Öffne www.rewe.de/shop und logge dich ein',
        '2. Wähle deinen Markt / Liefergebiet aus',
        '3. Öffne die Browser-Konsole (F12 → Konsole)',
        '4. Füge das Script ein und drücke Enter',
        '5. Die Produkte werden automatisch in den Warenkorb gelegt',
      ],
    };
  });
}

/**
 * Generiert ein JavaScript-Script für die REWE-Website.
 * 
 * Strategie (basierend auf Reverse-Engineering der REWE-Website):
 * 1. Für jedes Produkt: Produktseite fetchen (GET /shop/p/{productId})
 * 2. Aus dem HTML die marktspezifische "listingId" extrahieren (data-listingid Attribut)
 * 3. POST /shop/api/baskets/listings/{listingId} mit {"quantity":1,"includeTimeslot":false,"context":"product-detail"}
 *
 * Das funktioniert, weil:
 * - Die Produkt-ID (z.B. 7077421) ≠ Listing-ID (z.B. 8-TCBKSCKJ-f38af4b3-...)
 * - Die Listing-ID ist marktspezifisch und steht im HTML als data-listingid
 * - Das Script auf rewe.de läuft → Same-Origin → kein CORS
 * - Die Cookies des eingeloggten Users werden automatisch mitgesendet
 */
function generateReweCartScript(products) {
  const productsJson = JSON.stringify(products);

  return `(async function() {
  /* AI Cookbook → REWE Warenkorb v3 */
  if (!location.hostname.includes('rewe.de')) {
    alert('Dieses Script muss auf www.rewe.de ausgeführt werden!');
    return;
  }

  const products = ${productsJson};
  const log = (msg, ok) => console.log('%c🛒 ' + msg, 'color:' + (ok === false ? '#dc2626' : ok === true ? '#16a34a' : '#cc0000') + ';font-weight:bold');
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  log('AI Cookbook: ' + products.length + ' Produkte in den Warenkorb legen...');

  /* ──── Fortschritts-Banner ──── */
  const oldBanner = document.getElementById('ai-cookbook-banner');
  if (oldBanner) oldBanner.remove();

  const banner = document.createElement('div');
  banner.id = 'ai-cookbook-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#cc0000;color:white;padding:14px 24px;font-family:system-ui,sans-serif;font-size:14px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;gap:12px';
  const bannerText = document.createElement('span');
  bannerText.textContent = '🛒 Starte...';
  banner.appendChild(bannerText);
  document.body.appendChild(banner);

  const update = (text, bg) => {
    bannerText.textContent = text;
    if (bg) banner.style.background = bg;
  };

  let added = 0, failed = 0, skipped = 0;
  const errors = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    update('🛒 ' + (i+1) + '/' + products.length + ': ' + p.name + '...');

    try {
      /* Schritt 1: Produktseite abrufen, um die Listing-ID zu finden */
      log('Lade Produktseite: /shop/p/' + p.id);
      const pageRes = await fetch('/shop/p/' + p.id, {
        credentials: 'include',
        headers: { 'Accept': 'text/html' }
      });

      if (!pageRes.ok) {
        failed++;
        const err = 'Produktseite nicht erreichbar (Status ' + pageRes.status + ')';
        log('❌ ' + p.name + ': ' + err, false);
        errors.push({ name: p.name, error: err });
        await wait(300);
        continue;
      }

      const html = await pageRes.text();

      /* Schritt 2: Listing-ID aus dem HTML extrahieren */
      /* Suche: data-listingid="..." im HTML */
      const listingMatch = html.match(/data-listingid="([^"]+)"/);

      if (!listingMatch) {
        /* Fallback: Vielleicht im JSON-LD oder Script-Tags */
        const jsonMatch = html.match(/"listingId"\\s*:\\s*"([^"]+)"/);
        if (!jsonMatch) {
          failed++;
          const err = 'Keine Listing-ID gefunden (Markt nicht ausgewählt?)';
          log('❌ ' + p.name + ': ' + err, false);
          errors.push({ name: p.name, error: err });
          await wait(300);
          continue;
        }
        var listingId = jsonMatch[1];
      } else {
        var listingId = listingMatch[1];
      }

      log('  Listing-ID: ' + listingId);

      /* Schritt 3: Produkt in den Warenkorb legen */
      const cartRes = await fetch('/shop/api/baskets/listings/' + encodeURIComponent(listingId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: 1,
          includeTimeslot: false,
          context: 'product-detail'
        }),
        credentials: 'include'
      });

      if (cartRes.ok) {
        added++;
        log('✅ ' + p.name + ' → Warenkorb!', true);
      } else {
        /* Bei 409 (Conflict) ist das Produkt evtl. schon im Warenkorb */
        if (cartRes.status === 409) {
          skipped++;
          log('⚠️ ' + p.name + ' (bereits im Warenkorb)', true);
        } else {
          failed++;
          let errDetail = 'Status ' + cartRes.status;
          try { const errBody = await cartRes.json(); errDetail = errBody.message || errBody.error || errDetail; } catch(e) {}
          log('❌ ' + p.name + ': ' + errDetail, false);
          errors.push({ name: p.name, error: errDetail });
        }
      }
    } catch(e) {
      failed++;
      log('❌ ' + p.name + ': ' + e.message, false);
      errors.push({ name: p.name, error: e.message });
    }

    /* Kleine Pause, um REWE nicht zu überlasten */
    await wait(500);
  }

  /* ──── Ergebnis ──── */
  const total = added + skipped;
  const emoji = total > 0 ? '✅' : '❌';
  let resultMsg = emoji + ' ' + added + ' von ' + products.length + ' Produkten hinzugefügt';
  if (skipped) resultMsg += ', ' + skipped + ' waren schon drin';
  if (failed) resultMsg += ', ' + failed + ' fehlgeschlagen';

  update(resultMsg + '  ', total > 0 ? '#16a34a' : '#dc2626');

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'OK';
  closeBtn.style.cssText = 'background:white;color:inherit;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px';
  closeBtn.onclick = () => banner.remove();
  banner.appendChild(closeBtn);

  log('');
  log('═══════════════════════════════════');
  log('Ergebnis: ' + added + ' hinzugefügt, ' + skipped + ' übersprungen, ' + failed + ' fehlgeschlagen');
  if (errors.length) {
    log('Fehler bei:');
    errors.forEach(e => log('  • ' + e.name + ': ' + e.error, false));
  }
  if (total > 0) log('Lade die Seite neu (F5) um deinen Warenkorb zu sehen!');
  log('═══════════════════════════════════');
})();`
;
}
