/**
 * Formatiert numerische Mengen mit Unicode-Brüchen.
 *
 * Beispiele:
 *   0.5  → "½"
 *   1.25 → "1¼"
 *   2    → "2"
 *   0.33 → "⅓"
 *   2.75 → "2¾"
 */
export function formatAmount(amount) {
  if (!amount) return '';

  const whole = Math.floor(amount);
  const frac = amount - whole;

  const fractions = [
    [0.125, '⅛'], [0.2, '⅕'], [0.25, '¼'], [0.33, '⅓'],
    [0.375, '⅜'], [0.5, '½'], [0.6, '⅗'],
    [0.625, '⅝'], [0.67, '⅔'], [0.75, '¾'], [0.8, '⅘'],
    [0.875, '⅞'],
  ];

  for (const [val, sym] of fractions) {
    if (Math.abs(frac - val) < 0.06) {
      return whole > 0 ? `${whole}${sym}` : sym;
    }
  }

  // Kein passender Bruch → gerundete Dezimalzahl
  return String(Math.round(amount * 100) / 100);
}
