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
 * Normalisiert Einheiten für den Vergleich
 * z.B. "Gramm" -> "g", "Milliliter" -> "ml"
 */
export function normalizeUnit(unit) {
  if (!unit) return '';

  // Trailing-Punkt entfernen (z.B. "Verp." → "Verp") und trimmen
  const cleaned = unit.trim().replace(/\.$/, '');

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
    // Stück-ähnliche Einheiten → alle auf "Stk" normalisieren
    stück: 'Stk', stueck: 'Stk', stk: 'Stk', st: 'Stk',
    verp: 'Stk', verpackung: 'Stk', verpackungen: 'Stk',
    kopf: 'Stk', köpfe: 'Stk',
    knolle: 'Stk', knollen: 'Stk',
    stange: 'Stk', stangen: 'Stk',
    zweig: 'Stk', zweige: 'Stk',
    blatt: 'Stk', blätter: 'Stk',
    rispe: 'Stk', rispen: 'Stk',
    // Andere zählbare Einheiten
    bund: 'Bund',
    dose: 'Dose', dosen: 'Dose',
    becher: 'Becher',
    packung: 'Pkg', pkg: 'Pkg', pack: 'Pkg', päckchen: 'Pkg',
    prise: 'Prise', prisen: 'Prise',
    scheibe: 'Scheibe', scheiben: 'Scheibe',
    zehe: 'Zehe', zehen: 'Zehe',
  };

  return unitMap[cleaned.toLowerCase()] || unit;
}

/**
 * Konvertiert Mengen in eine einheitliche Basis für den Vergleich
 * z.B. 1 kg -> 1000 g
 */
export function convertToBaseUnit(amount, unit) {
  const conversions = {
    kg: { base: 'g', factor: 1000 },
    l: { base: 'ml', factor: 1000 },
    EL: { base: 'ml', factor: 15 },
    TL: { base: 'ml', factor: 5 },
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
 * Berechnet die Zutatenmenge für eine andere Portionszahl
 */
export function scaleIngredient(amount, originalServings, targetServings) {
  if (!amount || !originalServings) return amount;
  return Math.round((amount / originalServings) * targetServings * 100) / 100;
}
