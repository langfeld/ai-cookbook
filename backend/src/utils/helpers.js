/**
 * ============================================
 * Hilfsfunktionen
 * ============================================
 */

import { resolve, relative } from 'path';

/**
 * Generiert einen zufälligen String als ID
 */
export function generateId(length = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Sicher einen Dateipfad innerhalb eines Basisverzeichnisses auflösen.
 * Verhindert Path Traversal (../ Angriffe).
 * @param {string} basePath - Erlaubtes Basisverzeichnis
 * @param {string} userPath - Vom Benutzer/DB stammender Pfad
 * @returns {string|null} - Aufgelöster Pfad oder null bei Traversal-Versuch
 */
export function safePath(basePath, userPath) {
  const resolvedBase = resolve(basePath);
  const resolvedFull = resolve(basePath, userPath);
  if (!resolvedFull.startsWith(resolvedBase)) return null;
  return resolvedFull;
}

/**
 * Berechnet den Montag einer gegebenen Woche
 * @param {Date} date - Ein Datum in der gewünschten Woche
 * @returns {string} - Datum im Format YYYY-MM-DD
 */
export function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  // Sonntag (0) -> 6 Tage zurück, Montag (1) -> 0 Tage zurück, etc.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

/**
 * Formatiert eine Zutatenmenge leserlich
 * z.B. 0.5 -> "½", 1.5 -> "1½"
 */
export function formatAmount(amount) {
  if (!amount) return '';

  const fractions = {
    0.25: '¼',
    0.33: '⅓',
    0.5: '½',
    0.66: '⅔',
    0.75: '¾',
  };

  const whole = Math.floor(amount);
  const fraction = Math.round((amount - whole) * 100) / 100;

  if (fraction === 0) return whole.toString();
  if (whole === 0) return fractions[fraction] || amount.toString();
  return `${whole}${fractions[fraction] || ''}`;
}

/**
 * Normalisiert Einheiten für den Vergleich.
 * Korrigiert Tippfehler/Plural, behält aber natürliche Einheiten bei.
 * Leerer String ("") bedeutet implizit "Stück".
 */
export function normalizeUnit(unit) {
  if (!unit) return '';

  // Trailing-Punkt entfernen (z.B. "Verp." → "Verp") und trimmen
  const cleaned = unit.trim().replace(/\.$/, '');
  if (!cleaned) return '';

  const unitMap = {
    // Gewicht
    gramm: 'g', gram: 'g', gr: 'g',
    kilogramm: 'kg', kilogram: 'kg',
    // Volumen
    milliliter: 'ml',
    liter: 'l',
    // Löffel
    teelöffel: 'TL', 'tl': 'TL',
    esslöffel: 'EL', 'el': 'EL',
    // Stück — nur explizite Stück-Synonyme auf "" (leer = Stück) normalisieren
    stück: '', stueck: '', stk: '', st: '',
    // Natürliche Zähleinheiten bleiben erhalten
    kopf: 'Kopf', köpfe: 'Kopf',
    knolle: 'Knolle', knollen: 'Knolle',
    stange: 'Stange', stangen: 'Stange',
    zweig: 'Zweig', zweige: 'Zweig',
    blatt: 'Blatt', blätter: 'Blatt',
    rispe: 'Rispe', rispen: 'Rispe',
    ring: 'Ring', ringe: 'Ring',
    handvoll: 'Handvoll',
    // Verpackungseinheiten
    packung: 'Pkg', pkg: 'Pkg', pack: 'Pkg', päckchen: 'Pkg',
    verp: 'Pkg', verpackung: 'Pkg', verpackungen: 'Pkg',
    // Andere zählbare Einheiten
    bund: 'Bund',
    dose: 'Dose', dosen: 'Dose',
    becher: 'Becher',
    prise: 'Prise', prisen: 'Prise',
    scheibe: 'Scheibe', scheiben: 'Scheibe',
    zehe: 'Zehe', zehen: 'Zehe',
  };

  return unitMap[cleaned.toLowerCase()] ?? cleaned;
}

/**
 * Konvertiert Mengen in eine einheitliche Basis für einfache Fälle.
 * Nur für kg→g und l→ml. Keine erzwungene Konvertierung von EL/TL.
 * Wird intern als Hilfsfunktion verwendet (nicht mehr für Einkaufslisten-Aggregation).
 */
export function convertToBaseUnit(amount, unit) {
  const conversions = {
    kg: { base: 'g', factor: 1000 },
    l: { base: 'ml', factor: 1000 },
  };

  const normalized = normalizeUnit(unit);
  if (conversions[normalized]) {
    return {
      amount: amount * conversions[normalized].factor,
      unit: conversions[normalized].base,
    };
  }

  return { amount, unit: normalized };
}

/**
 * Bestimmt den Einheitentyp: 'weight', 'volume' oder 'counting'
 */
export function getUnitType(unit) {
  const normalized = normalizeUnit(unit);
  if (['g', 'kg'].includes(normalized)) return 'weight';
  if (['ml', 'l'].includes(normalized)) return 'volume';
  if (['EL', 'TL'].includes(normalized)) return 'spoon';
  return 'counting';
}

/**
 * Prüft ob zwei Einheiten einfach kompatibel sind (identisch oder g↔ml).
 * Wird nur noch als schneller Check verwendet; die KI übernimmt komplexe Fälle.
 */
export function unitsCompatible(unitA, unitB) {
  if (unitA === unitB) return { compatible: true, factor: 1 };
  if ((unitA === 'g' && unitB === 'ml') || (unitA === 'ml' && unitB === 'g')) {
    return { compatible: true, factor: 1 };
  }
  return { compatible: false, factor: 0 };
}

/**
 * Berechnet die Zutatenmenge für eine andere Portionszahl
 */
export function scaleIngredient(amount, originalServings, targetServings) {
  if (!amount || !originalServings) return amount;
  return Math.round((amount / originalServings) * targetServings * 100) / 100;
}
