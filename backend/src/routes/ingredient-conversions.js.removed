/**
 * ============================================
 * Einheiten-Umrechnungen (zutat-spezifisch)
 * ============================================
 * Verwaltung von Umrechnungsfaktoren zwischen Einheiten
 * pro Zutat: z.B. 1 Stk Zwiebel = 80 g, 1 EL Olivenöl = 15 ml.
 *
 * Wird verwendet, um Unit-Mismatch zwischen Pantry (g/kg)
 * und Rezepten (Stk/EL/TL) aufzulösen.
 */

import db from '../config/database.js';

export default async function ingredientConversionRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate);

  // ─────────────────────────────────────────────
  // GET / – Alle Umrechnungen des Benutzers
  // ─────────────────────────────────────────────
  fastify.get('/', async (request) => {
    const conversions = db.prepare(
      'SELECT * FROM ingredient_conversions WHERE user_id = ? ORDER BY ingredient_name, from_unit'
    ).all(request.user.id);

    return { conversions };
  });

  // ─────────────────────────────────────────────
  // POST / – Neue Umrechnung erstellen
  // ─────────────────────────────────────────────
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['ingredient_name', 'from_unit', 'to_amount', 'to_unit'],
        properties: {
          ingredient_name: { type: 'string', minLength: 1 },
          from_unit: { type: 'string', minLength: 1 },
          to_amount: { type: 'number', minimum: 0.01 },
          to_unit: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { ingredient_name, from_unit, to_amount, to_unit } = request.body;

    try {
      const result = db.prepare(
        'INSERT INTO ingredient_conversions (user_id, ingredient_name, from_unit, to_amount, to_unit) VALUES (?, ?, ?, ?, ?)'
      ).run(userId, ingredient_name.trim(), from_unit.trim(), to_amount, to_unit.trim());

      return reply.status(201).send({
        id: result.lastInsertRowid,
        ingredient_name: ingredient_name.trim(),
        from_unit: from_unit.trim(),
        to_amount,
        to_unit: to_unit.trim(),
      });
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return reply.status(409).send({
          error: `Umrechnung für "${ingredient_name}" (${from_unit}) existiert bereits.`,
        });
      }
      throw err;
    }
  });

  // ─────────────────────────────────────────────
  // POST /bulk – Mehrere Umrechnungen auf einmal speichern
  // ─────────────────────────────────────────────
  fastify.post('/bulk', {
    schema: {
      body: {
        type: 'object',
        required: ['conversions'],
        properties: {
          conversions: {
            type: 'array',
            items: {
              type: 'object',
              required: ['ingredient_name', 'from_unit', 'to_amount', 'to_unit'],
              properties: {
                ingredient_name: { type: 'string', minLength: 1 },
                from_unit: { type: 'string', minLength: 1 },
                to_amount: { type: 'number', minimum: 0.01 },
                to_unit: { type: 'string', minLength: 1 },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { conversions } = request.body;

    const upsert = db.prepare(`
      INSERT INTO ingredient_conversions (user_id, ingredient_name, from_unit, to_amount, to_unit)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, ingredient_name, from_unit) DO UPDATE SET
        to_amount = excluded.to_amount,
        to_unit = excluded.to_unit
    `);

    const transaction = db.transaction(() => {
      let created = 0;
      let updated = 0;
      for (const c of conversions) {
        const existing = db.prepare(
          'SELECT id FROM ingredient_conversions WHERE user_id = ? AND ingredient_name = ? COLLATE NOCASE AND from_unit = ? COLLATE NOCASE'
        ).get(userId, c.ingredient_name.trim(), c.from_unit.trim());

        upsert.run(userId, c.ingredient_name.trim(), c.from_unit.trim(), c.to_amount, c.to_unit.trim());

        if (existing) updated++;
        else created++;
      }
      return { created, updated };
    });

    const result = transaction();
    return reply.status(201).send(result);
  });

  // ─────────────────────────────────────────────
  // PUT /:id – Umrechnung aktualisieren
  // ─────────────────────────────────────────────
  fastify.put('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } },
      },
      body: {
        type: 'object',
        properties: {
          ingredient_name: { type: 'string', minLength: 1 },
          from_unit: { type: 'string', minLength: 1 },
          to_amount: { type: 'number', minimum: 0.01 },
          to_unit: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params;

    const existing = db.prepare(
      'SELECT * FROM ingredient_conversions WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!existing) {
      return reply.status(404).send({ error: 'Umrechnung nicht gefunden.' });
    }

    const { ingredient_name, from_unit, to_amount, to_unit } = {
      ...existing,
      ...request.body,
    };

    db.prepare(
      'UPDATE ingredient_conversions SET ingredient_name = ?, from_unit = ?, to_amount = ?, to_unit = ? WHERE id = ? AND user_id = ?'
    ).run(ingredient_name.trim(), from_unit.trim(), to_amount, to_unit.trim(), id, userId);

    return { success: true };
  });

  // ─────────────────────────────────────────────
  // GET /export – Eigene Umrechnungen exportieren
  // ─────────────────────────────────────────────
  fastify.get('/export', {
    schema: {
      description: 'Einheiten-Umrechnungen exportieren',
      tags: ['Umrechnungen'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;

    const conversions = db.prepare(
      'SELECT ingredient_name, from_unit, to_amount, to_unit FROM ingredient_conversions WHERE user_id = ? ORDER BY ingredient_name, from_unit'
    ).all(userId);

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'Zauberjournal',
      type: 'ingredient-conversions',
      conversion_count: conversions.length,
      conversions,
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="umrechnungen-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  // ─────────────────────────────────────────────
  // POST /import – Umrechnungen importieren
  // ─────────────────────────────────────────────
  fastify.post('/import', {
    schema: {
      description: 'Einheiten-Umrechnungen importieren',
      tags: ['Umrechnungen'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    let importData;

    const contentType = request.headers['content-type'] || '';
    if (contentType.includes('multipart')) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          try {
            importData = JSON.parse(buffer.toString('utf-8'));
          } catch {
            return reply.status(400).send({ error: 'Ungültiges JSON-Format in der Datei.' });
          }
        }
      }
    } else {
      importData = request.body;
    }

    if (!importData || !Array.isArray(importData.conversions) || importData.conversions.length === 0) {
      return reply.status(400).send({ error: 'Ungültiges Export-Format. Erwartet: { conversions: [...] }' });
    }

    if (importData.conversions.length > 5000) {
      return reply.status(400).send({ error: 'Maximal 5000 Umrechnungen pro Import erlaubt.' });
    }

    let imported = 0, updated = 0, skipped = 0;

    const upsert = db.prepare(`
      INSERT INTO ingredient_conversions (user_id, ingredient_name, from_unit, to_amount, to_unit)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, ingredient_name, from_unit) DO UPDATE SET
        to_amount = excluded.to_amount,
        to_unit = excluded.to_unit
    `);

    const findExisting = db.prepare(
      'SELECT id FROM ingredient_conversions WHERE user_id = ? AND LOWER(ingredient_name) = LOWER(?) AND LOWER(from_unit) = LOWER(?)'
    );

    const transaction = db.transaction(() => {
      for (const c of importData.conversions) {
        try {
          const name = String(c.ingredient_name || '').trim();
          const fromUnit = String(c.from_unit || '').trim();
          const toAmount = Number(c.to_amount);
          const toUnit = String(c.to_unit || '').trim();

          if (!name || !fromUnit || !toAmount || toAmount <= 0 || !toUnit) { skipped++; continue; }

          const existing = findExisting.get(userId, name, fromUnit);
          upsert.run(userId, name, fromUnit, toAmount, toUnit);
          if (existing) { updated++; } else { imported++; }
        } catch {
          skipped++;
        }
      }
    });

    transaction();

    return {
      message: `${imported} neu, ${updated} aktualisiert, ${skipped} übersprungen.`,
      imported,
      updated,
      skipped,
    };
  });

  // ─────────────────────────────────────────────
  // DELETE /:id – Umrechnung löschen
  // ─────────────────────────────────────────────
  fastify.delete('/:id', async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params;

    const result = db.prepare(
      'DELETE FROM ingredient_conversions WHERE id = ? AND user_id = ?'
    ).run(id, userId);

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Umrechnung nicht gefunden.' });
    }

    return { success: true };
  });

  // ─────────────────────────────────────────────
  // POST /generate – AI-generierte Umrechnungen
  // ─────────────────────────────────────────────
  fastify.post('/generate', {
    schema: {
      body: { type: 'object', properties: {}, additionalProperties: false },
    },
  }, async (request, reply) => {
    const userId = request.user.id;

    // 1. Alle Zutaten aus Rezepten laden, die "problematische" Einheiten verwenden
    const problematicUnits = ['stk', 'el', 'tl', 'bund', 'zehe', 'scheibe', 'dose', 'becher', 'pkg', 'prise'];

    const ingredients = db.prepare(`
      SELECT DISTINCT i.name, i.unit
      FROM ingredients i
      JOIN recipes r ON r.id = i.recipe_id
      WHERE r.user_id = ?
        AND i.unit IS NOT NULL
        AND i.unit != ''
        AND LOWER(i.unit) IN (${problematicUnits.map(() => '?').join(',')})
      ORDER BY i.name
    `).all(userId, ...problematicUnits);

    if (ingredients.length === 0) {
      return { conversions: [], message: 'Keine Zutaten mit problematischen Einheiten gefunden.' };
    }

    // 2. Bereits vorhandene Umrechnungen laden (die werden übersprungen)
    const existing = db.prepare(
      'SELECT ingredient_name, from_unit FROM ingredient_conversions WHERE user_id = ?'
    ).all(userId);
    const existingSet = new Set(existing.map(e => `${e.ingredient_name.toLowerCase()}|${e.from_unit.toLowerCase()}`));

    // Nur Zutaten, die noch KEINE Umrechnung haben
    const missing = ingredients.filter(
      i => !existingSet.has(`${i.name.toLowerCase()}|${i.unit.toLowerCase()}`)
    );

    // Duplikate entfernen (gleiche name+unit Kombination)
    const uniqueMap = new Map();
    for (const i of missing) {
      const key = `${i.name.toLowerCase()}|${i.unit.toLowerCase()}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, i);
    }
    const uniqueMissing = [...uniqueMap.values()];

    if (uniqueMissing.length === 0) {
      return { conversions: [], message: 'Alle Zutaten haben bereits Umrechnungen.' };
    }

    // 3. In Batches aufteilen (Reasoning-Modelle brauchen viele Tokens pro Zutat)
    const BATCH_SIZE = 15;
    const batches = [];
    for (let i = 0; i < uniqueMissing.length; i += BATCH_SIZE) {
      batches.push(uniqueMissing.slice(i, i + BATCH_SIZE));
    }

    const systemRules = `Regeln:
- Feste Zutaten (Gemüse, Obst, Fleisch, Käse, etc.) → Umrechnung in Gramm (g)
- Flüssige Zutaten (Öl, Milch, Sauce, etc.) → Umrechnung in Milliliter (ml)
- Pulver/Gewürze (TL, EL) → Umrechnung in Gramm (g)
- "Stk" = 1 Stück der Zutat (mittlere Größe)
- "Bund" = 1 Bund der Zutat
- "Zehe" = 1 Knoblauchzehe
- "Scheibe" = 1 Scheibe (Brot, Käse, etc.)
- "Dose" = 1 Standarddose (400g/400ml)
- "Becher" = 1 Standardbecher (150g Joghurt, 200ml Sahne)
- "Pkg" = 1 Standardpackung
- "Prise" = eine Prise (ca. 0.3-0.5g)
- "EL" = 1 Esslöffel
- "TL" = 1 Teelöffel
- Schätze realistische Durchschnittswerte`;

    try {
      const { getAIProvider } = await import('../services/ai/provider.js');
      const ai = getAIProvider({ simple: true });
      const allResults = [];

      for (const batch of batches) {
        // Jede Zutat+Einheit als nummerierte Zeile — damit die KI pro Zeile genau 1 Ergebnis liefert
        const ingredientList = batch
          .map((i, idx) => `${idx + 1}. "${i.name}" – 1 ${i.unit} = ? g/ml`)
          .join('\n');

        const prompt = `Gib für JEDE der folgenden ${batch.length} Zeilen an, wie viel Gramm (g) oder Milliliter (ml) die angegebene Einheit entspricht.
WICHTIG: Eine Zutat kann mit VERSCHIEDENEN Einheiten aufgelistet sein (z.B. Salz mit TL und Salz mit Prise). Jede Zeile braucht eine EIGENE Umrechnung im Ergebnis – liefere genau ${batch.length} Ergebnis-Elemente!

${systemRules}

${ingredientList}

Antworte AUSSCHLIESSLICH mit einem JSON-Array mit genau ${batch.length} Elementen (beginnt mit [ und endet mit ]).
Jedes Element hat genau diese 4 Felder: ingredient_name, from_unit, to_amount, to_unit.
Die Reihenfolge muss der Eingabe entsprechen.
Beispiel: [{"ingredient_name":"Zwiebel","from_unit":"Stk","to_amount":80,"to_unit":"g"},{"ingredient_name":"Olivenöl","from_unit":"EL","to_amount":15,"to_unit":"ml"}]`;

        try {
          const result = await ai.chatJSON(prompt, { temperature: 0.3, maxTokens: 4096 });

          // Ergebnis normalisieren – AI liefert verschiedene Formate:
          // 1. Direkt ein Array → ideal
          // 2. Einzelnes Objekt mit den 4 Feldern → in Array wrappen
          // 3. Objekt mit einer Array-Property (z.B. { conversions: [...] })
          // 4. Objekt mit Zutatennamen als Keys (z.B. { "Zwiebel": { to_amount: 80, ... } })
          let items = [];
          if (Array.isArray(result)) {
            items = result;
          } else if (result && typeof result === 'object') {
            // Prüfe auf einzelnes Konversions-Objekt
            if (result.ingredient_name && result.to_amount) {
              items = [result];
            } else {
              // Suche nach Array-Property
              const arrayVal = Object.values(result).find(v => Array.isArray(v));
              if (arrayVal) {
                items = arrayVal;
              } else {
                // Zutatennamen als Keys: { "Zwiebel": { from_unit, to_amount, to_unit } }
                for (const [key, val] of Object.entries(result)) {
                  if (val && typeof val === 'object' && val.to_amount) {
                    items.push({
                      ingredient_name: val.ingredient_name || key,
                      from_unit: val.from_unit || batch.find(b => b.name.toLowerCase() === key.toLowerCase())?.unit || '?',
                      to_amount: val.to_amount,
                      to_unit: val.to_unit || 'g',
                    });
                  }
                }
              }
            }
          }

          if (items.length > 0) {
            allResults.push(...items);
          }
        } catch (batchErr) {
          console.warn(`[Conversions] Batch fehlgeschlagen (${batch.length} Zutaten): ${batchErr.message}`);
          // Weiter mit nächstem Batch
        }
      }

      // Validieren und filtern
      const valid = allResults.filter(r =>
        r.ingredient_name && r.from_unit && r.to_amount > 0 && r.to_unit
      );

      return {
        conversions: valid,
        total_ingredients: uniqueMissing.length,
        message: `${valid.length} Umrechnungen generiert.`,
      };
    } catch (err) {
      return reply.status(500).send({
        error: `AI-Generierung fehlgeschlagen: ${err.message}`,
      });
    }
  });
}

/**
 * Prüft nach Rezept-Erstellung, ob Zutaten mit problematischen
 * Einheiten vorhanden sind, die noch keine Umrechnung haben.
 * Generiert fehlende Umrechnungen per KI und speichert sie automatisch.
 * Läuft asynchron im Hintergrund (fire & forget).
 */
export async function autoGenerateConversions(userId, ingredients) {
  try {
    if (!ingredients?.length) return;

    const problematicUnits = ['stk', 'el', 'tl', 'bund', 'zehe', 'scheibe', 'dose', 'becher', 'pkg', 'prise'];

    // Nur Zutaten mit problematischen Einheiten
    const candidates = ingredients.filter(
      i => i.unit && problematicUnits.includes(i.unit.toLowerCase())
    );

    if (candidates.length === 0) return;

    // Bereits vorhandene Umrechnungen laden
    const existing = db.prepare(
      'SELECT ingredient_name, from_unit FROM ingredient_conversions WHERE user_id = ?'
    ).all(userId);
    const existingSet = new Set(existing.map(e => `${e.ingredient_name.toLowerCase()}|${e.from_unit.toLowerCase()}`));

    // Nur fehlende Umrechnungen
    const uniqueMap = new Map();
    for (const i of candidates) {
      const key = `${i.name.toLowerCase()}|${i.unit.toLowerCase()}`;
      if (!existingSet.has(key) && !uniqueMap.has(key)) {
        uniqueMap.set(key, { name: i.name, unit: i.unit });
      }
    }

    const missing = [...uniqueMap.values()];
    if (missing.length === 0) return;

    console.log(`⚖️ Auto-Umrechnung: ${missing.length} fehlende Umrechnungen werden generiert...`);

    const { getAIProvider } = await import('../services/ai/provider.js');
    const ai = getAIProvider({ simple: true });

    if (!ai?.apiKey) {
      console.warn('⚖️ Auto-Umrechnung übersprungen: Kein KI-Provider konfiguriert.');
      return;
    }

    const ingredientList = missing
      .map((i, idx) => `${idx + 1}. "${i.name}" – 1 ${i.unit} = ? g/ml`)
      .join('\n');

    const prompt = `Gib für JEDE der folgenden ${missing.length} Zeilen an, wie viel Gramm (g) oder Milliliter (ml) die angegebene Einheit entspricht.
WICHTIG: Eine Zutat kann mit VERSCHIEDENEN Einheiten aufgelistet sein (z.B. Salz mit TL und Salz mit Prise). Jede Zeile braucht eine EIGENE Umrechnung im Ergebnis – liefere genau ${missing.length} Ergebnis-Elemente!

Regeln:
- Feste Zutaten (Gemüse, Obst, Fleisch, Käse, etc.) → Umrechnung in Gramm (g)
- Flüssige Zutaten (Öl, Milch, Sauce, etc.) → Umrechnung in Milliliter (ml)
- Pulver/Gewürze (TL, EL) → Umrechnung in Gramm (g)
- "Stk" = 1 Stück der Zutat (mittlere Größe)
- "Bund" = 1 Bund der Zutat
- "Zehe" = 1 Knoblauchzehe
- "Scheibe" = 1 Scheibe (Brot, Käse, etc.)
- "Dose" = 1 Standarddose (400g/400ml)
- "Becher" = 1 Standardbecher (150g Joghurt, 200ml Sahne)
- "Pkg" = 1 Standardpackung
- "Prise" = eine Prise (ca. 0.3-0.5g)
- "EL" = 1 Esslöffel
- "TL" = 1 Teelöffel
- Schätze realistische Durchschnittswerte

${ingredientList}

Antworte AUSSCHLIESSLICH mit einem JSON-Array mit genau ${missing.length} Elementen (beginnt mit [ und endet mit ]).
Jedes Element hat genau diese 4 Felder: ingredient_name, from_unit, to_amount, to_unit.
Die Reihenfolge muss der Eingabe entsprechen.
Beispiel: [{"ingredient_name":"Zwiebel","from_unit":"Stk","to_amount":80,"to_unit":"g"}]`;

    const result = await ai.chatJSON(prompt, { temperature: 0.3, maxTokens: 4096 });

    // Ergebnis normalisieren
    let items = [];
    if (Array.isArray(result)) {
      items = result;
    } else if (result && typeof result === 'object') {
      if (result.ingredient_name && result.to_amount) {
        items = [result];
      } else {
        const arrayVal = Object.values(result).find(v => Array.isArray(v));
        if (arrayVal) {
          items = arrayVal;
        } else {
          for (const [key, val] of Object.entries(result)) {
            if (val && typeof val === 'object' && val.to_amount) {
              items.push({
                ingredient_name: val.ingredient_name || key,
                from_unit: val.from_unit || missing.find(m => m.name.toLowerCase() === key.toLowerCase())?.unit || '?',
                to_amount: val.to_amount,
                to_unit: val.to_unit || 'g',
              });
            }
          }
        }
      }
    }

    // Validieren und speichern
    const valid = items.filter(r =>
      r.ingredient_name && r.from_unit && r.to_amount > 0 && r.to_unit
    );

    if (valid.length === 0) return;

    const upsert = db.prepare(`
      INSERT INTO ingredient_conversions (user_id, ingredient_name, from_unit, to_amount, to_unit)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, ingredient_name, from_unit) DO UPDATE SET
        to_amount = excluded.to_amount,
        to_unit = excluded.to_unit
    `);

    const transaction = db.transaction(() => {
      for (const c of valid) {
        upsert.run(userId, c.ingredient_name.trim(), c.from_unit.trim(), c.to_amount, c.to_unit.trim());
      }
    });

    transaction();
    console.log(`✅ Auto-Umrechnung: ${valid.length} Umrechnungen gespeichert.`);
  } catch (err) {
    console.warn(`⚠️ Auto-Umrechnung fehlgeschlagen: ${err.message}`);
    // Stille Fehlerbehandlung — blockiert nicht den Rezept-Erstellungsprozess
  }
}
