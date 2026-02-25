/**
 * ============================================
 * Rezept-Routen (CRUD + AI-Import)
 * ============================================
 * Vollständige CRUD-Operationen für       if (category_ids?.length) {
        const insertCat = db.prepare(
          'INSERT OR IGNORE INTO recipe_categories (recipe_id, category_id) VALUES (?, ?)'
        );
        for (const catId of category_ids) {
          insertCat.run(recipeId, catId);
        }
      }

      // Zutaten einfügenkl.
 * Foto-Import, Favoriten und Kochhistorie.
 */

import db from '../config/database.js';
import { parseRecipeFromImage, parseRecipeFromText, parseRecipeFromUrl, suggestCategories } from '../services/recipe-parser.js';
// autoGenerateConversions entfernt – natürliche Einheiten + KI-Aggregation statt manueller Umrechnungstabelle
import { config } from '../config/env.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import sharp from 'sharp';
import { generateId, safePath, getWeekStart, scaleIngredient, convertToBaseUnit, unitsCompatible } from '../utils/helpers.js';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

export default async function recipesRoutes(fastify) {
  // Alle Rezept-Routen erfordern Authentifizierung
  fastify.addHook('onRequest', fastify.authenticate);

  /**
   * GET /api/recipes
   * Alle Rezepte des Benutzers auflisten
   */
  fastify.get('/', {
    schema: {
      description: 'Alle Rezepte auflisten',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          category: { type: 'string' },
          favorite: { type: 'boolean' },
          difficulty: { type: 'string' },
          collectionId: { type: 'integer' },
          sort: { type: 'string', enum: ['title', 'created_at', 'last_cooked_at', 'total_time', 'times_cooked'] },
          order: { type: 'string', enum: ['asc', 'desc'] },
          limit: { type: 'integer', default: 50 },
          offset: { type: 'integer', default: 0 },
        },
      },
    },
  }, async (request) => {
    const { search, category, favorite, difficulty, collectionId, sort = 'created_at', order = 'desc', limit, offset } = request.query;
    const userId = request.user.id;

    let query = `
      SELECT DISTINCT r.*,
        GROUP_CONCAT(DISTINCT c.name) as category_names,
        GROUP_CONCAT(DISTINCT c.icon) as category_icons
      FROM recipes r
      LEFT JOIN recipe_categories rc ON r.id = rc.recipe_id
      LEFT JOIN categories c ON rc.category_id = c.id
      WHERE r.user_id = ?
    `;
    const params = [userId];

    // Sammlungs-Filter
    if (collectionId) {
      query += ' AND r.id IN (SELECT rcol.recipe_id FROM recipe_collections rcol WHERE rcol.collection_id = ?)';
      params.push(collectionId);
    }

    // Suchfilter
    if (search) {
      query += ' AND (r.title LIKE ? OR r.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Kategorie-Filter
    if (category) {
      query += ' AND c.name = ?';
      params.push(category);
    }

    // Favoriten-Filter
    if (favorite !== undefined) {
      query += ' AND r.is_favorite = ?';
      params.push(favorite ? 1 : 0);
    }

    // Schwierigkeitsgrad-Filter
    if (difficulty) {
      query += ' AND r.difficulty = ?';
      params.push(difficulty);
    }

    query += ' GROUP BY r.id';

    // Sichere Whitelist für ORDER BY (kein String-Interpolation in SQL)
    const sortColumns = {
      title: 'r.title',
      created_at: 'r.created_at',
      last_cooked_at: 'r.last_cooked_at',
      total_time: 'r.total_time',
      times_cooked: 'r.times_cooked',
    };
    const safeSort = sortColumns[sort] || 'r.created_at';
    const safeOrder = order === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${safeSort} ${safeOrder}`;

    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const recipes = db.prepare(query).all(...params);

    // Gesamtanzahl für Pagination
    const total = db.prepare(
      'SELECT COUNT(*) as count FROM recipes WHERE user_id = ?'
    ).get(userId).count;

    return { recipes, total };
  });

  /**
   * GET /api/recipes/:id
   * Einzelnes Rezept mit allen Details
   */
  fastify.get('/:id', {
    schema: {
      description: 'Rezeptdetails abrufen',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const recipe = db.prepare(
      'SELECT * FROM recipes WHERE id = ? AND user_id = ?'
    ).get(request.params.id, request.user.id);

    if (!recipe) {
      return reply.status(404).send({ error: 'Rezept nicht gefunden' });
    }

    // Kategorien laden
    const categories = db.prepare(`
      SELECT c.* FROM categories c
      JOIN recipe_categories rc ON c.id = rc.category_id
      WHERE rc.recipe_id = ?
    `).all(recipe.id);

    // Zutaten laden (sortiert nach Gruppe und Reihenfolge)
    const ingredients = db.prepare(
      'SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY group_name, sort_order'
    ).all(recipe.id);

    // Kochschritte laden
    const steps = db.prepare(
      'SELECT * FROM cooking_steps WHERE recipe_id = ? ORDER BY step_number'
    ).all(recipe.id);

    // Kochhistorie laden (letzte 10)
    const history = db.prepare(
      'SELECT * FROM cooking_history WHERE recipe_id = ? ORDER BY cooked_at DESC LIMIT 10'
    ).all(recipe.id);

    return {
      ...recipe,
      categories,
      ingredients,
      steps,
      history,
    };
  });

  /**
   * POST /api/recipes
   * Neues Rezept manuell erstellen
   */
  fastify.post('/', {
    schema: {
      description: 'Neues Rezept erstellen',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { title, description, servings, prep_time, cook_time, difficulty, ingredients, steps, category_ids, notes } = request.body;

    const totalTime = (prep_time || 0) + (cook_time || 0);

    const transaction = db.transaction(() => {
      // Rezept einfügen
      const recipeResult = db.prepare(`
        INSERT INTO recipes (user_id, title, description, servings, prep_time, cook_time, total_time, difficulty, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, title, description, servings || 4, prep_time || 0, cook_time || 0, totalTime, difficulty || 'mittel', notes);

      const recipeId = recipeResult.lastInsertRowid;

      // Kategorien zuordnen
      if (category_ids?.length) {
        const insertCat = db.prepare(
          'INSERT OR IGNORE INTO recipe_categories (recipe_id, category_id) VALUES (?, ?)'
        );
        for (const catId of categoryIds) {
          insertCat.run(recipeId, catId);
        }
      }

      // Zutaten einfügen
      if (ingredients?.length) {
        const insertIng = db.prepare(`
          INSERT INTO ingredients (recipe_id, name, amount, unit, group_name, sort_order, is_optional, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        ingredients.forEach((ing, idx) => {
          insertIng.run(recipeId, ing.name, ing.amount, ing.unit, ing.group_name, idx, ing.is_optional ? 1 : 0, ing.notes);
        });
      }

      // Kochschritte einfügen
      if (steps?.length) {
        const insertStep = db.prepare(`
          INSERT INTO cooking_steps (recipe_id, step_number, title, instruction, duration_minutes)
          VALUES (?, ?, ?, ?, ?)
        `);
        steps.forEach((step, idx) => {
          insertStep.run(recipeId, idx + 1, step.title, step.instruction, step.duration_minutes);
        });
      }

      return recipeId;
    });

    const recipeId = transaction();
    return reply.status(201).send({ id: recipeId, message: 'Rezept erstellt!' });
  });

  /**
   * POST /api/recipes/import-photo
   * Rezept per Foto importieren (KI-Erkennung)
   */
  fastify.post('/import-photo', {
    schema: {
      description: 'Rezept aus Foto(s) importieren (KI) – unterstützt mehrseitige Rezeptkarten',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;

    // Alle Dateien aus Multipart-Upload lesen
    const parts = request.parts();
    const imageBuffers = [];
    let firstImagePath = null;

    for await (const part of parts) {
      // Nur Datei-Parts verarbeiten (keine Text-Felder)
      if (part.type !== 'file') continue;

      // MIME-Type prüfen
      if (!ALLOWED_MIMES.has(part.mimetype)) {
        return reply.status(400).send({ error: `Ungültiger Dateityp: ${part.mimetype}. Erlaubt: JPEG, PNG, WebP, GIF, HEIC` });
      }

      const buffer = await part.toBuffer();
      imageBuffers.push(buffer);

      // Erstes Bild als Vorschaubild speichern
      if (!firstImagePath) {
        const imageId = generateId();
        firstImagePath = `recipes/${imageId}.webp`;
        const fullPath = resolve(config.upload.path, firstImagePath);
        await sharp(buffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toFile(fullPath);
      }
    }

    if (imageBuffers.length === 0) {
      return reply.status(400).send({ error: 'Keine Bilder hochgeladen' });
    }

    // Kategorien des Users laden
    const categories = db.prepare(
      'SELECT name FROM categories WHERE user_id = ?'
    ).all(userId);
    const categoryNames = categories.map(c => c.name);

    // KI-Rezepterkennung starten (ein oder mehrere Bilder)
    const parsedRecipe = await parseRecipeFromImage(imageBuffers, categoryNames);

    // Rezept in Datenbank speichern
    const transaction = db.transaction(() => {
      const recipeResult = db.prepare(`
        INSERT INTO recipes (user_id, title, description, servings, prep_time, cook_time, total_time, difficulty, image_url, ai_generated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        userId,
        parsedRecipe.title,
        parsedRecipe.description,
        parsedRecipe.servings || 4,
        parsedRecipe.prep_time || 0,
        parsedRecipe.cook_time || 0,
        parsedRecipe.total_time || 0,
        parsedRecipe.difficulty || 'mittel',
        `/api/uploads/${firstImagePath}`
      );

      const recipeId = recipeResult.lastInsertRowid;

      // KI-vorgeschlagene Kategorien zuordnen
      if (parsedRecipe.suggested_categories?.length) {
        const insertCat = db.prepare(
          'INSERT OR IGNORE INTO recipe_categories (recipe_id, category_id) SELECT ?, id FROM categories WHERE user_id = ? AND name = ?'
        );
        for (const catName of parsedRecipe.suggested_categories) {
          insertCat.run(recipeId, userId, catName);
        }
      }

      // Zutaten einfügen
      if (parsedRecipe.ingredients?.length) {
        const insertIng = db.prepare(`
          INSERT INTO ingredients (recipe_id, name, amount, unit, group_name, sort_order, is_optional, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        parsedRecipe.ingredients.forEach((ing, idx) => {
          insertIng.run(recipeId, ing.name, ing.amount, ing.unit, ing.group_name, idx, ing.is_optional ? 1 : 0, ing.notes);
        });
      }

      // Kochschritte einfügen
      if (parsedRecipe.steps?.length) {
        const insertStep = db.prepare(`
          INSERT INTO cooking_steps (recipe_id, step_number, title, instruction, duration_minutes)
          VALUES (?, ?, ?, ?, ?)
        `);
        parsedRecipe.steps.forEach((step) => {
          insertStep.run(recipeId, step.step_number, step.title, step.instruction, step.duration_minutes);
        });
      }

      return recipeId;
    });

    const recipeId = transaction();

    return reply.status(201).send({
      id: recipeId,
      message: 'Rezept erfolgreich aus Foto importiert!',
      recipe: parsedRecipe,
    });
  });

  /**
   * POST /api/recipes/import-text
   * Rezept aus Textbeschreibung importieren
   */
  fastify.post('/import-text', {
    schema: {
      description: 'Rezept aus Text erstellen (KI)',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string', minLength: 10 },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { text } = request.body;

    const categories = db.prepare('SELECT name FROM categories WHERE user_id = ?').all(userId);
    const parsedRecipe = await parseRecipeFromText(text, categories.map(c => c.name));

    // Gleiche Speicher-Logik wie bei Foto-Import (ohne Bild)
    const transaction = db.transaction(() => {
      const recipeResult = db.prepare(`
        INSERT INTO recipes (user_id, title, description, servings, prep_time, cook_time, total_time, difficulty, ai_generated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        userId,
        parsedRecipe.title,
        parsedRecipe.description,
        parsedRecipe.servings || 4,
        parsedRecipe.prep_time || 0,
        parsedRecipe.cook_time || 0,
        parsedRecipe.total_time || 0,
        parsedRecipe.difficulty || 'mittel'
      );

      const recipeId = recipeResult.lastInsertRowid;

      if (parsedRecipe.suggested_categories?.length) {
        const insertCat = db.prepare(
          'INSERT OR IGNORE INTO recipe_categories (recipe_id, category_id) SELECT ?, id FROM categories WHERE user_id = ? AND name = ?'
        );
        for (const catName of parsedRecipe.suggested_categories) {
          insertCat.run(recipeId, userId, catName);
        }
      }

      if (parsedRecipe.ingredients?.length) {
        const insertIng = db.prepare(
          'INSERT INTO ingredients (recipe_id, name, amount, unit, group_name, sort_order, is_optional, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        parsedRecipe.ingredients.forEach((ing, idx) => {
          insertIng.run(recipeId, ing.name, ing.amount, ing.unit, ing.group_name, idx, ing.is_optional ? 1 : 0, ing.notes);
        });
      }

      if (parsedRecipe.steps?.length) {
        const insertStep = db.prepare(
          'INSERT INTO cooking_steps (recipe_id, step_number, title, instruction, duration_minutes) VALUES (?, ?, ?, ?, ?)'
        );
        parsedRecipe.steps.forEach((step) => {
          insertStep.run(recipeId, step.step_number, step.title, step.instruction, step.duration_minutes);
        });
      }

      return recipeId;
    });

    const recipeId = transaction();
    return reply.status(201).send({ id: recipeId, recipe: parsedRecipe });
  });

  /**
   * POST /api/recipes/import-url
   * Rezept von einer URL importieren (KI analysiert die Webseite)
   */
  fastify.post('/import-url', {
    schema: {
      description: 'Rezept aus URL importieren (KI)',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', format: 'uri' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { url } = request.body;

    const categories = db.prepare('SELECT name FROM categories WHERE user_id = ?').all(userId);
    const parsedRecipe = await parseRecipeFromUrl(url, categories.map(c => c.name));

    // Gleiche Speicher-Logik wie bei Text-Import
    const transaction = db.transaction(() => {
      const recipeResult = db.prepare(`
        INSERT INTO recipes (user_id, title, description, servings, prep_time, cook_time, total_time, difficulty, ai_generated, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        userId,
        parsedRecipe.title,
        parsedRecipe.description,
        parsedRecipe.servings || 4,
        parsedRecipe.prep_time || 0,
        parsedRecipe.cook_time || 0,
        parsedRecipe.total_time || 0,
        parsedRecipe.difficulty || 'mittel',
        `Importiert von: ${url}`
      );

      const recipeId = recipeResult.lastInsertRowid;

      if (parsedRecipe.suggested_categories?.length) {
        const insertCat = db.prepare(
          'INSERT OR IGNORE INTO recipe_categories (recipe_id, category_id) SELECT ?, id FROM categories WHERE user_id = ? AND name = ?'
        );
        for (const catName of parsedRecipe.suggested_categories) {
          insertCat.run(recipeId, userId, catName);
        }
      }

      if (parsedRecipe.ingredients?.length) {
        const insertIng = db.prepare(
          'INSERT INTO ingredients (recipe_id, name, amount, unit, group_name, sort_order, is_optional, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        parsedRecipe.ingredients.forEach((ing, idx) => {
          insertIng.run(recipeId, ing.name, ing.amount, ing.unit, ing.group_name, idx, ing.is_optional ? 1 : 0, ing.notes);
        });
      }

      if (parsedRecipe.steps?.length) {
        const insertStep = db.prepare(
          'INSERT INTO cooking_steps (recipe_id, step_number, title, instruction, duration_minutes) VALUES (?, ?, ?, ?, ?)'
        );
        parsedRecipe.steps.forEach((step) => {
          insertStep.run(recipeId, step.step_number, step.title, step.instruction, step.duration_minutes);
        });
      }

      return recipeId;
    });

    const recipeId = transaction();
    return reply.status(201).send({ id: recipeId, recipe: parsedRecipe });
  });

  /**
   * PUT /api/recipes/:id
   * Rezept aktualisieren
   */
  fastify.put('/:id', {
    schema: {
      description: 'Rezept aktualisieren',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const recipeId = request.params.id;
    const { title, description, servings, prep_time, cook_time, difficulty, ingredients, steps, category_ids, notes } = request.body;

    // Prüfen ob Rezept dem User gehört
    const existing = db.prepare('SELECT id FROM recipes WHERE id = ? AND user_id = ?').get(recipeId, userId);
    if (!existing) {
      return reply.status(404).send({ error: 'Rezept nicht gefunden' });
    }

    const totalTime = (prep_time || 0) + (cook_time || 0);

    const transaction = db.transaction(() => {
      // Rezept updaten
      db.prepare(`
        UPDATE recipes SET title=?, description=?, servings=?, prep_time=?, cook_time=?, total_time=?, difficulty=?, notes=?, updated_at=CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(title, description, servings, prep_time, cook_time, totalTime, difficulty, notes, recipeId);

      // Kategorien aktualisieren
      if (category_ids) {
        db.prepare('DELETE FROM recipe_categories WHERE recipe_id = ?').run(recipeId);
        const insertCat = db.prepare('INSERT OR IGNORE INTO recipe_categories (recipe_id, category_id) VALUES (?, ?)');
        for (const catId of category_ids) {
          insertCat.run(recipeId, catId);
        }
      }

      // Zutaten aktualisieren
      if (ingredients) {
        db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(recipeId);
        const insertIng = db.prepare(
          'INSERT INTO ingredients (recipe_id, name, amount, unit, group_name, sort_order, is_optional, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        ingredients.forEach((ing, idx) => {
          insertIng.run(recipeId, ing.name, ing.amount, ing.unit, ing.group_name, idx, ing.is_optional ? 1 : 0, ing.notes);
        });
      }

      // Kochschritte aktualisieren
      if (steps) {
        db.prepare('DELETE FROM cooking_steps WHERE recipe_id = ?').run(recipeId);
        const insertStep = db.prepare(
          'INSERT INTO cooking_steps (recipe_id, step_number, title, instruction, duration_minutes) VALUES (?, ?, ?, ?, ?)'
        );
        steps.forEach((step, idx) => {
          insertStep.run(recipeId, idx + 1, step.title, step.instruction, step.duration_minutes);
        });
      }
    });

    transaction();
    return { message: 'Rezept aktualisiert!' };
  });

  /**
   * POST /api/recipes/:id/image
   * Rezept-Bild hochladen oder austauschen
   */
  fastify.post('/:id/image', {
    schema: {
      description: 'Rezept-Bild hochladen/ersetzen',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const recipeId = request.params.id;

    // Prüfen ob Rezept dem User gehört
    const existing = db.prepare('SELECT id, image_url FROM recipes WHERE id = ? AND user_id = ?').get(recipeId, userId);
    if (!existing) {
      return reply.status(404).send({ error: 'Rezept nicht gefunden' });
    }

    // Datei aus Multipart auslesen
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'Keine Bilddatei hochgeladen' });
    }

    // MIME-Type prüfen
    if (!ALLOWED_MIMES.has(data.mimetype)) {
      return reply.status(400).send({ error: `Ungültiger Dateityp: ${data.mimetype}. Erlaubt: JPEG, PNG, WebP, GIF, HEIC` });
    }

    const buffer = await data.toBuffer();

    // Mit sharp verarbeiten und als WebP speichern
    const imageId = generateId();
    const imagePath = `recipes/${imageId}.webp`;
    const fullPath = resolve(config.upload.path, imagePath);

    await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(fullPath);

    // Altes Bild löschen (optional, Fehler ignorieren)
    if (existing.image_url) {
      try {
        const oldRelative = existing.image_url.replace('/api/uploads/', '');
        const oldPath = safePath(config.upload.path, oldRelative);
        if (oldPath) {
          const { unlinkSync } = await import('fs');
          unlinkSync(oldPath);
        }
      } catch {
        // Altes Bild existierte nicht mehr — kein Problem
      }
    }

    // DB aktualisieren
    const imageUrl = `/api/uploads/${imagePath}`;
    db.prepare('UPDATE recipes SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(imageUrl, recipeId);

    return { image_url: imageUrl };
  });

  /**
   * DELETE /api/recipes/:id
   * Rezept löschen (inkl. Bild-Datei)
   */
  fastify.delete('/:id', {
    schema: { description: 'Rezept löschen', tags: ['Rezepte'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const userId = request.user.id;
    const recipeId = request.params.id;

    // Rezept holen (für Bild-Pfad)
    const recipe = db.prepare('SELECT id, image_url FROM recipes WHERE id = ? AND user_id = ?').get(recipeId, userId);
    if (!recipe) {
      return reply.status(404).send({ error: 'Rezept nicht gefunden' });
    }

    // Bild-Datei löschen (falls vorhanden)
    if (recipe.image_url) {
      try {
        const relPath = recipe.image_url.replace('/api/uploads/', '');
        const fullPath = safePath(config.upload.path, relPath);
        if (fullPath) {
          const { unlinkSync } = await import('fs');
          unlinkSync(fullPath);
        }
      } catch {
        // Datei existiert nicht mehr – ignorieren
      }
    }

    // Kochhistorie löschen (recipe_id ist NOT NULL, ON DELETE SET NULL würde fehlschlagen)
    db.prepare('DELETE FROM cooking_history WHERE recipe_id = ?').run(recipeId);

    // Rezept löschen (CASCADE löscht Zutaten, Schritte, Kategorien, Wochenplan-Einträge)
    db.prepare('DELETE FROM recipes WHERE id = ?').run(recipeId);

    return { message: 'Rezept gelöscht' };
  });

  /**
   * POST /api/recipes/batch-delete
   * Mehrere Rezepte auf einmal löschen (nur Admin)
   */
  fastify.post('/batch-delete', {
    onRequest: fastify.requireAdmin,
    schema: {
      description: 'Mehrere Rezepte löschen (Admin)',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'integer' }, minItems: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { ids } = request.body;

    // Rezepte holen (für Bild-Pfade)
    const placeholders = ids.map(() => '?').join(',');
    const recipes = db.prepare(`SELECT id, image_url FROM recipes WHERE id IN (${placeholders})`).all(...ids);

    if (!recipes.length) {
      return reply.status(404).send({ error: 'Keine Rezepte gefunden' });
    }

    // Bild-Dateien löschen
    const { unlinkSync } = await import('fs');
    for (const recipe of recipes) {
      if (recipe.image_url) {
        try {
          const relPath = recipe.image_url.replace('/api/uploads/', '');
          const fullPath = safePath(config.upload.path, relPath);
          if (fullPath) unlinkSync(fullPath);
        } catch {
          // Datei existiert nicht mehr – ignorieren
        }
      }
    }

    // Alle Rezepte löschen (cooking_history vorab löschen: recipe_id ist NOT NULL, ON DELETE SET NULL würde fehlschlagen)
    const deleteHistoryStmt = db.prepare('DELETE FROM cooking_history WHERE recipe_id = ?');
    const deleteStmt = db.prepare('DELETE FROM recipes WHERE id = ?');
    const deleteAll = db.transaction((recipeIds) => {
      let deleted = 0;
      for (const id of recipeIds) {
        deleteHistoryStmt.run(id);
        const result = deleteStmt.run(id);
        deleted += result.changes;
      }
      return deleted;
    });

    const deletedCount = deleteAll(ids);

    return { message: `${deletedCount} Rezept${deletedCount !== 1 ? 'e' : ''} gelöscht`, deletedCount };
  });

  /**
   * POST /api/recipes/:id/favorite
   * Favoriten-Status umschalten
   */
  fastify.post('/:id/favorite', {
    schema: { description: 'Favorit umschalten', tags: ['Rezepte'], security: [{ bearerAuth: [] }] },
  }, async (request) => {
    db.prepare(
      'UPDATE recipes SET is_favorite = NOT is_favorite WHERE id = ? AND user_id = ?'
    ).run(request.params.id, request.user.id);

    const recipe = db.prepare('SELECT is_favorite FROM recipes WHERE id = ?').get(request.params.id);
    return { is_favorite: !!recipe.is_favorite };
  });

  /**
   * POST /api/recipes/:id/cooked
   * Als gekocht markieren (für Kochhistorie)
   */
  fastify.post('/:id/cooked', {
    schema: {
      description: 'Rezept als gekocht markieren',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          servings: { type: 'integer' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          notes: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const userId = request.user.id;
    const recipeId = request.params.id;
    const { servings, rating, notes } = request.body || {};

    // Kochhistorie eintragen
    db.prepare(
      'INSERT INTO cooking_history (user_id, recipe_id, servings, rating, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, recipeId, servings, rating, notes);

    // Rezept-Statistiken aktualisieren
    db.prepare(
      'UPDATE recipes SET times_cooked = times_cooked + 1, last_cooked_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(recipeId);

    // ── Wochenplan-Sync: Wenn das Rezept heute im Plan steht → auch dort als gekocht markieren ──
    let mealPlanUpdated = false;
    let pantryUpdated = 0;

    const currentWeekStart = getWeekStart();
    const now = new Date();
    const jsDay = now.getDay(); // 0=So, 1=Mo, ..., 6=Sa
    const todayDayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0=Mo, ..., 6=So

    // Heutigen, ungekochten Wochenplan-Eintrag für dieses Rezept suchen
    const mealPlanEntry = db.prepare(`
      SELECT mpe.*, r.servings as original_servings
      FROM meal_plan_entries mpe
      JOIN meal_plans mp ON mpe.meal_plan_id = mp.id
      JOIN recipes r ON mpe.recipe_id = r.id
      WHERE mp.user_id = ? AND mp.week_start = ? AND mpe.day_of_week = ?
        AND mpe.recipe_id = ? AND mpe.is_cooked = 0
      LIMIT 1
    `).get(userId, currentWeekStart, todayDayOfWeek, recipeId);

    if (mealPlanEntry) {
      // Eintrag als gekocht markieren
      db.prepare('UPDATE meal_plan_entries SET is_cooked = 1 WHERE id = ?').run(mealPlanEntry.id);
      mealPlanUpdated = true;

      // Vorräte abziehen (gleiche Logik wie im Mealplan-Endpoint)
      const mealServings = mealPlanEntry.servings || mealPlanEntry.original_servings;
      const ingredients = db.prepare('SELECT * FROM ingredients WHERE recipe_id = ?').all(recipeId);

      for (const ing of ingredients) {
        if (ing.is_optional) continue;

        const scaledAmount = ing.amount
          ? scaleIngredient(ing.amount, mealPlanEntry.original_servings, mealServings)
          : null;

        if (!scaledAmount || scaledAmount <= 0) continue;

        const normalized = convertToBaseUnit(scaledAmount, ing.unit);

        const pantryItem = db.prepare(
          'SELECT * FROM pantry WHERE user_id = ? AND LOWER(ingredient_name) = LOWER(?)'
        ).get(userId, ing.name);

        if (!pantryItem) continue;
        if (pantryItem.is_permanent) continue;

        const pantryNormalized = convertToBaseUnit(pantryItem.amount, pantryItem.unit);
        const compat = unitsCompatible(pantryNormalized.unit, normalized.unit);
        if (!compat.compatible) continue;

        const adjustedAmount = normalized.amount * compat.factor;
        const newAmount = Math.max(0, pantryNormalized.amount - adjustedAmount);
        db.prepare('UPDATE pantry SET amount = ?, unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newAmount, pantryNormalized.unit, pantryItem.id);
        pantryUpdated++;
      }
    }

    // ── Wenn nicht heute, aber an einem anderen Tag dieser Woche → Info zurückgeben ──
    let pendingMealPlanSync = null;
    if (!mealPlanUpdated) {
      const otherDayEntry = db.prepare(`
        SELECT mpe.id as entry_id, mpe.day_of_week, mpe.meal_type, mpe.meal_plan_id as plan_id
        FROM meal_plan_entries mpe
        JOIN meal_plans mp ON mpe.meal_plan_id = mp.id
        WHERE mp.user_id = ? AND mp.week_start = ?
          AND mpe.recipe_id = ? AND mpe.is_cooked = 0
        LIMIT 1
      `).get(userId, currentWeekStart, recipeId);

      if (otherDayEntry) {
        pendingMealPlanSync = {
          entryId: otherDayEntry.entry_id,
          planId: otherDayEntry.plan_id,
          dayOfWeek: otherDayEntry.day_of_week,
          mealType: otherDayEntry.meal_type,
        };
      }
    }

    return {
      message: 'Als gekocht markiert!',
      mealPlanUpdated,
      pantryUpdated,
      pendingMealPlanSync,
    };
  });

  // ============================================
  // EXPORT / IMPORT
  // ============================================

  /**
   * GET /api/recipes/export
   * Alle eigenen Rezepte als JSON exportieren
   * ?include_images=true  — Bilder als Base64 einbetten
   */
  fastify.get('/export', {
    schema: {
      description: 'Eigene Rezepte als JSON exportieren',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          include_images: { type: 'boolean', default: false },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const includeImages = request.query.include_images === true || request.query.include_images === 'true';

    // Alle Rezepte des Users laden
    const recipes = db.prepare('SELECT * FROM recipes WHERE user_id = ?').all(userId);

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'Zauberjournal',
      recipe_count: recipes.length,
      recipes: [],
    };

    for (const recipe of recipes) {
      // Kategorien
      const categories = db.prepare(`
        SELECT c.name, c.icon, c.color FROM categories c
        JOIN recipe_categories rc ON c.id = rc.category_id
        WHERE rc.recipe_id = ?
      `).all(recipe.id);

      // Zutaten
      const ingredients = db.prepare(
        'SELECT name, amount, unit, group_name, sort_order, is_optional, notes FROM ingredients WHERE recipe_id = ? ORDER BY group_name, sort_order'
      ).all(recipe.id);

      // Kochschritte
      const steps = db.prepare(
        'SELECT step_number, title, instruction, duration_minutes FROM cooking_steps WHERE recipe_id = ? ORDER BY step_number'
      ).all(recipe.id);

      const recipeExport = {
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        total_time: recipe.total_time,
        difficulty: recipe.difficulty,
        source_url: recipe.source_url,
        is_favorite: recipe.is_favorite,
        notes: recipe.notes,
        ai_generated: recipe.ai_generated,
        created_at: recipe.created_at,
        categories,
        ingredients,
        steps,
      };

      // Bild als Base64 einbetten (optional)
      if (includeImages && recipe.image_url) {
        try {
          const relPath = recipe.image_url.replace('/api/uploads/', '');
          const imgPath = safePath(config.upload.path, relPath);
          if (imgPath && existsSync(imgPath)) {
            const imgBuffer = readFileSync(imgPath);
            recipeExport.image_base64 = imgBuffer.toString('base64');
            recipeExport.image_mime = 'image/webp';
          }
        } catch { /* Bild nicht verfügbar – ignorieren */ }
      }

      exportData.recipes.push(recipeExport);
    }

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="rezepte-export-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  /**
   * POST /api/recipes/import
   * Rezepte aus JSON-Datei importieren
   */
  fastify.post('/import', {
    schema: {
      description: 'Rezepte aus JSON-Datei importieren',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userId = request.user.id;

    // JSON-Datei oder Body akzeptieren
    let importData;

    // Prüfen ob Multipart (Datei-Upload) oder JSON-Body
    const contentType = request.headers['content-type'] || '';

    if (contentType.includes('multipart')) {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: 'Keine Datei hochgeladen.' });
      }
      const buffer = await file.toBuffer();
      try {
        importData = JSON.parse(buffer.toString('utf-8'));
      } catch {
        return reply.status(400).send({ error: 'Ungültiges JSON-Format in der Datei.' });
      }
    } else {
      importData = request.body;
    }

    // Validierung
    if (!importData?.recipes || !Array.isArray(importData.recipes)) {
      return reply.status(400).send({ error: 'Ungültiges Export-Format. Erwartet: { recipes: [...] }' });
    }

    if (importData.recipes.length === 0) {
      return reply.status(400).send({ error: 'Keine Rezepte zum Importieren gefunden.' });
    }

    // Max. 100 Rezepte pro Import
    if (importData.recipes.length > 100) {
      return reply.status(400).send({ error: 'Maximal 100 Rezepte pro Import erlaubt.' });
    }

    // Kategorien des Users laden
    const userCategories = db.prepare('SELECT id, name FROM categories WHERE user_id = ?').all(userId);
    const catMap = new Map(userCategories.map(c => [c.name, c.id]));

    let imported = 0;
    let skipped = 0;
    const errors = [];
    const pendingImages = []; // Bilder nach Transaction verarbeiten (Sharp ist async)

    const transaction = db.transaction(() => {
      for (const recipe of importData.recipes) {
        try {
          if (!recipe.title) {
            skipped++;
            errors.push(`Übersprungen: Rezept ohne Titel`);
            continue;
          }

          // Duplikat-Check: gleiches Rezept (Titel) beim selben User?
          const existing = db.prepare(
            'SELECT id FROM recipes WHERE user_id = ? AND title = ? COLLATE NOCASE'
          ).get(userId, recipe.title.trim());
          if (existing) {
            skipped++;
            errors.push(`Übersprungen (Duplikat): „${recipe.title}"`);
            continue;
          }

          // Rezept einfügen
          const recipeResult = db.prepare(`
            INSERT INTO recipes (user_id, title, description, servings, prep_time, cook_time, total_time, difficulty, source_url, is_favorite, notes, ai_generated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            userId,
            recipe.title,
            recipe.description || null,
            recipe.servings || 4,
            recipe.prep_time || 0,
            recipe.cook_time || 0,
            recipe.total_time || (recipe.prep_time || 0) + (recipe.cook_time || 0),
            recipe.difficulty || 'mittel',
            recipe.source_url || null,
            recipe.is_favorite ? 1 : 0,
            recipe.notes || null,
            recipe.ai_generated ? 1 : 0
          );

          const recipeId = recipeResult.lastInsertRowid;

          // Bild für spätere Verarbeitung vormerken (Sharp ist async, Transaction ist sync)
          if (recipe.image_base64) {
            try {
              const imgBuffer = Buffer.from(recipe.image_base64, 'base64');
              // Größenbegrenzung: max 10 MB raw
              if (imgBuffer.length <= 10 * 1024 * 1024) {
                const imageId = generateId();
                const imagePath = `recipes/${imageId}.webp`;
                pendingImages.push({ recipeId, imgBuffer, imagePath });
                db.prepare('UPDATE recipes SET image_url = ? WHERE id = ?').run(`/api/uploads/${imagePath}`, recipeId);
              }
            } catch { /* ignorieren */ }
          }

          // Kategorien zuordnen (nur existierende)
          if (recipe.categories?.length) {
            // Max. 20 Kategorien pro Rezept
            const cats = recipe.categories.slice(0, 20);
            const insertCat = db.prepare(
              'INSERT OR IGNORE INTO recipe_categories (recipe_id, category_id) VALUES (?, ?)'
            );
            for (const cat of cats) {
              const catName = typeof cat === 'string' ? cat : cat.name;
              let catId = catMap.get(catName);

              // Kategorie erstellen falls nicht vorhanden
              if (!catId && catName) {
                const newCat = db.prepare(
                  'INSERT INTO categories (user_id, name, icon, color) VALUES (?, ?, ?, ?)'
                ).run(userId, catName, cat.icon || '🍽️', cat.color || '#6366f1');
                catId = newCat.lastInsertRowid;
                catMap.set(catName, catId);
              }

              if (catId) insertCat.run(recipeId, catId);
            }
          }

          // Zutaten einfügen (max. 200 pro Rezept)
          if (recipe.ingredients?.length) {
            const ings = recipe.ingredients.slice(0, 200);
            const insertIng = db.prepare(`
              INSERT INTO ingredients (recipe_id, name, amount, unit, group_name, sort_order, is_optional, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            ings.forEach((ing, idx) => {
              insertIng.run(recipeId, String(ing.name || '').slice(0, 500), ing.amount || null, String(ing.unit || '').slice(0, 50), String(ing.group_name || '').slice(0, 200) || null, ing.sort_order ?? idx, ing.is_optional ? 1 : 0, String(ing.notes || '').slice(0, 500) || null);
            });
          }

          // Kochschritte einfügen (max. 100 pro Rezept)
          if (recipe.steps?.length) {
            const stps = recipe.steps.slice(0, 100);
            const insertStep = db.prepare(`
              INSERT INTO cooking_steps (recipe_id, step_number, title, instruction, duration_minutes)
              VALUES (?, ?, ?, ?, ?)
            `);
            stps.forEach((step, idx) => {
              insertStep.run(recipeId, step.step_number ?? idx + 1, String(step.title || '').slice(0, 500) || null, String(step.instruction || '').slice(0, 5000), step.duration_minutes || null);
            });
          }

          imported++;
        } catch (err) {
          skipped++;
          errors.push(`Fehler bei "${recipe.title || 'Unbenannt'}": ${err.message}`);
        }
      }
    });

    transaction();

    // Bilder asynchron durch Sharp re-encodieren (Sicherheit: validiert echtes Bildformat)
    for (const { recipeId, imgBuffer, imagePath } of pendingImages) {
      try {
        const fullPath = resolve(config.upload.path, imagePath);
        await sharp(imgBuffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toFile(fullPath);
      } catch {
        // Ungültiges Bild – image_url bleibt in DB, aber Datei fehlt (harmlos)
      }
    }

    return {
      message: `${imported} Rezept(e) importiert, ${skipped} übersprungen.`,
      imported,
      skipped,
      errors: errors.length ? errors : undefined,
    };
  });
}
