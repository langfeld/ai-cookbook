/**
 * ============================================
 * Rezept-Parser Service
 * ============================================
 * Nutzt die KI, um Rezepte aus Fotos oder Text zu extrahieren.
 * Erkennt automatisch Zutaten, Kochschritte, Portionen,
 * Schwierigkeitsgrad und schlägt Kategorien vor.
 */

import { getAIProvider } from './ai/provider.js';

/**
 * Extrahiert ein komplettes Rezept aus einem oder mehreren Fotos
 * @param {Buffer|Buffer[]} imageBuffers - Ein Bild oder mehrere Bilder als Buffer(s)
 * @param {string[]} existingCategories - Vorhandene Kategorie-Namen des Users
 * @returns {Promise<object>} - Strukturiertes Rezept-Objekt
 */
export async function parseRecipeFromImage(imageBuffers, existingCategories = []) {
  const ai = getAIProvider();
  // Normalisieren: einzelner Buffer → Array
  const images = Array.isArray(imageBuffers) ? imageBuffers : [imageBuffers];
  const isMultiPage = images.length > 1;

  const prompt = `
Analysiere ${isMultiPage ? 'diese Bilder eines mehrseitigen Rezepts' : 'dieses Bild eines Rezepts'} und extrahiere alle Informationen.
${isMultiPage ? 'Die Bilder gehören zum selben Rezept (z.B. Vorder-/Rückseite oder mehrere Seiten). Kombiniere alle Informationen zu EINEM vollständigen Rezept.' : ''}
Falls das Bild kein Rezept enthält, versuche trotzdem ein passendes Rezept
basierend auf dem erkannten Gericht zu erstellen.

Vorhandene Kategorien des Benutzers: ${existingCategories.join(', ') || 'Frühstück, Mittagessen, Abendessen, Snack'}

Antworte im folgenden JSON-Format:
{
  "title": "Rezeptname",
  "description": "Kurze Beschreibung (1-2 Sätze)",
  "servings": 4,
  "prep_time": 15,
  "cook_time": 30,
  "total_time": 45,
  "difficulty": "leicht|mittel|schwer",
  "suggested_categories": ["Mittagessen", "..."],
  "ingredients": [
    {
      "name": "Zutatename",
      "amount": 500,
      "unit": "g",
      "group_name": "Für den Teig",
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
}

Wichtig:
- Alle Mengenangaben als Zahlen (nicht als Brüche)
- Einheiten standardisiert: g, kg, ml, l, TL, EL, Stk, Bund, Prise, Dose
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
{
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
      "amount": 500,
      "unit": "g",
      "group_name": null,
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
}

Wichtig:
- Fehlende Informationen sinnvoll ergänzen
- Realistische Mengenangaben und Zeiten
- Kochschritte klar und nachvollziehbar
`;

  const result = await ai.chatJSON(prompt, { maxTokens: 16384 });
  return result;
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
