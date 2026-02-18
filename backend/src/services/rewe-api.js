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
      parsedPieceCount: parsedSize.pieceCount || null,
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
      parsedPieceCount: parsedSize.pieceCount || null,
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
 * Berechnet, wie viele REWE-Packungen benötigt werden.
 *
 * Logik:
 * - Stückangaben ("2 Stk Halloumi") → Menge = Anzahl Packungen
 * - Gewicht/Volumen ("400g Reis", "1l Milch") → ceil(benötigte Menge / Packungsgröße)
 * - Kücheneinheiten (EL, TL, Prise…) → 1 Packung reicht meist
 * - Keine Angabe → 1
 *
 * @param {number|null} neededAmount - Benötigte Menge (aus Einkaufsliste)
 * @param {string|null} neededUnit - Einheit (aus Einkaufsliste)
 * @param {number|null} packageAmount - Packungsgröße in Basiseinheit (g/ml)
 * @param {string|null} packageUnit - Einheit der Packungsgröße (g/ml/stk)
 * @param {number|null} [pieceCount] - Stückzahl pro Packung (aus Produktname: "Duo"=2, "4 Stück"=4)
 * @returns {number} Anzahl benötigter Packungen (mind. 1)
 */
export function calculatePackagesNeeded(neededAmount, neededUnit, packageAmount, packageUnit, pieceCount) {
  // Ohne Mengenangabe → 1 Packung
  if (!neededAmount || neededAmount <= 0) return 1;

  const unitLow = (neededUnit || '').toLowerCase().trim().replace(/\.$/, ''); // "Stk." → "stk"
  const pkgUnitLow = (packageUnit || '').toLowerCase().trim().replace(/\.$/, '');

  // Kücheneinheiten → 1 Packung reicht normalerweise
  const kitchenUnits = [
    'el', 'tl', 'prise', 'prisen', 'etwas', 'messerspitze',
    'zehe', 'zehen', 'scheibe', 'scheiben', 'blatt', 'blätter',
    'bund', 'zweig', 'zweige', 'handvoll', 'spritzer', 'schuss',
    'nach geschmack', 'n. b', 'dose', 'dosen', 'glas', 'becher',
  ];
  if (kitchenUnits.includes(unitLow)) return 1;

  // Stückeinheiten (einkaufsbezogen)
  const pieceUnits = [
    'stk', 'stück', 'st', 'packung', 'pkg', 'pck', 'päckchen',
    'verp', 'verpackung', 'flasche', 'flaschen', 'tüte', 'tüten',
    'beutel', 'tafel', 'tafeln', 'netz',
  ];

  const neededIsPiece = pieceUnits.includes(unitLow) || !unitLow;
  const pkgIsPiece = pieceUnits.includes(pkgUnitLow);

  // Gewicht-/Volumeneinheiten
  const weightUnits = ['g', 'kg'];
  const volumeUnits = ['ml', 'l'];
  const neededIsWeight = weightUnits.includes(unitLow);
  const neededIsVolume = volumeUnits.includes(unitLow);
  const pkgIsWeight = weightUnits.includes(pkgUnitLow);
  const pkgIsVolume = volumeUnits.includes(pkgUnitLow);

  // ─── Fall 1: Beide Stück-Einheiten ───
  // z.B. "2 Stk" Brötchen + Packung "4 Stück" → ceil(2/4) = 1
  if (neededIsPiece && pkgIsPiece && packageAmount > 0) {
    return Math.max(1, Math.ceil(neededAmount / packageAmount));
  }

  // ─── Fall 2: Stück benötigt, Packung nach Gewicht ───
  // z.B. "2 Stk" Halloumi + Packung "225g" → jede Packung = 1 Stück → 2
  // z.B. "2 Verp." Butter + Packung "250g" → 2
  // ABER: Wenn Stückzahl pro Packung bekannt (z.B. "Duo"=2, "Trio"=3):
  //       "2 Stk" Zwiebel + "Duo 150g" → pieceCount=2 → ceil(2/2) = 1
  if (neededIsPiece && (pkgIsWeight || pkgIsVolume)) {
    if (pieceCount && pieceCount > 0) {
      return Math.max(1, Math.ceil(neededAmount / pieceCount));
    }
    return Math.ceil(neededAmount);
  }

  // ─── Fall 3: Stück benötigt, keine Packungsinfo ───
  if (neededIsPiece && !packageAmount) {
    return Math.ceil(neededAmount);
  }

  // ─── Fall 4: Gewicht/Volumen benötigt + Packungsgröße bekannt ───
  if (packageAmount > 0) {
    let neededBase = neededAmount;
    if (unitLow === 'kg') neededBase = neededAmount * 1000;
    else if (unitLow === 'l') neededBase = neededAmount * 1000;

    if ((neededIsWeight && pkgIsWeight) || (neededIsVolume && pkgIsVolume)) {
      return Math.max(1, Math.ceil(neededBase / packageAmount));
    }
  }

  // ─── Fallback: 1 Packung ───
  return 1;
}

/**
 * Sucht das beste REWE-Produkt für eine Zutat
 * Strategie: Relevantestes Produkt mit dem günstigsten GESAMTPREIS
 * (berücksichtigt, wie viele Packungen nötig sind)
 *
 * Beispiel: 2× Knoblauch benötigt
 *   - "Knoblauch 1 Stk" 1,00€ → 2 Packungen → 2,00€ Gesamt
 *   - "Knoblauch 3er Netz" 1,50€ → 1 Packung → 1,50€ Gesamt ← günstiger!
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
  const candidates = relevant.length ? relevant : scored;

  // Für jeden Kandidaten: benötigte Packungen + Gesamtpreis berechnen
  const withCosts = candidates.map(p => {
    const qty = calculatePackagesNeeded(neededAmount, unit, p.parsedAmount, p.parsedUnit, p.parsedPieceCount);
    const totalPrice = p.price * qty;

    // Grundpreis berechnen (Cents pro kg bzw. pro Stück)
    // Dient als Maß für das Preis-Leistungs-Verhältnis
    let pricePerUnit = null;
    if (p.parsedAmount > 0 && p.price > 0) {
      if (['g', 'kg'].includes(p.parsedUnit)) {
        // Cents pro kg (parsedAmount ist bereits in g)
        pricePerUnit = (p.price / p.parsedAmount) * 1000;
      } else if (['ml', 'l'].includes(p.parsedUnit)) {
        // Cents pro Liter (parsedAmount ist bereits in ml)
        pricePerUnit = (p.price / p.parsedAmount) * 1000;
      } else if (['stück', 'stk', 'st'].includes(p.parsedUnit)) {
        // Cents pro Stück
        pricePerUnit = p.price / p.parsedAmount;
      }
    }

    return { ...p, packagesNeeded: qty, totalPrice, pricePerUnit };
  });

  // Sortieren: Erst nach Relevanz-Gruppe (10er-Schritte), dann nach GRUNDPREIS
  // Der Grundpreis (€/kg, €/Stück) bevorzugt größere, preiswertere Packungen.
  // Beispiel: Zwiebel-Netz 500g für 1,19€ (2,38€/kg) schlägt
  //           Zwiebel-Duo 150g für 0,99€ (6,60€/kg)
  withCosts.sort((a, b) => {
    const groupA = Math.floor(a.relevance / 10);
    const groupB = Math.floor(b.relevance / 10);
    if (groupB !== groupA) return groupB - groupA;

    // Innerhalb gleicher Relevanz: günstigster Grundpreis zuerst
    if (a.pricePerUnit != null && b.pricePerUnit != null) {
      const unitDiff = a.pricePerUnit - b.pricePerUnit;
      if (Math.abs(unitDiff) > 0.01) return unitDiff;
    }

    // Fallback: günstigster Gesamtpreis
    return a.totalPrice - b.totalPrice;
  });

  // Top-Relevanz-Gruppe ermitteln
  const topGroup = Math.floor((withCosts[0]?.relevance || 0) / 10);
  const topTier = withCosts.filter(p => Math.floor(p.relevance / 10) >= topGroup);

  // Das mit dem günstigsten Gesamtpreis in der Top-Gruppe (bereits sortiert)
  const best = topTier[0] || withCosts[0] || products[0];

  const packagesNeeded = best.packagesNeeded || 1;
  const totalPrice = best.totalPrice || best.price;

  // Überschuss berechnen (basierend auf Gesamtmenge aller Packungen)
  const totalPackageAmount = best.parsedAmount ? best.parsedAmount * packagesNeeded : 0;
  let surplus = 0;
  if (totalPackageAmount && neededAmount) {
    // Nur bei kompatiblen Einheiten (Gewicht/Volumen) Überschuss berechnen
    const unitLow = (unit || '').toLowerCase();
    const pkgUnitLow = (best.parsedUnit || '').toLowerCase();
    const bothWeight = ['g', 'kg'].includes(unitLow) && pkgUnitLow === 'g';
    const bothVolume = ['ml', 'l'].includes(unitLow) && pkgUnitLow === 'ml';
    if (bothWeight || bothVolume) {
      let neededBase = neededAmount;
      if (unitLow === 'kg') neededBase *= 1000;
      if (unitLow === 'l') neededBase *= 1000;
      surplus = Math.max(0, totalPackageAmount - neededBase);
    }
  }

  return {
    product: best,
    neededAmount,
    unit,
    packageAmount: best.parsedAmount,
    packagesNeeded,
    totalPrice,
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
 * z.B. "REWE Bio Zwiebel Duo 150g"     -> { amount: 150, unit: "g", raw: "150g", pieceCount: 2 }
 *
 * `pieceCount` wird aus Multiplier-Wörtern im Titel extrahiert:
 * "Duo" → 2, "Trio" → 3, "Doppelpack" → 2, "3er Pack" → 3, etc.
 * Dies ist unabhängig von amount/unit und hilft bei der Mengenberechnung,
 * wenn Stückzahlen benötigt aber Gewichtspackungen gefunden werden.
 */
function parsePackageSize(sizeStr) {
  if (!sizeStr) return { amount: null, unit: null, raw: null, pieceCount: null };

  // Verschiedene Formate: "500g", "1kg", "1,5l", "250 ml", "6 Stück", "4x250ml"
  const match = sizeStr.match(/([\d.,]+)\s*(?:x\s*[\d.,]+\s*)?(g|kg|ml|l|stk|stück|st)\b/i);
  if (!match) return { amount: null, unit: null, raw: null, pieceCount: parsePieceCountFromName(sizeStr) };

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

  // Stückzahl aus Multiplier-Wörtern extrahieren (Duo, Trio, Doppelpack…)
  // Nur relevant, wenn die Haupteinheit NICHT schon "stück" ist
  const pieceCount = (unit === 'stück' || unit === 'stk' || unit === 'st')
    ? amount  // "4 Stück" → pieceCount = 4
    : parsePieceCountFromName(sizeStr);

  return { amount, unit, raw, pieceCount };
}

/**
 * Erkennt Stückzahl-Indikatoren in Produktnamen.
 *
 * 1. Explizite Multiplier: "Duo" → 2, "Trio" → 3, "Doppelpack" → 2, "3er Pack" → 3
 * 2. Mehrstück-Gebinde: "Netz", "Sack", "Schale", "Korb" → mind. 3 Stück
 *    (ein Netz Zwiebeln, eine Schale Tomaten etc. enthalten immer mehrere lose Stücke)
 */
function parsePieceCountFromName(name) {
  if (!name) return null;
  const low = name.toLowerCase();

  // Wort-Multiplier (exakte Stückzahl bekannt)
  if (/\bduo\b/.test(low)) return 2;
  if (/\btrio\b/.test(low)) return 3;
  if (/\bdoppelpack\b/.test(low)) return 2;
  if (/\bdreierpack\b/.test(low)) return 3;

  // "2er Pack", "3er-Pack", "4er Packung", etc.
  const erPackMatch = low.match(/(\d+)er[\s-]?pack/);
  if (erPackMatch) return parseInt(erPackMatch[1], 10);

  // Mehrstück-Gebinde: Netz, Sack, Schale, Korb
  // Diese Verpackungen enthalten IMMER mehrere lose Stücke.
  // Konservative Schätzung: mind. 3 Stück pro Gebinde.
  // → "2 Stk Zwiebel" + "500g im Netz" → ceil(2/3) = 1 Netz ✓
  // → "5 Stk Kartoffeln" + "2kg im Netz" → ceil(5/3) = 2 Netze ✓
  if (/\b(netz|im\s+netz|sack|schale|korb)\b/.test(low)) return 3;

  return null;
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
 * @param {object} [options] - Optionale Einstellungen
 * @param {Map} [options.preferences] - Map<ingredientName, { rewe_product_id, rewe_product_name, rewe_price, rewe_package_size }>
 * @param {function} [options.onPriceUpdate] - Callback wenn sich ein Preis geändert hat: (productId, ingredientName, newPrice, packageSize)
 */
export async function matchShoppingListWithRewe(shoppingItems, onProgress, options = {}) {
  const { preferences, onPriceUpdate } = options;
  const results = [];
  const BATCH_SIZE = 10;
  const DELAY_BETWEEN = 500;       // ms zwischen einzelnen Anfragen
  const DELAY_BETWEEN_BATCHES = 2000; // ms zwischen Batches
  let matchedCount = 0;

  console.log(`REWE-Matching: ${shoppingItems.length} Zutaten…`);

  for (let i = 0; i < shoppingItems.length; i++) {
    const item = shoppingItems[i];
    let match = null;
    let fromPreference = false;

    // 1. Gespeicherte Präferenz prüfen → gezielt nach dem Produkt suchen
    const pref = preferences?.get(item.name.toLowerCase().trim());
    if (pref) {
      // Trotzdem API abfragen um aktuellen Preis / Verfügbarkeit zu prüfen
      const { products } = await searchProducts(item.name);
      let found = products.find(p => p.id === pref.rewe_product_id);

      // Fallback: Wenn Zutatennamen-Suche das Produkt nicht findet (z.B. "Weizenwraps (Dürüm)")
      // → Suche nach dem gespeicherten Produktnamen (z.B. "Mission Original Wraps 6 Stück")
      if (!found && pref.rewe_product_name) {
        console.log(`  🔄 ${item.name}: Nicht per Zutatname gefunden → suche per Produktname "${pref.rewe_product_name}"…`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN));
        const { products: prodByName } = await searchProducts(pref.rewe_product_name);
        found = prodByName.find(p => p.id === pref.rewe_product_id);
      }

      if (found) {
        // Gemerktes Produkt ist noch verfügbar → mit aktuellem Preis verwenden
        const packagesNeeded = calculatePackagesNeeded(item.amount, item.unit, found.parsedAmount, found.parsedUnit, found.parsedPieceCount);
        match = {
          product: found,
          neededAmount: item.amount,
          unit: item.unit,
          packagesNeeded,
          totalPrice: found.price ? found.price * packagesNeeded : null,
          fromPreference: true,
        };
        fromPreference = true;
        matchedCount++;

        // Preis in Präferenz-Tabelle aktualisieren (falls sich etwas geändert hat)
        if (found.price !== pref.rewe_price && onPriceUpdate) {
          onPriceUpdate(pref.rewe_product_id, item.name, found.price, found.packageSize);
        }

        const priceChange = found.price !== pref.rewe_price
          ? ` (Preis: ${formatPrice(pref.rewe_price)} → ${formatPrice(found.price)})`
          : '';
        const qtyInfo = packagesNeeded > 1 ? ` [${packagesNeeded}×]` : '';
        console.log(`  ★ ${item.name} → ${found.name} (gemerkt${priceChange})${qtyInfo}`);
      } else {
        // Produkt nicht mehr verfügbar → Fallback auf normales Scoring
        console.log(`  ⚠ ${item.name}: Gemerktes Produkt "${pref.rewe_product_name}" nicht mehr verfügbar → suche Alternative…`);
        match = await findBestProduct(item.name, item.amount, item.unit);
        if (match) {
          matchedCount++;
          const qtyInfo = match.packagesNeeded > 1 ? ` [${match.packagesNeeded}×]` : '';
          console.log(`  ✓ ${item.name} → ${match.product.name} (${match.product.priceFormatted || '?'}) [Ersatz]${qtyInfo}`);
        } else {
          console.log(`  ✗ ${item.name} → kein Treffer`);
        }
      }
    } else {
      // 2. Kein gespeichertes Produkt → REWE API abfragen
      match = await findBestProduct(item.name, item.amount, item.unit);

      if (match) {
        matchedCount++;
        const qtyInfo = match.packagesNeeded > 1 ? ` [${match.packagesNeeded}×]` : '';
        console.log(`  ✓ ${item.name} → ${match.product.name} (${match.product.priceFormatted || '?'})${qtyInfo}`);
      } else {
        console.log(`  ✗ ${item.name} → kein Treffer`);
      }
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
        packagesNeeded: match?.packagesNeeded || null,
        fromPreference,
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

  const prefCount = results.filter(r => r.reweMatch?.fromPreference).length;
  const apiCount = matchedCount - prefCount;
  console.log(`REWE-Matching fertig: ${matchedCount}/${results.length} zugeordnet (${prefCount} gemerkte Produkte, ${apiCount} neu gematcht)`);

  return results;
}
