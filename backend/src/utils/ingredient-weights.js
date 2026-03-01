/**
 * ============================================
 * Küchenstandard-Gewichte für Zutaten
 * ============================================
 *
 * Statische Referenztabelle mit Durchschnittsgewichten
 * und Einheiten-Konvertierungen für häufige Zutaten.
 *
 * Wird verwendet, um Einheiten-Mismatches zwischen Pantry (g/kg/ml)
 * und Rezepten (Stück/Zehe/Bund/...) aufzulösen – z.B.:
 *   - Rezept: 5 Zehe Knoblauch → Pantry: 1 Stück (Knolle)
 *   - Rezept: 2 Zwiebeln → Pantry: 1000 g
 *
 * Quellen: Standardwerte aus Kochbüchern und Nährwerttabellen.
 * Die Werte sind Annäherungen – für den Vorratsabgleich völlig ausreichend.
 *
 * Aufbau pro Zutat:
 *   - piece_g: Gewicht eines Stücks in Gramm (Stück/"" ↔ g)
 *   - subunit: Wenn die Zutat Untereinheiten hat (z.B. Zehe bei Knoblauch)
 *     - unit: Name der Untereinheit (muss mit normalizeUnit() übereinstimmen)
 *     - per_piece: Anzahl Untereinheiten pro Stück
 *     - g: Gewicht einer Untereinheit in Gramm
 */

// ─────────────────────────────────────────────
// Zutat → Standardgewichte
// ─────────────────────────────────────────────

const INGREDIENT_WEIGHTS = {
  // ── Gemüse ──
  'zwiebel':          { piece_g: 150 },
  'zwiebel rot':      { piece_g: 150 },
  'zwiebel weiß':     { piece_g: 150 },
  'rote zwiebel':     { piece_g: 150 },
  'weiße zwiebel':    { piece_g: 150 },
  'schalotte':        { piece_g: 30 },
  'frühlingszwiebel': { piece_g: 15,  subunit: { unit: 'Bund', per_piece: 8, g: 120 } },
  'lauchzwiebel':     { piece_g: 15,  subunit: { unit: 'Bund', per_piece: 8, g: 120 } },
  'knoblauch':        { piece_g: 50,  subunit: { unit: 'Zehe', per_piece: 10, g: 5 } },
  'knoblauchzehe':    { piece_g: 5 },
  'kartoffel':        { piece_g: 170 },
  'kartoffeln':       { piece_g: 170 },
  'süßkartoffel':     { piece_g: 250 },
  'karotte':          { piece_g: 80 },
  'möhre':            { piece_g: 80 },
  'tomate':           { piece_g: 130 },
  'kirschtomate':     { piece_g: 15 },
  'cocktailtomate':   { piece_g: 20 },
  'paprika':          { piece_g: 180 },
  'paprika rot':      { piece_g: 180 },
  'paprika gelb':     { piece_g: 180 },
  'paprika grün':     { piece_g: 180 },
  'zucchini':         { piece_g: 250 },
  'gurke':            { piece_g: 400 },
  'aubergine':        { piece_g: 300 },
  'avocado':          { piece_g: 200 },  // ohne Kern/Schale ~ 150g, mit ~ 200g
  'sellerie':         { piece_g: 400 },  // Knolle
  'staudensellerie':  { piece_g: 40, subunit: { unit: 'Stange', per_piece: 10, g: 40 } },
  'fenchel':          { piece_g: 300 },
  'kohlrabi':         { piece_g: 350 },
  'brokkoli':         { piece_g: 400 },
  'blumenkohl':       { piece_g: 800 },
  'champignon':       { piece_g: 20 },
  'champignons':      { piece_g: 20 },
  'pilz':             { piece_g: 20 },
  'lauch':            { piece_g: 200, subunit: { unit: 'Stange', per_piece: 1, g: 200 } },
  'porree':           { piece_g: 200, subunit: { unit: 'Stange', per_piece: 1, g: 200 } },
  'mais':             { piece_g: 250 }, // Kolben
  'maiskolben':       { piece_g: 250 },


  // ── Blattgemüse & Kräuter (Bund) ──
  'petersilie':       { piece_g: 5, subunit: { unit: 'Bund', per_piece: 10, g: 50 } },
  'basilikum':        { piece_g: 2, subunit: { unit: 'Bund', per_piece: 20, g: 40 } },
  'schnittlauch':     { piece_g: 3, subunit: { unit: 'Bund', per_piece: 15, g: 45 } },
  'koriander':        { piece_g: 2, subunit: { unit: 'Bund', per_piece: 20, g: 40 } },
  'dill':             { piece_g: 2, subunit: { unit: 'Bund', per_piece: 15, g: 30 } },
  'minze':            { piece_g: 2, subunit: { unit: 'Bund', per_piece: 15, g: 30 } },
  'rosmarin':         { piece_g: 3, subunit: { unit: 'Zweig', per_piece: 8, g: 3 } },
  'thymian':          { piece_g: 2, subunit: { unit: 'Zweig', per_piece: 10, g: 2 } },
  'salat':            { piece_g: 350, subunit: { unit: 'Kopf', per_piece: 1, g: 350 } },
  'eisbergsalat':     { piece_g: 500, subunit: { unit: 'Kopf', per_piece: 1, g: 500 } },
  'kopfsalat':        { piece_g: 300, subunit: { unit: 'Kopf', per_piece: 1, g: 300 } },
  'spinat':           { piece_g: 30 },  // pro Handvoll

  // ── Obst ──
  'apfel':            { piece_g: 180 },
  'birne':            { piece_g: 180 },
  'banane':           { piece_g: 130 },  // ohne Schale
  'orange':           { piece_g: 200 },
  'zitrone':          { piece_g: 80, subunit: { unit: 'Scheibe', per_piece: 8, g: 10 } },
  'limette':          { piece_g: 60, subunit: { unit: 'Scheibe', per_piece: 6, g: 10 } },
  'pfirsich':         { piece_g: 150 },
  'nektarine':        { piece_g: 140 },
  'mango':            { piece_g: 300 },

  // ── Eier & Milchprodukte ──
  'ei':               { piece_g: 60 },
  'eier':             { piece_g: 60 },

  // ── Brot & Backwaren ──
  'brötchen':         { piece_g: 60 },
  'toast':            { piece_g: 25, subunit: { unit: 'Scheibe', per_piece: 1, g: 25 } },
  'brot':             { piece_g: 40, subunit: { unit: 'Scheibe', per_piece: 1, g: 40 } },

  // ── Würz-/Kochzutaten (Stückzahl-Einheiten) ──
  'ingwer':           { piece_g: 50 },   // Daumen-großes Stück
  'chili':            { piece_g: 10 },
  'chilischote':      { piece_g: 10 },
  'peperoni':         { piece_g: 15 },
  'lorbeerblatt':     { piece_g: 0.5, subunit: { unit: 'Blatt', per_piece: 1, g: 0.5 } },
};

// ─────────────────────────────────────────────
// Lookup-Funktion
// ─────────────────────────────────────────────

/**
 * Sucht die Standardgewichte für eine Zutat.
 * Versucht exakten Match, dann ohne Farb-/Größenzusätze.
 *
 * @param {string} ingredientName - Name der Zutat
 * @returns {object|null} - Gewichtsdaten oder null
 */
export function getIngredientWeight(ingredientName) {
  if (!ingredientName) return null;
  const name = ingredientName.toLowerCase().trim();

  // 1. Exakter Match
  if (INGREDIENT_WEIGHTS[name]) return INGREDIENT_WEIGHTS[name];

  // 2. Plural-Varianten: "Zwiebeln" → "Zwiebel", "Tomaten" → "Tomate"
  const singular = name
    .replace(/en$/, 'e')   // Tomaten → Tomate, Karotten → Karotte
    .replace(/n$/, '');     // Zwiebeln → Zwiebel
  if (INGREDIENT_WEIGHTS[singular]) return INGREDIENT_WEIGHTS[singular];

  // 3. Ohne Farb-/Größenzusatz: "Zwiebeln rot" → "Zwiebel"
  const words = name.split(/\s+/);
  if (words.length > 1) {
    const base = words[0];
    if (INGREDIENT_WEIGHTS[base]) return INGREDIENT_WEIGHTS[base];
    const baseSingular = base.replace(/en$/, 'e').replace(/n$/, '');
    if (INGREDIENT_WEIGHTS[baseSingular]) return INGREDIENT_WEIGHTS[baseSingular];
  }

  return null;
}

/**
 * Schätzt die Konvertierung zwischen inkompatiblen Einheiten für eine Zutat.
 *
 * Gibt einen Faktor zurück, mit dem `fromAmount` multipliziert werden muss,
 * um die Menge in der `toUnit` zu erhalten.
 *
 * Beispiele:
 *   estimateConversion('Zwiebel', '', 'g')     → { factor: 150, estimated: true }
 *   estimateConversion('Knoblauch', 'Zehe', '') → { factor: 0.1, estimated: true }
 *   estimateConversion('Knoblauch', 'Zehe', 'g') → { factor: 5, estimated: true }
 *
 * @param {string} ingredientName - Zutatname
 * @param {string} fromUnit - Ausgangseinheit (normalisiert)
 * @param {string} toUnit - Zieleinheit (normalisiert)
 * @returns {{ factor: number, estimated: true }|null} - Konvertierungsfaktor oder null
 */
export function estimateConversion(ingredientName, fromUnit, toUnit) {
  const data = getIngredientWeight(ingredientName);
  if (!data) return null;

  const from = fromUnit || '';
  const to = toUnit || '';

  // Stück (="") → Gramm/ml
  if (from === '' && (to === 'g' || to === 'ml')) {
    if (data.piece_g) return { factor: data.piece_g, estimated: true };
  }

  // Gramm/ml → Stück (="")
  if ((from === 'g' || from === 'ml') && to === '') {
    if (data.piece_g) return { factor: 1 / data.piece_g, estimated: true };
  }

  // Subunit (z.B. Zehe) → Gramm/ml
  if (data.subunit && from === data.subunit.unit && (to === 'g' || to === 'ml')) {
    return { factor: data.subunit.g, estimated: true };
  }

  // Gramm/ml → Subunit (z.B. Zehe)
  if (data.subunit && (from === 'g' || from === 'ml') && to === data.subunit.unit) {
    return { factor: 1 / data.subunit.g, estimated: true };
  }

  // Subunit → Stück (z.B. 5 Zehe Knoblauch → 0.5 Stück)
  if (data.subunit && from === data.subunit.unit && to === '') {
    return { factor: 1 / data.subunit.per_piece, estimated: true };
  }

  // Stück → Subunit (z.B. 1 Stück Knoblauch → 10 Zehen)
  if (data.subunit && from === '' && to === data.subunit.unit) {
    return { factor: data.subunit.per_piece, estimated: true };
  }

  return null;
}

export default INGREDIENT_WEIGHTS;
