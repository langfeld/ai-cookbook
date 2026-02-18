/**
 * ============================================
 * Vorratsschrank-Routen
 * ============================================
 * Verwaltung des "Vorratsschranks" - was haben wir noch da?
 * Überschüsse vom Einkauf werden hier automatisch eingetragen.
 */

import db from '../config/database.js';

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
      unit: cols[unitIdx]?.trim() || 'Stk.',
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

export default async function pantryRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

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

          const unit = String(item.unit || 'Stk.').trim();
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
