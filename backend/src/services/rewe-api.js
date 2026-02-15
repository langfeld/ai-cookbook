/**
 * ============================================
 * REWE API Service
 * ============================================
 *
 * Integration mit REWE Online-Shop für:
 * - Produktsuche (Zutaten -> REWE Produkte)
 * - Preisabfrage
 * - Produktverfügbarkeit
 * - Pakungsgrößen (für Vorratsschrank-Berechnung)
 *
 * HINWEIS: REWE bietet keine offizielle API an.
 * Dieser Service nutzt die öffentlich zugängliche Web-API,
 * die auch die REWE-Website verwendet. Diese kann sich ändern.
 *
 * Für eine produktive Nutzung sollte ggf. ein Caching-Layer
 * hinzugefügt werden.
 */

import { getReweConfig } from '../config/settings.js';

const REWE_BASE_URL = 'https://mobile-api.rewe.de/api/v3';
const REWE_SEARCH_URL = 'https://mobile-api.rewe.de/products/search';

/**
 * Sucht Produkte bei REWE
 * @param {string} query - Suchbegriff (z.B. "Spaghetti 500g")
 * @param {object} options - Suchoptionen
 * @returns {Promise<object[]>} - Liste gefundener Produkte
 */
export async function searchProducts(query, options = {}) {
  const { marketId, zipCode } = getReweConfig();

  if (!marketId && !zipCode) {
    return { products: [], error: 'REWE Market-ID oder PLZ nicht konfiguriert' };
  }

  try {
    const params = new URLSearchParams({
      search: query,
      market: marketId || '',
      zipCode: zipCode || '',
      page: options.page || 1,
      limit: options.limit || 10,
    });

    const response = await fetch(`${REWE_SEARCH_URL}?${params}`, {
      headers: {
        'User-Agent': 'AI-Cookbook/1.0',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`REWE API Fehler: ${response.status}`);
      return { products: [], error: `REWE API nicht erreichbar (${response.status})` };
    }

    const data = await response.json();

    // Produkte in einheitliches Format bringen
    const products = (data.products || data._embedded?.products || []).map(product => ({
      id: product.id || product.productId,
      name: product.name || product.productName,
      price: product.price?.value || product.currentPrice || null,
      priceFormatted: formatPrice(product.price?.value || product.currentPrice),
      packageSize: product.grammage || product.packagingSize || '',
      imageUrl: product.imageUrl || product._links?.image?.href || null,
      category: product.categoryPath || '',
      available: product.available !== false,
      brand: product.brand || '',
    }));

    return { products, total: data.totalCount || products.length };
  } catch (error) {
    console.error('REWE Suche fehlgeschlagen:', error.message);
    return { products: [], error: error.message };
  }
}

/**
 * Sucht das beste REWE-Produkt für eine Zutat
 * Versucht die passendste Packungsgröße zu finden
 *
 * @param {string} ingredientName - Name der Zutat
 * @param {number} neededAmount - Benötigte Menge
 * @param {string} unit - Einheit
 * @returns {Promise<object>} - Bestes Produkt + Überschuss
 */
export async function findBestProduct(ingredientName, neededAmount, unit) {
  const { products } = await searchProducts(ingredientName);

  if (!products.length) {
    return null;
  }

  // Versuche die Packungsgröße zu parsen und die passendste zu finden
  const productsWithSize = products.map(product => {
    const parsedSize = parsePackageSize(product.packageSize);
    return {
      ...product,
      parsedAmount: parsedSize.amount,
      parsedUnit: parsedSize.unit,
    };
  });

  // Sortiere: Bevorzuge die kleinste Packung, die die Menge abdeckt
  const suitable = productsWithSize
    .filter(p => p.parsedAmount >= neededAmount || !p.parsedAmount)
    .sort((a, b) => (a.parsedAmount || Infinity) - (b.parsedAmount || Infinity));

  const best = suitable[0] || productsWithSize[0];

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
 * Parst eine REWE-Packungsgröße in Menge + Einheit
 * z.B. "500g" -> { amount: 500, unit: "g" }
 * z.B. "1l" -> { amount: 1000, unit: "ml" }
 */
function parsePackageSize(sizeStr) {
  if (!sizeStr) return { amount: null, unit: null };

  // Verschiedene Formate: "500g", "1kg", "1,5l", "250 ml", "6 Stück"
  const match = sizeStr.match(/([\d.,]+)\s*(g|kg|ml|l|stk|stück|st)/i);
  if (!match) return { amount: null, unit: null };

  let amount = parseFloat(match[1].replace(',', '.'));
  let unit = match[2].toLowerCase();

  // In Basiseinheit konvertieren
  if (unit === 'kg') {
    amount *= 1000;
    unit = 'g';
  } else if (unit === 'l') {
    amount *= 1000;
    unit = 'ml';
  }

  return { amount, unit };
}

/**
 * Formatiert einen Preis in Euro
 */
function formatPrice(price) {
  if (!price) return 'Preis unbekannt';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

/**
 * Matcht eine komplette Einkaufsliste mit REWE-Produkten
 * @param {object[]} shoppingItems - Einkaufslisten-Items
 * @returns {Promise<object[]>} - Items mit REWE-Produktvorschlägen
 */
export async function matchShoppingListWithRewe(shoppingItems) {
  const results = [];

  for (const item of shoppingItems) {
    const match = await findBestProduct(item.name, item.amount, item.unit);

    results.push({
      ...item,
      reweMatch: match,
    });

    // Kleine Pause zwischen Anfragen (Rate Limiting)
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}
