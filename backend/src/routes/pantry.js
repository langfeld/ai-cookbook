/**
 * ============================================
 * Vorratsschrank-Routen
 * ============================================
 * Verwaltung des "Vorratsschranks" - was haben wir noch da?
 * Überschüsse vom Einkauf werden hier automatisch eingetragen.
 */

import db from '../config/database.js';
import { getWeekStart, scaleIngredient, convertToBaseUnit, normalizeUnit, unitsCompatible } from '../utils/helpers.js';

/**
 * CSV- oder JSON-Import-Daten parsen
 */
function parseImportData(text, filename = '') {
  // BOM entfernen
  const clean = text.replace(/^\uFEFF/, '').trim();

  // JSON probieren
  if (clean.startsWith('{') || clean.startsWith('[')) {
    try {
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.items && Array.isArray(parsed.items)) return parsed.items;
      return null;
    } catch { /* kein JSON */ }
  }

  // CSV parsen (Semikolon oder Komma)
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());

  // Header-Mapping
  const nameIdx = headers.findIndex(h => ['zutat', 'ingredient_name', 'name', 'artikel'].includes(h));
  const amountIdx = headers.findIndex(h => ['menge', 'amount', 'anzahl'].includes(h));
  const unitIdx = headers.findIndex(h => ['einheit', 'unit'].includes(h));
  const catIdx = headers.findIndex(h => ['kategorie', 'category'].includes(h));
  const expiryIdx = headers.findIndex(h => ['mhd', 'expiry_date', 'ablaufdatum', 'haltbar'].includes(h));
  const notesIdx = headers.findIndex(h => ['notizen', 'notes', 'bemerkung'].includes(h));
  const permanentIdx = headers.findIndex(h => ['dauerhaft', 'is_permanent', 'permanent'].includes(h));

  if (nameIdx === -1) return null;

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const name = cols[nameIdx]?.trim();
    if (!name) continue;
    items.push({
      ingredient_name: name,
      amount: parseFloat(cols[amountIdx]) || 1,
      unit: cols[unitIdx]?.trim() || 'Stk',
      category: cols[catIdx]?.trim() || 'Sonstiges',
      expiry_date: cols[expiryIdx]?.trim() || null,
      notes: cols[notesIdx]?.trim() || null,
      is_permanent: permanentIdx >= 0 && ['ja', 'yes', '1', 'true'].includes((cols[permanentIdx] || '').trim().toLowerCase()),
    });
  }
  return items;
}

/** CSV-Zeile parsen (berücksichtigt Anführungszeichen) */
function parseCsvLine(line, delimiter = ';') {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === delimiter) { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

/**
 * Meal-Type Sortierungswert (chronologische Reihenfolge)
 */
const MEAL_TYPE_ORDER = { fruehstueck: 0, mittag: 1, abendessen: 2, snack: 3 };

/**
 * Wochentag-Label (Montag = 0)
 */
const DAY_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

/**
 * Meal-Type Label
 */
const MEAL_TYPE_LABELS = { fruehstueck: 'Frühstück', mittag: 'Mittagessen', abendessen: 'Abendessen', snack: 'Snack' };

export default async function pantryRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  /**
   * GET /api/pantry/recipe-view
   * Vorräte nach Rezepten (aktiver Wochenplan) gruppiert
   */
  fastify.get('/recipe-view', {
    schema: {
      description: 'Vorräte nach Rezepten des Wochenplans gruppiert',
      tags: ['Vorratsschrank'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          weekStart: { type: 'string', description: 'Montag der gewünschten Woche (YYYY-MM-DD)' },
        },
      },
    },
  }, async (request) => {
    const userId = request.user.id;
    const weekStart = request.query.weekStart || getWeekStart();

    // 1. Wochenplan laden
    const plan = db.prepare(
      'SELECT id FROM meal_plans WHERE user_id = ? AND week_start = ?'
    ).get(userId, weekStart);

    // 2. Alle Pantry-Items laden
    const pantryItems = db.prepare(
      'SELECT * FROM pantry WHERE user_id = ? AND (amount > 0 OR is_permanent = 1) ORDER BY category, ingredient_name'
    ).all(userId);

    // 3. Verfügbare Wochen mit Rezepten laden
    const availableWeeks = db.prepare(`
      SELECT mp.week_start,
             COUNT(mpe.id) as meal_count,
             mp.is_locked
      FROM meal_plans mp
      JOIN meal_plan_entries mpe ON mpe.meal_plan_id = mp.id
      WHERE mp.user_id = ?
      GROUP BY mp.id
      HAVING meal_count > 0
      ORDER BY mp.week_start DESC
      LIMIT 20
    `).all(userId);

    // Kein Plan → nur unassigned zurückgeben
    if (!plan) {
      return {
        recipes: [],
        unassigned: pantryItems.map(item => ({ ...item, remaining_amount: item.amount })),
        weekStart,
        availableWeeks,
      };
    }

    // 4. Ungekochte Einträge laden (mit Rezept-Infos)
    const entries = db.prepare(`
      SELECT mpe.id as entry_id, mpe.recipe_id, mpe.day_of_week, mpe.meal_type, mpe.servings as planned_servings,
             r.title as recipe_title, r.image_url as recipe_image_url, r.servings as original_servings
      FROM meal_plan_entries mpe
      JOIN recipes r ON r.id = mpe.recipe_id
      WHERE mpe.meal_plan_id = ? AND mpe.is_cooked = 0
      ORDER BY mpe.day_of_week, mpe.meal_type
    `).all(plan.id);

    // 5. Zutaten für alle Rezepte laden
    const recipeIds = [...new Set(entries.map(e => e.recipe_id))];
    let allIngredients = [];
    if (recipeIds.length) {
      const placeholders = recipeIds.map(() => '?').join(',');
      allIngredients = db.prepare(
        `SELECT * FROM ingredients WHERE recipe_id IN (${placeholders}) AND is_optional = 0 ORDER BY recipe_id, group_name, sort_order`
      ).all(...recipeIds);
    }

    // Index: recipe_id → ingredients[]
    const ingredientsByRecipe = {};
    for (const ing of allIngredients) {
      if (!ingredientsByRecipe[ing.recipe_id]) ingredientsByRecipe[ing.recipe_id] = [];
      ingredientsByRecipe[ing.recipe_id].push(ing);
    }

    // 5b. Alias-Tabelle laden: alias_name → canonical_name
    const aliasRows = db.prepare(
      'SELECT alias_name, canonical_name FROM ingredient_aliases WHERE user_id = ?'
    ).all(userId);
    const aliasMap = new Map();
    for (const row of aliasRows) {
      aliasMap.set(row.alias_name.toLowerCase(), row.canonical_name.toLowerCase());
    }

    /** Zutatname über Alias-Map auflösen */
    function resolveAlias(name) {
      return aliasMap.get(name.toLowerCase()) || name.toLowerCase();
    }

    // 5c. Gesperrte Zutaten laden
    const blockedRows = db.prepare(
      'SELECT ingredient_name FROM blocked_ingredients WHERE user_id = ?'
    ).all(userId);
    const blockedSet = new Set(blockedRows.map(r => r.ingredient_name.toLowerCase()));

    // 5d. Zutat-spezifische Einheiten-Konvertierungen laden
    const convRows = db.prepare(
      'SELECT ingredient_name, from_unit, to_amount, to_unit FROM ingredient_conversions WHERE user_id = ?'
    ).all(userId);
    // Map: resolvedName → normalizedFromUnit → { to_amount, to_unit (normalized) }
    const conversionMap = {};
    for (const c of convRows) {
      const ingKey = resolveAlias(c.ingredient_name);
      const fromUnit = (normalizeUnit(c.from_unit) || c.from_unit).toLowerCase();
      if (!conversionMap[ingKey]) conversionMap[ingKey] = {};
      conversionMap[ingKey][fromUnit] = {
        to_amount: c.to_amount,
        to_unit: normalizeUnit(c.to_unit) || c.to_unit,
      };
    }

    /** Prüft ob eine Zutat (oder ihr Alias) gesperrt ist */
    function isBlocked(name) {
      const resolved = resolveAlias(name);
      return blockedSet.has(name.toLowerCase()) || blockedSet.has(resolved);
    }

    // 6. Verfügbaren Vorrat als Pool aufbauen (case-insensitive key → { pantry_id, amount, unit, ... })
    const pantryPool = {};
    for (const item of pantryItems) {
      const key = resolveAlias(item.ingredient_name);
      // In Basiseinheit konvertieren für den Pool
      const base = convertToBaseUnit(item.amount, item.unit);
      pantryPool[key] = {
        pantry_id: item.id,
        original_amount: item.amount,
        original_unit: item.unit,
        base_amount: item.is_permanent ? Infinity : base.amount,
        base_unit: base.unit,
        remaining: item.is_permanent ? Infinity : base.amount,
        is_permanent: item.is_permanent,
        category: item.category,
        expiry_date: item.expiry_date,
        notes: item.notes,
        ingredient_name: item.ingredient_name,
      };
    }

    // 7. Entries chronologisch durchlaufen, Zutaten allozieren
    const sortedEntries = entries.sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
      return (MEAL_TYPE_ORDER[a.meal_type] ?? 99) - (MEAL_TYPE_ORDER[b.meal_type] ?? 99);
    });

    const recipeResults = [];

    for (const entry of sortedEntries) {
      const recipeIngredients = ingredientsByRecipe[entry.recipe_id] || [];
      const ingredientResults = [];

      for (const ing of recipeIngredients) {
        // Gesperrte Zutat?
        if (isBlocked(ing.name)) {
          ingredientResults.push({
            name: ing.name,
            needed_amount: scaleIngredient(ing.amount, entry.original_servings, entry.planned_servings) || 0,
            needed_unit: ing.unit || '',
            is_blocked: true,
            is_covered: false,
            is_partial: false,
            is_missing: false,
            is_permanent: false,
            unit_mismatch: false,
          });
          continue;
        }

        // Skalieren
        const scaledAmount = scaleIngredient(ing.amount, entry.original_servings, entry.planned_servings);
        // In Basiseinheit
        const base = convertToBaseUnit(scaledAmount || 0, ing.unit);
        let neededAmount = base.amount;
        const neededUnit = base.unit;

        // Pantry-Match suchen (mit Alias-Auflösung)
        const key = resolveAlias(ing.name);
        const pool = pantryPool[key];

        let covered = 0;
        let pantryId = null;
        let compatible = false;
        let unitMismatch = false;

        if (pool) {
          // Einheitenkompatibilität prüfen
          const compat = unitsCompatible(neededUnit, pool.base_unit);
          if (compat.compatible) {
            compatible = true;
            pantryId = pool.pantry_id;
            const available = pool.remaining;
            covered = Math.min(neededAmount, available);
            if (!pool.is_permanent) {
              pool.remaining = Math.max(0, pool.remaining - neededAmount);
            }
          } else {
            // Einheiten inkompatibel – Zutat-spezifische Konvertierung versuchen
            const conv = conversionMap[key];
            let converted = false;

            if (conv) {
              const recipeBaseUnit = neededUnit.toLowerCase();
              const pantryBaseUnit = pool.base_unit.toLowerCase();

              // Fall A: Konvertierung VON Rezept-Einheit existiert
              // z.B. Rezept=Stk, Vorrat=g, Konvertierung: 1 Stk = 80g
              const convA = conv[recipeBaseUnit];
              if (convA) {
                const convertedBase = convertToBaseUnit(neededAmount * convA.to_amount, convA.to_unit);
                if (unitsCompatible(convertedBase.unit, pool.base_unit).compatible) {
                  compatible = true;
                  converted = true;
                  pantryId = pool.pantry_id;
                  const available = pool.remaining;
                  covered = Math.min(convertedBase.amount, available);
                  if (!pool.is_permanent) {
                    pool.remaining = Math.max(0, pool.remaining - convertedBase.amount);
                  }
                  // Für korrekte is_covered-Berechnung: neededAmount auf konvertierte Menge setzen
                  neededAmount = convertedBase.amount;
                }
              }

              // Fall B: Konvertierung VON Vorrats-Einheit existiert (umgekehrt)
              // z.B. Rezept=g, Vorrat=Stk, Konvertierung: 1 Stk = 80g
              // → Rezept-Bedarf in Vorrats-Einheit umrechnen: 200g / 80 = 2.5 Stk
              if (!converted) {
                const convB = conv[pantryBaseUnit];
                if (convB) {
                  const convBTarget = convertToBaseUnit(1, convB.to_unit);
                  if (unitsCompatible(convBTarget.unit, neededUnit).compatible) {
                    // Konvertierung der to_unit passt zur Rezept-Einheit
                    // Rezept-Bedarf als Vorrats-Einheit ausdrücken
                    const convBBase = convertToBaseUnit(convB.to_amount, convB.to_unit);
                    const neededInPantryUnit = neededAmount / convBBase.amount;
                    compatible = true;
                    converted = true;
                    pantryId = pool.pantry_id;
                    const available = pool.remaining;
                    covered = Math.min(neededInPantryUnit, available);
                    if (!pool.is_permanent) {
                      pool.remaining = Math.max(0, pool.remaining - neededInPantryUnit);
                    }
                    neededAmount = neededInPantryUnit;
                  }
                }
              }
            }

            if (!converted) {
              // Keine Konvertierung möglich → als Unit-Mismatch markieren
              unitMismatch = true;
              pantryId = pool.pantry_id;
            }
          }
        }

        ingredientResults.push({
          name: ing.name,
          needed_amount: scaledAmount || 0,
          needed_unit: ing.unit || '',
          needed_base_amount: neededAmount,
          needed_base_unit: neededUnit,
          covered_base_amount: covered,
          pantry_id: pantryId,
          is_covered: (compatible && covered >= neededAmount) || unitMismatch,
          is_partial: compatible && covered > 0 && covered < neededAmount,
          is_missing: !compatible && !unitMismatch || (compatible && covered === 0),
          is_permanent: pool?.is_permanent || false,
          unit_mismatch: unitMismatch,
          pantry_amount: unitMismatch ? pool?.original_amount : undefined,
          pantry_unit: unitMismatch ? pool?.original_unit : undefined,
        });
      }

      recipeResults.push({
        entry_id: entry.entry_id,
        recipe_id: entry.recipe_id,
        recipe_title: entry.recipe_title,
        recipe_image_url: entry.recipe_image_url,
        day_of_week: entry.day_of_week,
        day_label: DAY_LABELS[entry.day_of_week] || `Tag ${entry.day_of_week}`,
        meal_type: entry.meal_type,
        meal_type_label: MEAL_TYPE_LABELS[entry.meal_type] || entry.meal_type,
        servings: entry.planned_servings,
        ingredients: ingredientResults,
      });
    }

    // 8. Unassigned: Pantry-Items mit Restmengen
    const unassigned = [];
    for (const item of pantryItems) {
      const key = resolveAlias(item.ingredient_name);
      const pool = pantryPool[key];
      if (!pool) continue;

      if (pool.is_permanent) {
        // Permanente Items immer als "unassigned" mit der Original-Menge zeigen
        unassigned.push({ ...item, remaining_amount: item.amount });
      } else if (pool.remaining > 0) {
        // Zurückrechnen von Basiseinheit → Originaleinheit
        const origBase = convertToBaseUnit(item.amount, item.unit);
        const ratio = origBase.amount > 0 ? pool.remaining / origBase.amount : 0;
        const remainingInOriginal = Math.round(item.amount * ratio * 100) / 100;
        if (remainingInOriginal > 0) {
          unassigned.push({ ...item, remaining_amount: remainingInOriginal });
        }
      }
    }

    return {
      recipes: recipeResults,
      unassigned,
      weekStart,
      availableWeeks,
    };
  });

  /**
   * GET /api/pantry
   * Alle Vorräte auflisten
   */
  fastify.get('/', {
    schema: {
      description: 'Vorratsschrank anzeigen',
      tags: ['Vorratsschrank'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          expiring: { type: 'boolean' }, // Nur bald ablaufende
        },
      },
    },
  }, async (request) => {
    const userId = request.user.id;
    const { category, expiring } = request.query;

    let query = 'SELECT * FROM pantry WHERE user_id = ? AND (amount > 0 OR is_permanent = 1)';
    const params = [userId];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (expiring) {
      // Items die in den nächsten 7 Tagen ablaufen
      query += ` AND expiry_date IS NOT NULL AND expiry_date <= date('now', '+7 days')`;
    }

    query += ' ORDER BY category, ingredient_name';

    const items = db.prepare(query).all(...params);

    // Kategorien für Filter
    const categories = db.prepare(
      'SELECT DISTINCT category FROM pantry WHERE user_id = ? AND (amount > 0 OR is_permanent = 1) ORDER BY category'
    ).all(userId);

    // Bald ablaufende Items zählen
    const expiringCount = db.prepare(
      `SELECT COUNT(*) as count FROM pantry WHERE user_id = ? AND (amount > 0 OR is_permanent = 1) AND expiry_date IS NOT NULL AND expiry_date <= date('now', '+7 days')`
    ).get(userId);

    return {
      items,
      categories: categories.map(c => c.category),
      expiringCount: expiringCount.count,
    };
  });

  /**
   * POST /api/pantry
   * Neuen Vorrat hinzufügen
   */
  fastify.post('/', {
    schema: {
      description: 'Vorrat hinzufügen',
      tags: ['Vorratsschrank'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['ingredient_name', 'amount'],
        properties: {
          ingredient_name: { type: 'string' },
          amount: { type: 'number', minimum: 0 },
          unit: { type: 'string' },
          category: { type: 'string' },
          expiry_date: { type: 'string', format: 'date' },
          notes: { type: 'string' },
          is_permanent: { type: 'integer', enum: [0, 1] },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { ingredient_name, amount, unit, category, expiry_date, notes, is_permanent } = request.body;

    // Prüfen ob Zutat schon existiert -> Menge addieren
    const existing = db.prepare(
      'SELECT * FROM pantry WHERE user_id = ? AND LOWER(ingredient_name) = LOWER(?)'
    ).get(userId, ingredient_name);

    if (existing) {
      db.prepare(
        'UPDATE pantry SET amount = amount + ?, is_permanent = COALESCE(?, is_permanent), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(amount, is_permanent ?? null, existing.id);

      return { id: existing.id, message: 'Menge aktualisiert!' };
    }

    const result = db.prepare(
      'INSERT INTO pantry (user_id, ingredient_name, amount, unit, category, expiry_date, notes, is_permanent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(userId, ingredient_name, amount, unit, category || 'Sonstiges', expiry_date, notes, is_permanent || 0);

    return reply.status(201).send({
      id: result.lastInsertRowid,
      message: 'Vorrat hinzugefügt!',
    });
  });

  /**
   * PUT /api/pantry/:id
   * Vorrat aktualisieren
   */
  fastify.put('/:id', {
    schema: { description: 'Vorrat aktualisieren', tags: ['Vorratsschrank'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const { amount, unit, category, expiry_date, notes, is_permanent } = request.body;

    const result = db.prepare(`
      UPDATE pantry SET
        amount = COALESCE(?, amount),
        unit = COALESCE(?, unit),
        category = COALESCE(?, category),
        expiry_date = COALESCE(?, expiry_date),
        notes = COALESCE(?, notes),
        is_permanent = COALESCE(?, is_permanent),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(amount, unit, category, expiry_date, notes, is_permanent ?? null, request.params.id, request.user.id);

    if (result.changes === 0) return reply.status(404).send({ error: 'Vorrat nicht gefunden' });
    return { message: 'Vorrat aktualisiert!' };
  });

  /**
   * DELETE /api/pantry/:id
   * Vorrat entfernen
   */
  fastify.delete('/:id', {
    schema: { description: 'Vorrat löschen', tags: ['Vorratsschrank'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const result = db.prepare(
      'DELETE FROM pantry WHERE id = ? AND user_id = ?'
    ).run(request.params.id, request.user.id);

    if (result.changes === 0) return reply.status(404).send({ error: 'Vorrat nicht gefunden' });
    return { message: 'Vorrat entfernt' };
  });

  /**
   * GET /api/pantry/export
   * Eigene Vorräte als JSON exportieren
   */
  fastify.get('/export', {
    schema: {
      description: 'Eigene Vorräte als JSON exportieren',
      tags: ['Vorratsschrank'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;

    const items = db.prepare(`
      SELECT * FROM pantry WHERE user_id = ?
      ORDER BY category, ingredient_name
    `).all(userId);

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'Zauberjournal',
      type: 'pantry',
      item_count: items.length,
      items: items.map(i => ({
        ingredient_name: i.ingredient_name,
        amount: i.amount,
        unit: i.unit,
        category: i.category,
        expiry_date: i.expiry_date,
        notes: i.notes,
      })),
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="vorrat-export-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  /**
   * POST /api/pantry/import
   * Vorräte aus JSON oder CSV importieren
   */
  fastify.post('/import', {
    schema: {
      description: 'Vorräte importieren (JSON oder CSV)',
      tags: ['Vorratsschrank'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    let items;

    // JSON-Body oder Multipart akzeptieren
    const contentType = request.headers['content-type'] || '';

    if (contentType.includes('multipart')) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          const text = buffer.toString('utf-8');
          items = parseImportData(text, part.filename);
        }
      }
    } else {
      // Direkt JSON-Body
      const body = request.body;
      if (body?.items && Array.isArray(body.items)) {
        items = body.items;
      } else {
        return reply.status(400).send({ error: 'Ungültiges Format. Erwartet: { items: [...] }' });
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ error: 'Keine Artikel zum Importieren gefunden.' });
    }

    if (items.length > 1000) {
      return reply.status(400).send({ error: 'Maximal 1000 Artikel pro Import erlaubt.' });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    const findExisting = db.prepare(
      'SELECT * FROM pantry WHERE user_id = ? AND LOWER(ingredient_name) = LOWER(?)'
    );
    const insertItem = db.prepare(
      'INSERT INTO pantry (user_id, ingredient_name, amount, unit, category, expiry_date, notes, is_permanent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const updateAmount = db.prepare(
      'UPDATE pantry SET amount = amount + ?, unit = COALESCE(?, unit), category = COALESCE(?, category), expiry_date = COALESCE(?, expiry_date), notes = COALESCE(?, notes), is_permanent = COALESCE(?, is_permanent), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );

    const transaction = db.transaction(() => {
      for (const item of items) {
        try {
          const name = String(item.ingredient_name || item.name || '').trim();
          if (!name) { skipped++; continue; }

          const amount = parseFloat(item.amount) || 0;
          if (amount <= 0) { skipped++; errors.push(`Übersprungen: "${name}" (ungültige Menge)`); continue; }

          const unit = String(item.unit || 'Stk').trim();
          const category = String(item.category || 'Sonstiges').trim();
          const expiry_date = item.expiry_date || null;
          const notes = item.notes || null;
          const isPermanent = item.is_permanent ? 1 : 0;

          const existing = findExisting.get(userId, name);
          if (existing) {
            updateAmount.run(amount, unit, category, expiry_date, notes, isPermanent || null, existing.id);
            updated++;
          } else {
            insertItem.run(userId, name, amount, unit, category, expiry_date, notes, isPermanent);
            imported++;
          }
        } catch (err) {
          skipped++;
          errors.push(`Fehler: "${item.ingredient_name || item.name || '?'}": ${err.message}`);
        }
      }
    });

    transaction();

    return {
      message: `${imported} neu importiert, ${updated} aktualisiert, ${skipped} übersprungen.`,
      imported,
      updated,
      skipped,
      errors: errors.length ? errors : undefined,
    };
  });

  /**
   * POST /api/pantry/batch-delete
   * Mehrere Vorräte auf einmal löschen (alle Benutzer)
   */
  fastify.post('/batch-delete', {
    schema: {
      description: 'Mehrere Vorräte löschen',
      tags: ['Vorratsschrank'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'integer' }, minItems: 1 },
        },
      },
    },
  }, async (request) => {
    const { ids } = request.body;
    const userId = request.user.id;

    // Nur Items des eigenen Benutzers löschen
    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(
      `DELETE FROM pantry WHERE id IN (${placeholders}) AND user_id = ?`
    ).run(...ids, userId);

    return {
      message: `${result.changes} Vorrat${result.changes !== 1 ? 'e' : ''} entfernt`,
      deletedCount: result.changes,
    };
  });

  /**
   * POST /api/pantry/:id/use
   * Menge aus dem Vorratsschrank verwenden/abziehen
   */
  fastify.post('/:id/use', {
    schema: {
      description: 'Menge aus Vorrat entnehmen',
      tags: ['Vorratsschrank'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: { type: 'number', minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const { amount } = request.body;
    const item = db.prepare(
      'SELECT * FROM pantry WHERE id = ? AND user_id = ?'
    ).get(request.params.id, request.user.id);

    if (!item) return reply.status(404).send({ error: 'Vorrat nicht gefunden' });

    // Permanente Items können nicht verbraucht werden
    if (item.is_permanent) {
      return reply.status(400).send({ error: 'Dauerhaft verfügbare Artikel können nicht verbraucht werden.' });
    }

    const newAmount = Math.max(0, item.amount - amount);
    db.prepare(
      'UPDATE pantry SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(newAmount, item.id);

    // Wenn Menge 0, optional löschen
    if (newAmount === 0) {
      db.prepare('DELETE FROM pantry WHERE id = ?').run(item.id);
      return { message: 'Vorrat aufgebraucht und entfernt', remaining: 0 };
    }

    return { message: 'Menge entnommen', remaining: newAmount };
  });
}
