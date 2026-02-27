/**
 * ============================================
 * Rezept-Parser Service
 * ============================================
 * Nutzt die KI, um Rezepte aus Fotos oder Text zu extrahieren.
 * Erkennt automatisch Zutaten, Kochschritte, Portionen,
 * Schwierigkeitsgrad und schlägt Kategorien vor.
 */

import { getAIProvider } from './ai/provider.js';

// ── Gemeinsamer Prompt-Block für Zutaten-Format ──
const INGREDIENT_RULES = `
- Alle Mengenangaben als Zahlen (nicht als Brüche wie ½)
- Verwende die NATÜRLICHSTE Einheit für jede Zutat:
  • Zählbare Einzelstücke (Zwiebel, Tomate, Paprika, Ei, Brötchen, Avocado, Zitrone etc.) → Menge als Stückzahl, Einheit leer lassen oder natürliche Einheit wie "Knolle", "Stange", "Kopf", "Zehe" verwenden
  • Gewürze/Kräuter → Prise, TL, EL oder Bund/Zweig je nach Zutat
  • Fleisch, Käse, Mehl, Zucker, Reis, Nudeln etc. → g oder kg
  • Flüssigkeiten (Milch, Brühe, Sahne, Öl etc.) → ml oder l
  • Verpackungseinheiten → Dose, Pkg, Becher wenn das die natürliche Einkaufseinheit ist
- KEINE erzwungene Umrechnung in Gramm bei zählbaren Zutaten!
  Richtig: { "name": "Zwiebel", "amount": 2, "unit": "" }
  Falsch: { "name": "Zwiebel", "amount": 120, "unit": "g" }
  Richtig: { "name": "Tomate", "amount": 3, "unit": "" }
  Falsch: { "name": "Tomate", "amount": 450, "unit": "g" }
  Richtig: { "name": "Burger-Brötchen", "amount": 4, "unit": "" }
  Falsch: { "name": "Burger-Brötchen", "amount": 240, "unit": "g" }
- unit darf leer sein ("") — das bedeutet implizit "Stück"
- group_name jeder Zutat MUSS exakt einem step.title entsprechen (case-sensitive), damit Zutaten dem richtigen Zubereitungsschritt zugeordnet werden. Falls eine Zutat in mehreren Schritten vorkommt, den Schritt wählen in dem sie zuerst verwendet wird.
- Erlaubte Einheiten: g, kg, ml, l, TL, EL, Bund, Dose, Becher, Pkg, Prise, Scheibe, Zehe, Knolle, Stange, Kopf, Zweig, Handvoll, Ring, Blatt, Rispe oder "" (leer = Stück)`;

const JSON_FORMAT = `{
  "title": "Rezeptname",
  "description": "Kurze Beschreibung (1-2 Sätze)",
  "servings": 4,
  "prep_time": 15,
  "cook_time": 30,
  "total_time": 45,
  "difficulty": "leicht|mittel|schwer",
  "suggested_categories": ["Mittagessen"],
  "ingredients": [
    {
      "name": "Zutatename",
      "amount": 2,
      "unit": "",
      "group_name": "Titel des Zubereitungsschritts, in dem die Zutat verwendet wird (exakt wie in steps[].title)",
      "is_optional": false,
      "notes": ""
    }
  ],
  "steps": [
    {
      "step_number": 1,
      "title": "Vorbereitung",
      "instruction": "Detaillierte Anleitung...",
      "duration_minutes": 10
    }
  ]
}`;

/**
 * Extrahiert ein komplettes Rezept aus einem oder mehreren Fotos
 * @param {Buffer|Buffer[]} imageBuffers - Ein Bild oder mehrere Bilder als Buffer(s)
 * @param {string[]} existingCategories - Vorhandene Kategorie-Namen des Users
 * @returns {Promise<object>} - Strukturiertes Rezept-Objekt
 */
export async function parseRecipeFromImage(imageBuffers, existingCategories = []) {
  const ai = getAIProvider();
  const images = Array.isArray(imageBuffers) ? imageBuffers : [imageBuffers];
  const isMultiPage = images.length > 1;

  const prompt = `
Analysiere ${isMultiPage ? 'diese Bilder eines mehrseitigen Rezepts' : 'dieses Bild eines Rezepts'} und extrahiere alle Informationen.
${isMultiPage ? 'Die Bilder gehören zum selben Rezept (z.B. Vorder-/Rückseite oder mehrere Seiten). Kombiniere alle Informationen zu EINEM vollständigen Rezept.' : ''}
Falls das Bild kein Rezept enthält, versuche trotzdem ein passendes Rezept
basierend auf dem erkannten Gericht zu erstellen.

Vorhandene Kategorien des Benutzers: ${existingCategories.join(', ') || 'Frühstück, Mittagessen, Abendessen, Snack'}

Antworte im folgenden JSON-Format:
${JSON_FORMAT}

Wichtig:
${INGREDIENT_RULES}
- Kochschritte klar unterteilt mit sinnvollen Titeln
- In den Kochschritten die Zutaten im Text erwähnen
- Schwierigkeitsgrad realistisch einschätzen
- Kategorien aus den vorhandenen Kategorien wählen (mehrere möglich)
`;

  const result = images.length > 1
    ? await ai.chatWithImagesJSON(prompt, images, { maxTokens: 16384 })
    : await ai.chatWithImageJSON(prompt, images[0], { maxTokens: 16384 });
  return result;
}

/**
 * Extrahiert ein Rezept aus einem Textbeschreibung
 * @param {string} text - Rezepttext oder -beschreibung
 * @param {string[]} existingCategories - Vorhandene Kategorie-Namen
 * @returns {Promise<object>} - Strukturiertes Rezept-Objekt
 */
export async function parseRecipeFromText(text, existingCategories = []) {
  const ai = getAIProvider();

  const prompt = `
Erstelle ein vollständiges, strukturiertes Rezept aus folgendem Text:

"${text}"

Vorhandene Kategorien: ${existingCategories.join(', ') || 'Frühstück, Mittagessen, Abendessen, Snack'}

Antworte im folgenden JSON-Format:
${JSON_FORMAT}

Wichtig:
${INGREDIENT_RULES}
- Fehlende Informationen sinnvoll ergänzen
- Realistische Mengenangaben und Zeiten
- Kochschritte klar und nachvollziehbar
`;

  const result = await ai.chatJSON(prompt, { maxTokens: 16384 });
  return result;
}

/**
 * Extrahiert die Bild-URL eines Rezepts aus dem HTML einer Webseite.
 * Priorität: JSON-LD Recipe.image > og:image > <meta name="image"> > großes <img>
 * @param {string} html - Der HTML-Quelltext
 * @param {string} pageUrl - Die URL der Seite (für relative URLs)
 * @returns {string|null} - Absolute Bild-URL oder null
 */
export function extractRecipeImageUrl(html, pageUrl) {
  // 1. JSON-LD: Recipe.image
  try {
    const jsonLdBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdBlocks) {
      for (const block of jsonLdBlocks) {
        const content = block.replace(/<\/?script[^>]*>/gi, '').trim();
        try {
          const parsed = JSON.parse(content);
          const recipe = parsed?.['@type'] === 'Recipe'
            ? parsed
            : parsed?.['@graph']?.find(i => i['@type'] === 'Recipe');
          if (recipe?.image) {
            const img = Array.isArray(recipe.image) ? recipe.image[0] : recipe.image;
            const imgUrl = typeof img === 'string' ? img : img?.url;
            if (imgUrl) return new URL(imgUrl, pageUrl).href;
          }
        } catch { /* JSON-LD parse error */ }
      }
    }
  } catch { /* regex error */ }

  // 2. Open Graph: og:image
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogMatch?.[1]) {
    try { return new URL(ogMatch[1], pageUrl).href; } catch { /* invalid URL */ }
  }

  // 3. <meta name="image">
  const metaImgMatch = html.match(/<meta[^>]*name=["']image["'][^>]*content=["']([^"']+)["']/i);
  if (metaImgMatch?.[1]) {
    try { return new URL(metaImgMatch[1], pageUrl).href; } catch { /* invalid URL */ }
  }

  return null;
}

/**
 * Extrahiert ein Rezept aus einer URL
 * Ruft die Webseite ab, extrahiert den Text-Inhalt und lässt die KI daraus ein Rezept erstellen
 * @param {string} url - Die URL der Rezeptseite
 * @param {string[]} existingCategories - Vorhandene Kategorie-Namen
 * @returns {Promise<{recipe: object, imageUrl: string|null}>} - Strukturiertes Rezept-Objekt + gefundene Bild-URL
 */
export async function parseRecipeFromUrl(url, existingCategories = []) {
  // Webseite abrufen
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Zauberjournal/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Webseite konnte nicht abgerufen werden (HTTP ${response.status})`);
  }

  const html = await response.text();

  // Rezeptbild aus der Seite extrahieren
  const imageUrl = extractRecipeImageUrl(html, url);

  // HTML zu lesbarem Text reduzieren:
  // 1. Script/Style/Nav/Footer/Header entfernen
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // 2. Strukturierte Daten (JSON-LD) extrahieren, falls vorhanden
  let jsonLd = '';
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const match of jsonLdMatch) {
      const content = match.replace(/<\/?script[^>]*>/gi, '').trim();
      try {
        const parsed = JSON.parse(content);
        // Recipe-Schema erkennen
        const isRecipe = (obj) => obj?.['@type'] === 'Recipe' || (Array.isArray(obj?.['@graph']) && obj['@graph'].some(i => i['@type'] === 'Recipe'));
        if (isRecipe(parsed)) {
          jsonLd = content;
          break;
        }
      } catch { /* Kein valides JSON-LD */ }
    }
  }

  // 3. HTML-Tags entfernen und Text bereinigen
  text = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  // Text auf vernünftige Länge begrenzen (KI-Token-Limit)
  const maxChars = 12000;
  if (text.length > maxChars) {
    text = text.substring(0, maxChars) + '…';
  }

  const ai = getAIProvider();

  const prompt = `
Extrahiere das Rezept von dieser Webseite und erstelle ein vollständiges, strukturiertes Rezept.

Quell-URL: ${url}
${jsonLd ? `\nStrukturierte Daten (JSON-LD):\n${jsonLd}\n` : ''}
Seiteninhalt:
${text}

Vorhandene Kategorien: ${existingCategories.join(', ') || 'Frühstück, Mittagessen, Abendessen, Snack'}

Antworte im folgenden JSON-Format:
${JSON_FORMAT}

Wichtig:
${INGREDIENT_RULES}
- Kochschritte klar unterteilt mit sinnvollen Titeln
- In den Kochschritten die Zutaten im Text erwähnen
- Falls die Seite kein erkennbares Rezept enthält, erstelle ein Rezept basierend auf dem Titel oder Thema der Seite
`;

  const recipe = await ai.chatJSON(prompt, { maxTokens: 16384 });
  return { recipe, imageUrl };
}

/**
 * Schlägt Kategorien für ein bestehendes Rezept vor
 * @param {object} recipe - Das Rezept (title, ingredients, etc.)
 * @param {string[]} availableCategories - Verfügbare Kategorien
 * @returns {Promise<string[]>} - Vorgeschlagene Kategorie-Namen
 */
export async function suggestCategories(recipe, availableCategories) {
  const ai = getAIProvider();

  const prompt = `
Für das Rezept "${recipe.title}" mit den Zutaten: ${recipe.ingredients?.map(i => i.name).join(', ')}

Welche der folgenden Kategorien passen? Wähle 1-3 passende Kategorien:
${availableCategories.join(', ')}

Antworte als JSON-Array mit den passenden Kategorienamen:
["Kategorie1", "Kategorie2"]
`;

  const result = await ai.chatJSON(prompt, { temperature: 0.3 });
  return Array.isArray(result) ? result : result.categories || [];
}
