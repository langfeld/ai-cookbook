/**
 * ============================================
 * REWE API Service
 * ============================================
 *
 * Integration mit REWE Online-Shop für:
 * - Produktsuche (Zutaten → REWE Produkte)
 * - Preisabfrage & Packungsgrößen
 * - Direkt-Links zum REWE Online-Shop
 *
 * HINWEIS: REWE bietet keine offizielle API an.
 * Dieser Service nutzt die öffentlich zugängliche Web-API,
 * die auch die REWE-Website verwendet. Diese kann sich ändern.
 */

import { getReweConfig } from '../config/settings.js';

const REWE_SEARCH_URL = 'https://www.rewe.de/shop/api/products';
const REWE_SHOP_BASE = 'https://www.rewe.de/shop';

/**
 * Erzeugt einen URL-Slug aus einem Produktnamen
 * "Barilla Spaghetti Nr.5 500g" → "barilla-spaghetti-nr-5-500g"
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Erzeugt die REWE-Shop-URL für ein Produkt
 * @param {string} productName - Produktname
 * @param {string} productId - REWE Product-ID
 * @returns {string} URL zur Produktseite
 */
export function buildReweProductUrl(productName, productId) {
  if (!productId) return null;
  const slug = slugify(productName || 'produkt');
  return `${REWE_SHOP_BASE}/p/${slug}/${productId}`;
}

/**
 * Normalisiert Produkte aus dem Mobile-Format (Accept: *\/*)
 * Struktur: { products: [{ productId, title, listing: { currentRetailPrice, grammage }, imageURL }] }
 */
function parseMobileFormat(data) {
  return (data.products || []).map(product => {
    const listing = product.listing || {};
    const priceCents = listing.currentRetailPrice || null;
    const parsedSize = parsePackageSize(product.title);
    return {
      id: product.productId,
      name: product.title,
      price: priceCents,
      priceFormatted: priceCents ? formatPrice(priceCents) : null,
      packageSize: listing.grammage || parsedSize.raw || '',
      productUrl: buildReweProductUrl(product.title, product.productId),
      imageUrl: product.imageURL || null,
      parsedAmount: parsedSize.amount,
      parsedUnit: parsedSize.unit,
    };
  });
}

/**
 * Normalisiert Produkte aus dem HAL/JSON-Format (Accept: application/json)
 * Struktur: { _embedded: { products: [{ id, productName, _embedded: { articles }, _links }] } }
 */
function parseHalFormat(data) {
  const embedded = data._embedded?.products || [];
  return embedded.map(product => {
    const article = product._embedded?.articles?.[0];
    const pricing = article?._embedded?.listing?.pricing || {};
    const priceCents = pricing.currentRetailPrice || null;
    const grammage = pricing.grammage || '';
    const name = product.productName || '';
    const productId = product.id || '';
    const parsedSize = parsePackageSize(name);
    // HAL-Format liefert _links.detail.href als "/p/slug/id"
    const detailHref = product._links?.detail?.href;
    const productUrl = detailHref
      ? `${REWE_SHOP_BASE}${detailHref}`
      : buildReweProductUrl(name, productId);
    const imageUrl = product.media?.images?.[0]?._links?.self?.href || null;
    return {
      id: productId,
      name,
      price: priceCents,
      priceFormatted: priceCents ? formatPrice(priceCents) : null,
      packageSize: grammage || parsedSize.raw || '',
      productUrl,
      imageUrl,
      parsedAmount: parsedSize.amount,
      parsedUnit: parsedSize.unit,
    };
  });
}

/**
 * Sucht Produkte bei REWE (intern genutzt)
 *
 * HINWEIS: Die REWE-API liefert je nach Accept-Header unterschiedliche Formate:
 * - Accept: *\/* → Mobile-Format (flache Struktur, einfacher)
 * - Accept: application/json → HAL-Format (verschachtelt mit _embedded)
 * Wir nutzen *\/* (Mobile-Format), parsen aber als Fallback auch HAL.
 */
export async function searchProducts(query, options = {}) {
  const { marketId } = getReweConfig();

  if (!marketId) {
    return { products: [], error: 'REWE Markt-ID nicht konfiguriert (Admin → Einstellungen)' };
  }

  try {
    const params = new URLSearchParams({
      search: query,
      storeId: marketId,
      market: marketId,           // Beide nötig für Preise + Verfügbarkeit!
      objectsPerPage: String(options.limit || 5),
      page: String(options.page || 1),
      serviceTypes: 'PICKUP',
    });

    const response = await fetch(`${REWE_SEARCH_URL}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: '*/*',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`REWE API Fehler für "${query}": ${response.status}`);
      return { products: [], error: `REWE API nicht erreichbar (${response.status})` };
    }

    const data = await response.json();

    // Auto-detect: Mobile-Format hat data.products, HAL hat data._embedded.products
    let products;
    if (data.products && Array.isArray(data.products)) {
      products = parseMobileFormat(data);
    } else if (data._embedded?.products) {
      products = parseHalFormat(data);
    } else {
      console.warn(`REWE: Unbekanntes Antwortformat für "${query}"`, Object.keys(data));
      products = [];
    }

    return { products, total: data.pagination?.objectCount || products.length };
  } catch (error) {
    console.error(`REWE Suche fehlgeschlagen für "${query}":`, error.message);
    return { products: [], error: error.message };
  }
}

/**
 * Bewertet, wie gut ein Produktname zu einer Zutat passt (0–100).
 * Höher = besser. Filtert z.B. "Energydrink mit Mango-Geschmack" weg wenn man "Mango" sucht.
 */
export function scoreRelevance(productName, ingredientName) {
  const pLow = productName.toLowerCase();
  const iLow = ingredientName.toLowerCase();
  let score = 0;

  // RegExp-Sonderzeichen escapen
  const escaped = iLow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordBoundary = new RegExp(`(?:^|[\\s,;.!?()/\\-])${escaped}(?:[\\s,;.!?()/\\-]|$)`);

  // Exakter Match oder Produktname beginnt mit Zutat → sehr relevant
  if (pLow === iLow) {
    score += 60;
  } else if (pLow.startsWith(iLow + ' ') || pLow.startsWith(iLow + ',') || pLow.startsWith(iLow + '\n')) {
    score += 50;
  }

  // Zutat ist ein eigenständiges Wort im Produktnamen
  if (wordBoundary.test(pLow)) {
    score += 30;
  } else {
    // Prüfe deutsche Komposita: "Weidebutter" enthält "butter" als Suffix → sehr relevant
    // Prüfe jedes Wort einzeln, nicht nur den ganzen String
    const words = pLow.split(/[\s,;.!?()/\-]+/).filter(Boolean);
    const isCompoundSuffix = words.some(w => w !== iLow && w.endsWith(iLow) && w.length > iLow.length);
    const isCompoundPrefix = words.some(w => w !== iLow && w.startsWith(iLow) && w.length > iLow.length);

    if (isCompoundSuffix) {
      // "Weidebutter" → "butter" als Suffix = IS Butter. Im Deutschen definiert
      // das Grundwort (Suffix) die Kategorie, das Bestimmungswort nur die Art.
      score += 30;
    } else if (isCompoundPrefix) {
      // "Buttermilch" → "butter" als Prefix = anderes Produkt (Milch, nicht Butter)
      score += 10;
    } else if (pLow.includes(iLow)) {
      // Zutat ist irgendwo versteckt → minimal relevant
      score += 5;
    }
  }

  // Kurze Produktnamen sind eher das echte Produkt (nicht "XY mit Z-Geschmack Extra Plus")
  if (pLow.length < 30) score += 10;
  if (pLow.length < 20) score += 5;

  // Negativ: Geschmacks-/Aroma-Indikatoren → Produkt ist NICHT die Zutat selbst
  const flavorIndicators = [
    'geschmack', 'aroma', 'flavour', 'flavor', 'style',
    'drink', 'energy', 'likör', 'liqueur', 'sirup',
    'bonbon', 'gummibär', 'gummies', 'drops', 'lutscher',
    'chips', 'cracker', 'riegel', 'müsliriegel',
    'duschgel', 'seife', 'shampoo', 'deo', 'kerze',
    'tee ', 'eistee', 'limo', 'limonade', 'nektar',
  ];
  for (const indicator of flavorIndicators) {
    if (pLow.includes(indicator) && !iLow.includes(indicator)) {
      score -= 35;
    }
  }

  // Negativ: Saft/Smoothie (wenn man nicht explizit danach sucht)
  if ((pLow.includes('saft') || pLow.includes('smoothie')) && !iLow.includes('saft') && !iLow.includes('smoothie')) {
    score -= 25;
  }

  return score;
}

/**
 * Sucht das beste REWE-Produkt für eine Zutat
 * Strategie: Relevantestes + günstigstes Produkt
 */
async function findBestProduct(ingredientName, neededAmount, unit) {
  const { products } = await searchProducts(ingredientName);

  if (!products.length) {
    return null;
  }

  // Jedes Produkt mit Relevanz-Score versehen
  const scored = products
    .filter(p => p.price)
    .map(p => ({
      ...p,
      relevance: scoreRelevance(p.name, ingredientName),
    }));

  // Nur einigermaßen relevante Produkte (Score > 0)
  const relevant = scored.filter(p => p.relevance > 0);

  // Sortieren: Erst nach Relevanz (absteigend), bei gleicher Relevanz nach Preis (aufsteigend)
  const sorted = (relevant.length ? relevant : scored).sort((a, b) => {
    // Relevanz-Gruppen bilden (10er-Schritte) → innerhalb einer Gruppe nach Preis
    const relevanceGroupA = Math.floor(a.relevance / 10);
    const relevanceGroupB = Math.floor(b.relevance / 10);
    if (relevanceGroupB !== relevanceGroupA) return relevanceGroupB - relevanceGroupA;
    return a.price - b.price;
  });

  // Unter den Top-Relevanz-Produkten das günstigste nehmen, das die Menge abdeckt
  const topRelevance = sorted[0]?.relevance || 0;
  const topGroup = Math.floor(topRelevance / 10);
  const topTier = sorted.filter(p => Math.floor(p.relevance / 10) >= topGroup);

  // Bevorzuge passende Menge innerhalb der Top-Gruppe
  const suitable = topTier
    .filter(p => p.parsedAmount >= neededAmount || !p.parsedAmount)
    .sort((a, b) => a.price - b.price);

  const best = suitable[0] || topTier[0] || sorted[0] || products[0];

  // Überschuss berechnen
  const surplus = best.parsedAmount ? Math.max(0, best.parsedAmount - neededAmount) : 0;

  return {
    product: best,
    neededAmount,
    unit,
    packageAmount: best.parsedAmount,
    surplus,
    surplusForPantry: surplus > 0 ? {
      ingredient_name: ingredientName,
      amount: surplus,
      unit: best.parsedUnit || unit,
    } : null,
  };
}

/**
 * Parst eine Packungsgröße aus einem String (Titel oder Grammage)
 * z.B. "Barilla Spaghetti Nr.5 500g" -> { amount: 500, unit: "g", raw: "500g" }
 * z.B. "Weihenstephan H-Milch 3,5% 1l" -> { amount: 1000, unit: "ml", raw: "1l" }
 */
function parsePackageSize(sizeStr) {
  if (!sizeStr) return { amount: null, unit: null, raw: null };

  // Verschiedene Formate: "500g", "1kg", "1,5l", "250 ml", "6 Stück", "4x250ml"
  const match = sizeStr.match(/([\d.,]+)\s*(?:x\s*[\d.,]+\s*)?(g|kg|ml|l|stk|stück|st)\b/i);
  if (!match) return { amount: null, unit: null, raw: null };

  let amount = parseFloat(match[1].replace(',', '.'));
  let unit = match[2].toLowerCase();
  const raw = match[0];

  // In Basiseinheit konvertieren
  if (unit === 'kg') {
    amount *= 1000;
    unit = 'g';
  } else if (unit === 'l') {
    amount *= 1000;
    unit = 'ml';
  }

  return { amount, unit, raw };
}

/**
 * Formatiert einen Preis in Euro (Eingabe in Cent!)
 */
function formatPrice(priceCents) {
  if (!priceCents) return 'Preis unbekannt';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(priceCents / 100);
}

/**
 * Matcht eine komplette Einkaufsliste mit REWE-Produkten
 * Für jede Zutat wird das passendste Produkt + Direktlink gesucht
 *
 * Rate-Limiting: 500ms Pause zwischen Anfragen, 2s Pause alle 10 Anfragen
 *
 * @param {object[]} shoppingItems - Array mit { name, amount, unit }
 * @param {function} [onProgress] - Optionaler Callback: (progress) => void
 *   progress: { current, total, itemName, matched, productName, price }
 */
export async function matchShoppingListWithRewe(shoppingItems, onProgress) {
  const results = [];
  const BATCH_SIZE = 10;
  const DELAY_BETWEEN = 500;       // ms zwischen einzelnen Anfragen
  const DELAY_BETWEEN_BATCHES = 2000; // ms zwischen Batches
  let matchedCount = 0;

  console.log(`REWE-Matching: ${shoppingItems.length} Zutaten…`);

  for (let i = 0; i < shoppingItems.length; i++) {
    const item = shoppingItems[i];
    const match = await findBestProduct(item.name, item.amount, item.unit);

    if (match) {
      matchedCount++;
      console.log(`  ✓ ${item.name} → ${match.product.name} (${match.product.priceFormatted || '?'})`);
    } else {
      console.log(`  ✗ ${item.name} → kein Treffer`);
    }

    results.push({
      ...item,
      reweMatch: match,
    });

    // Fortschritt melden
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: shoppingItems.length,
        itemName: item.name,
        matched: !!match,
        matchedCount,
        productName: match?.product?.name || null,
        price: match?.product?.priceFormatted || null,
      });
    }

    // Rate-Limiting: Pause zwischen Anfragen
    if (i < shoppingItems.length - 1) {
      // Größere Pause nach jedem Batch
      if ((i + 1) % BATCH_SIZE === 0) {
        console.log(`  ⏳ Batch-Pause (${DELAY_BETWEEN_BATCHES}ms)…`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      } else {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN));
      }
    }
  }

  console.log(`REWE-Matching fertig: ${matchedCount}/${results.length} zugeordnet`);

  return results;
}
