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
import { parseRecipeFromImage, parseRecipeFromText, parseRecipeFromUrl, suggestCategories, reviseRecipe, estimateNutrition } from '../services/recipe-parser.js';
// autoGenerateConversions entfernt – natürliche Einheiten + KI-Aggregation statt manueller Umrechnungstabelle
import { config } from '../config/env.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import sharp from 'sharp';
import { generateId, safePath, getWeekStart, scaleIngredient, convertToBaseUnit, unitsCompatible, comparePantryAmount, sanitize, isPrivateUrl, validateDate } from '../utils/helpers.js';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);
const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'einfach', 'mittel', 'schwer']);

/**
 * Sanitiert KI-Output bevor er in die DB geschrieben wird.
 * Begrenzt Längen, validiert Typen, verhindert Injection.
 */
function sanitizeAiRecipe(parsed) {
  return {
    title: sanitize(parsed.title, 300) || 'Unbenanntes Rezept',
    description: sanitize(parsed.description, 2000) || null,
    servings: Math.min(Math.max(parseInt(parsed.servings) || 4, 1), 100),
    prep_time: Math.min(Math.max(parseInt(parsed.prep_time) || 0, 0), 1440),
    cook_time: Math.min(Math.max(parseInt(parsed.cook_time) || 0, 0), 1440),
    total_time: Math.min(Math.max(parseInt(parsed.total_time) || 0, 0), 2880),
    difficulty: VALID_DIFFICULTIES.has(parsed.difficulty) ? parsed.difficulty : 'mittel',
    suggested_categories: Array.isArray(parsed.suggested_categories)
      ? parsed.suggested_categories.slice(0, 20).map(c => sanitize(c, 100)).filter(Boolean)
      : [],
    ingredients: Array.isArray(parsed.ingredients)
      ? parsed.ingredients.slice(0, 200).map((ing, idx) => ({
        name: sanitize(ing.name, 300),
        amount: typeof ing.amount === 'number' ? Math.min(Math.max(ing.amount, 0), 99999) : (parseFloat(ing.amount) || null),
        unit: sanitize(ing.unit, 50),
        group_name: sanitize(ing.group_name, 200) || null,
        sort_order: idx,
        is_optional: ing.is_optional ? 1 : 0,
        notes: sanitize(ing.notes, 500) || null,
      })).filter(i => i.name)
      : [],
    steps: Array.isArray(parsed.steps)
      ? parsed.steps.slice(0, 100).map((step, idx) => ({
        step_number: parseInt(step.step_number) || idx + 1,
        title: sanitize(step.title, 300) || null,
        instruction: sanitize(step.instruction, 5000),
        duration_minutes: Math.min(Math.max(parseInt(step.duration_minutes) || 0, 0), 1440),
      })).filter(s => s.instruction)
      : [],
    nutrition: sanitizeNutrition(parsed.nutrition),
    nutrition_note: sanitize(parsed.nutrition_note, 500) || null,
  };
}

/**
 * Sanitiert Nährwert-Daten aus KI-Output oder Nutzereingabe.
 * Gibt ein Objekt { calories, protein, carbs, fat } zurück (jeweils Zahl oder null).
 */
function sanitizeNutrition(nutrition) {
  if (!nutrition || typeof nutrition !== 'object') {
    return { calories: null, protein: null, carbs: null, fat: null };
  }
  const sanitizeVal = (v) => {
    const n = parseFloat(v);
    if (isNaN(n) || n < 0) return null;
    return Math.min(Math.round(n * 10) / 10, 99999);
  };
  return {
    calories: sanitizeVal(nutrition.calories),
    protein: sanitizeVal(nutrition.protein),
    carbs: sanitizeVal(nutrition.carbs),
    fat: sanitizeVal(nutrition.fat),
  };
}

/**
 * Vorräte für ein Rezept abziehen.
 * Wird sowohl beim „Als gekocht markieren" als auch potenziell vom Mealplan verwendet.
 *
 * @param {number} userId - Der Benutzer, dessen Vorräte angepasst werden
 * @param {number} recipeId - Das Rezept, dessen Zutaten abgezogen werden
 * @param {number} originalServings - Original-Portionszahl des Rezepts
 * @param {number} targetServings - Ziel-Portionszahl
 * @param {Object} [ingredientOverrides] - Optionale Map: Zutatname (lowercase) → absolute Menge (in Originaleinheit)
 * @returns {number} Anzahl der aktualisierten Pantry-Items
 */
function deductPantryForRecipe(userId, recipeId, originalServings, targetServings, ingredientOverrides = null) {
  let pantryUpdated = 0;
  const ingredients = db.prepare('SELECT * FROM ingredients WHERE recipe_id = ?').all(recipeId);

  for (const ing of ingredients) {
    if (ing.is_optional) continue;

    const overrideKey = ing.name.toLowerCase().trim();
    let scaledAmount;

    if (ingredientOverrides && overrideKey in ingredientOverrides) {
      // Override: Wert ist bereits die endgültige Menge in der Originaleinheit der Zutat
      scaledAmount = ingredientOverrides[overrideKey];
    } else {
      // Standard-Skalierung nach Portionen
      scaledAmount = ing.amount
        ? scaleIngredient(ing.amount, originalServings, targetServings)
        : null;
    }

    if (!scaledAmount || scaledAmount <= 0) continue;

    const pantryItem = db.prepare(
      'SELECT * FROM pantry WHERE user_id = ? AND LOWER(ingredient_name) = LOWER(?)'
    ).get(userId, ing.name);

    if (!pantryItem) continue;
    if (pantryItem.is_permanent) continue;

    // Vergleich inkl. Küchenstandard-Tabelle (Stück↔g, Zehe↔g etc.)
    const result = comparePantryAmount(
      ing.name, scaledAmount, ing.unit, pantryItem.amount, pantryItem.unit
    );
    if (!result.compatible) continue;

    const pantryNormalized = convertToBaseUnit(pantryItem.amount, pantryItem.unit);
    const newAmount = Math.max(0, pantryNormalized.amount - result.pantryBaseDeduction);
    db.prepare('UPDATE pantry SET amount = ?, unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newAmount, pantryNormalized.unit, pantryItem.id);
    pantryUpdated++;
  }

  return pantryUpdated;
}

export default async function recipesRoutes(fastify) {
  // Alle Rezept-Routen erfordern Authentifizierung
  fastify.addHook('onRequest', fastify.authenticate);

  /**
   * POST /api/recipes/estimate-nutrition
   * Nährwerte per KI schätzen lassen
   */
  fastify.post('/estimate-nutrition', {
    schema: {
      description: 'Nährwerte per KI schätzen',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
    },
    config: {
      rateLimit: { max: 10, timeWindow: '15 minutes' },
    },
  }, async (request, reply) => {
    const { ingredients, servings } = request.body;

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return reply.status(400).send({ error: 'Mindestens eine Zutat erforderlich' });
    }

    if (!config.ai.provider) {
      return reply.status(400).send({ error: 'Kein KI-Provider konfiguriert' });
    }

    const result = await estimateNutrition(ingredients, servings || 4);
    const nutrition = sanitizeNutrition(result);
    nutrition.note = sanitize(result?.note, 500) || null;
    return reply.send(nutrition);
  });

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
    const { title, description, servings, prep_time, cook_time, difficulty, ingredients, steps, category_ids, notes, calories, protein, carbs, fat, nutrition_note } = request.body;

    const totalTime = (prep_time || 0) + (cook_time || 0);

    const transaction = db.transaction(() => {
      // Rezept einfügen
      const recipeResult = db.prepare(`
        INSERT INTO recipes (user_id, title, description, servings, prep_time, cook_time, total_time, difficulty, notes, calories, protein, carbs, fat, nutrition_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, title, description, servings || 4, prep_time || 0, cook_time || 0, totalTime, difficulty || 'mittel', notes,
        parseFloat(calories) || null, parseFloat(protein) || null, parseFloat(carbs) || null, parseFloat(fat) || null, nutrition_note || null);

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
    const rawParsed = await parseRecipeFromImage(imageBuffers, categoryNames);
    const parsedRecipe = sanitizeAiRecipe(rawParsed);

    // Rezept in Datenbank speichern
    const transaction = db.transaction(() => {
      const recipeResult = db.prepare(`
        INSERT INTO recipes (user_id, title, description, servings, prep_time, cook_time, total_time, difficulty, image_url, ai_generated, calories, protein, carbs, fat, nutrition_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      `).run(
        userId,
        parsedRecipe.title,
        parsedRecipe.description,
        parsedRecipe.servings,
        parsedRecipe.prep_time,
        parsedRecipe.cook_time,
        parsedRecipe.total_time,
        parsedRecipe.difficulty,
        `/api/uploads/${firstImagePath}`,
        parsedRecipe.nutrition.calories,
        parsedRecipe.nutrition.protein,
        parsedRecipe.nutrition.carbs,
        parsedRecipe.nutrition.fat,
        parsedRecipe.nutrition_note
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
        for (const ing of parsedRecipe.ingredients) {
          insertIng.run(recipeId, ing.name, ing.amount, ing.unit, ing.group_name, ing.sort_order, ing.is_optional, ing.notes);
        }
      }

      // Kochschritte einfügen
      if (parsedRecipe.steps?.length) {
        const insertStep = db.prepare(`
          INSERT INTO cooking_steps (recipe_id, step_number, title, instruction, duration_minutes)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const step of parsedRecipe.steps) {
          insertStep.run(recipeId, step.step_number, step.title, step.instruction, step.duration_minutes);
        }
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
          text: { type: 'string', minLength: 10, maxLength: 50000 },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { text } = request.body;

    const categories = db.prepare('SELECT name FROM categories WHERE user_id = ?').all(userId);
    const rawParsed = await parseRecipeFromText(text, categories.map(c => c.name));
    const parsedRecipe = sanitizeAiRecipe(rawParsed);

    // Gleiche Speicher-Logik wie bei Foto-Import (ohne Bild)
    const transaction = db.transaction(() => {
      const recipeResult = db.prepare(`
        INSERT INTO recipes (user_id, title, description, servings, prep_time, cook_time, total_time, difficulty, ai_generated, calories, protein, carbs, fat, nutrition_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      `).run(
        userId,
        parsedRecipe.title,
        parsedRecipe.description,
        parsedRecipe.servings,
        parsedRecipe.prep_time,
        parsedRecipe.cook_time,
        parsedRecipe.total_time,
        parsedRecipe.difficulty,
        parsedRecipe.nutrition.calories,
        parsedRecipe.nutrition.protein,
        parsedRecipe.nutrition.carbs,
        parsedRecipe.nutrition.fat,
        parsedRecipe.nutrition_note
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
        for (const ing of parsedRecipe.ingredients) {
          insertIng.run(recipeId, ing.name, ing.amount, ing.unit, ing.group_name, ing.sort_order, ing.is_optional, ing.notes);
        }
      }

      if (parsedRecipe.steps?.length) {
        const insertStep = db.prepare(
          'INSERT INTO cooking_steps (recipe_id, step_number, title, instruction, duration_minutes) VALUES (?, ?, ?, ?, ?)'
        );
        for (const step of parsedRecipe.steps) {
          insertStep.run(recipeId, step.step_number, step.title, step.instruction, step.duration_minutes);
        }
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

    // SSRF-Schutz: Keine internen URLs erlauben
    if (isPrivateUrl(url)) {
      return reply.status(400).send({ error: 'URLs zu internen/privaten Adressen sind nicht erlaubt.' });
    }

    const categories = db.prepare('SELECT name FROM categories WHERE user_id = ?').all(userId);
    const { recipe: rawParsed, imageUrl: sourceImageUrl } = await parseRecipeFromUrl(url, categories.map(c => c.name));
    const parsedRecipe = sanitizeAiRecipe(rawParsed);

    // Rezeptbild von der Quellseite herunterladen und lokal speichern
    let localImagePath = null;
    if (sourceImageUrl && !isPrivateUrl(sourceImageUrl)) {
      try {
        const imgResponse = await fetch(sourceImageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Zauberjournal/1.0)',
            'Accept': 'image/*',
            'Referer': url,
          },
          signal: AbortSignal.timeout(15000),
        });

        if (imgResponse.ok) {
          const contentType = imgResponse.headers.get('content-type') || '';
          if (contentType.startsWith('image/')) {
            const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
            // Bild-Größenlimit: max 15 MB
            if (imgBuffer.length > 15 * 1024 * 1024) throw new Error('Bild zu groß');
            const imageId = generateId();
            localImagePath = `recipes/${imageId}.webp`;
            const fullPath = resolve(config.upload.path, localImagePath);
            await sharp(imgBuffer)
              .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 85 })
              .toFile(fullPath);
          }
        }
      } catch {
        // Bild-Download fehlgeschlagen – Rezept trotzdem importieren
        localImagePath = null;
      }
    }

    // Gleiche Speicher-Logik wie bei Text-Import
    const transaction = db.transaction(() => {
      const recipeResult = db.prepare(`
        INSERT INTO recipes (user_id, title, description, servings, prep_time, cook_time, total_time, difficulty, image_url, source_url, ai_generated, notes, calories, protein, carbs, fat, nutrition_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        parsedRecipe.title,
        parsedRecipe.description,
        parsedRecipe.servings,
        parsedRecipe.prep_time,
        parsedRecipe.cook_time,
        parsedRecipe.total_time,
        parsedRecipe.difficulty,
        localImagePath ? `/api/uploads/${localImagePath}` : null,
        sanitize(url, 2000),
        `Importiert von: ${sanitize(url, 2000)}`,
        parsedRecipe.nutrition.calories,
        parsedRecipe.nutrition.protein,
        parsedRecipe.nutrition.carbs,
        parsedRecipe.nutrition.fat,
        parsedRecipe.nutrition_note
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
        for (const ing of parsedRecipe.ingredients) {
          insertIng.run(recipeId, ing.name, ing.amount, ing.unit, ing.group_name, ing.sort_order, ing.is_optional, ing.notes);
        }
      }

      if (parsedRecipe.steps?.length) {
        const insertStep = db.prepare(
          'INSERT INTO cooking_steps (recipe_id, step_number, title, instruction, duration_minutes) VALUES (?, ?, ?, ?, ?)'
        );
        for (const step of parsedRecipe.steps) {
          insertStep.run(recipeId, step.step_number, step.title, step.instruction, step.duration_minutes);
        }
      }

      return recipeId;
    });

    const recipeId = transaction();
    return reply.status(201).send({ id: recipeId, recipe: parsedRecipe });
  });

  /**
   * GET /api/recipes/:id/revision-check
   * Prüft ob ein Rezept in einem fixierten, noch ungekochten Wochenplan steht
   */
  fastify.get('/:id/revision-check', {
    schema: {
      description: 'Prüfe ob Rezept in fixiertem Wochenplan (Konflikt-Check)',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const recipeId = request.params.id;

    // Ownership-Check
    const existing = db.prepare('SELECT id FROM recipes WHERE id = ? AND user_id = ?').get(recipeId, userId);
    if (!existing) {
      return reply.status(404).send({ error: 'Rezept nicht gefunden' });
    }

    const weekStart = getWeekStart();

    // Finde fixierte, ungekochte Einträge mit diesem Rezept (aktuelle oder zukünftige Wochen)
    const conflicts = db.prepare(`
      SELECT mp.week_start, mpe.day_of_week, mpe.meal_type
      FROM meal_plan_entries mpe
      JOIN meal_plans mp ON mpe.meal_plan_id = mp.id
      WHERE mpe.recipe_id = ?
        AND mp.user_id = ?
        AND mp.is_locked = 1
        AND mpe.is_cooked = 0
        AND mp.week_start >= ?
    `).all(recipeId, userId, weekStart);

    return {
      hasConflict: conflicts.length > 0,
      conflictDetails: conflicts.map(c => ({
        weekStart: c.week_start,
        dayOfWeek: c.day_of_week,
        mealType: c.meal_type,
      })),
    };
  });

  /**
   * POST /api/recipes/:id/revise
   * Rezept per KI überarbeiten (überschreiben oder als Kopie)
   */
  fastify.post('/:id/revise', {
    config: {
      rateLimit: { max: 5, timeWindow: '15 minutes' },
    },
    schema: {
      description: 'Rezept per KI überarbeiten',
      tags: ['Rezepte'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
      },
      body: {
        type: 'object',
        required: ['instructions', 'mode'],
        properties: {
          instructions: { type: 'string', minLength: 3, maxLength: 2000 },
          mode: { type: 'string', enum: ['overwrite', 'copy'] },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const recipeId = request.params.id;
    const { instructions, mode } = request.body;

    // Bestehendes Rezept vollständig laden (Ownership-Check)
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?').get(recipeId, userId);
    if (!recipe) {
      return reply.status(404).send({ error: 'Rezept nicht gefunden' });
    }

    const ingredients = db.prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY group_name, sort_order').all(recipeId);
    const steps = db.prepare('SELECT * FROM cooking_steps WHERE recipe_id = ? ORDER BY step_number').all(recipeId);

    // KI-Überarbeitung
    const rawRevised = await reviseRecipe({ ...recipe, ingredients, steps }, instructions);
    const revised = sanitizeAiRecipe(rawRevised);

    // Strukturelle Validierung: KI muss ein gültiges Rezept liefern
    if (!revised.title || revised.title === 'Unbenanntes Rezept') {
      return reply.status(422).send({ error: 'KI-Überarbeitung hat keinen gültigen Titel erzeugt.' });
    }
    if (!revised.ingredients.length) {
      return reply.status(422).send({ error: 'KI-Überarbeitung hat keine Zutaten erzeugt.' });
    }
    if (!revised.steps.length) {
      return reply.status(422).send({ error: 'KI-Überarbeitung hat keine Zubereitungsschritte erzeugt.' });
    }

    if (mode === 'overwrite') {
      // In-Place Update (gleiche Logik wie PUT /:id)
      const totalTime = (revised.prep_time || 0) + (revised.cook_time || 0);

      const transaction = db.transaction(() => {
        db.prepare(`
          UPDATE recipes SET title=?, description=?, servings=?, prep_time=?, cook_time=?, total_time=?, difficulty=?, calories=?, protein=?, carbs=?, fat=?, nutrition_note=?, updated_at=CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(revised.title, revised.description, revised.servings, revised.prep_time, revised.cook_time, totalTime, revised.difficulty,
          revised.nutrition.calories, revised.nutrition.protein, revised.nutrition.carbs, revised.nutrition.fat, revised.nutrition_note, recipeId);

        // Zutaten ersetzen
        db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(recipeId);
        const insertIng = db.prepare(
          'INSERT INTO ingredients (recipe_id, name, amount, unit, group_name, sort_order, is_optional, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        revised.ingredients.forEach((ing, idx) => {
          insertIng.run(recipeId, ing.name, ing.amount, ing.unit, ing.group_name, idx, ing.is_optional, ing.notes);
        });

        // Steps ersetzen
        db.prepare('DELETE FROM cooking_steps WHERE recipe_id = ?').run(recipeId);
        const insertStep = db.prepare(
          'INSERT INTO cooking_steps (recipe_id, step_number, title, instruction, duration_minutes) VALUES (?, ?, ?, ?, ?)'
        );
        revised.steps.forEach((step, idx) => {
          insertStep.run(recipeId, idx + 1, step.title, step.instruction, step.duration_minutes);
        });
      });

      transaction();

      // Aktualisiertes Rezept zurückgeben
      const updatedRecipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId);
      const updatedIngredients = db.prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY group_name, sort_order').all(recipeId);
      const updatedSteps = db.prepare('SELECT * FROM cooking_steps WHERE recipe_id = ? ORDER BY step_number').all(recipeId);
      const categories = db.prepare('SELECT c.* FROM categories c JOIN recipe_categories rc ON c.id = rc.category_id WHERE rc.recipe_id = ?').all(recipeId);

      return {
        message: 'Rezept erfolgreich überarbeitet!',
        recipe: { ...updatedRecipe, ingredients: updatedIngredients, steps: updatedSteps, categories },
      };
    } else {
      // Kopie erstellen
      const transaction = db.transaction(() => {
        const result = db.prepare(`
          INSERT INTO recipes (user_id, title, description, servings, prep_time, cook_time, total_time, difficulty, image_url, source_url, ai_generated, notes, calories, protein, carbs, fat, nutrition_note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
        `).run(
          userId, revised.title, revised.description, revised.servings,
          revised.prep_time, revised.cook_time,
          (revised.prep_time || 0) + (revised.cook_time || 0),
          revised.difficulty,
          recipe.image_url, recipe.source_url,
          recipe.notes ? `Überarbeitet aus: ${sanitize(recipe.title, 200)}\n${recipe.notes}` : `Überarbeitet aus: ${sanitize(recipe.title, 200)}`,
          revised.nutrition.calories, revised.nutrition.protein, revised.nutrition.carbs, revised.nutrition.fat, revised.nutrition_note
        );

        const newRecipeId = result.lastInsertRowid;

        // Kategorien vom Original kopieren
        const origCats = db.prepare('SELECT category_id FROM recipe_categories WHERE recipe_id = ?').all(recipeId);
        const insertCat = db.prepare('INSERT OR IGNORE INTO recipe_categories (recipe_id, category_id) VALUES (?, ?)');
        for (const cat of origCats) {
          insertCat.run(newRecipeId, cat.category_id);
        }

        // Zutaten einfügen
        const insertIng = db.prepare(
          'INSERT INTO ingredients (recipe_id, name, amount, unit, group_name, sort_order, is_optional, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        revised.ingredients.forEach((ing, idx) => {
          insertIng.run(newRecipeId, ing.name, ing.amount, ing.unit, ing.group_name, idx, ing.is_optional, ing.notes);
        });

        // Steps einfügen
        const insertStep = db.prepare(
          'INSERT INTO cooking_steps (recipe_id, step_number, title, instruction, duration_minutes) VALUES (?, ?, ?, ?, ?)'
        );
        revised.steps.forEach((step, idx) => {
          insertStep.run(newRecipeId, idx + 1, step.title, step.instruction, step.duration_minutes);
        });

        return newRecipeId;
      });

      const newRecipeId = transaction();

      return reply.status(201).send({
        message: 'Rezept-Kopie erfolgreich erstellt!',
        id: newRecipeId,
      });
    }
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
    const { title, description, servings, prep_time, cook_time, difficulty, ingredients, steps, category_ids, notes, calories, protein, carbs, fat, nutrition_note } = request.body;

    // Prüfen ob Rezept dem User gehört
    const existing = db.prepare('SELECT id FROM recipes WHERE id = ? AND user_id = ?').get(recipeId, userId);
    if (!existing) {
      return reply.status(404).send({ error: 'Rezept nicht gefunden' });
    }

    const totalTime = (prep_time || 0) + (cook_time || 0);

    const transaction = db.transaction(() => {
      // Rezept updaten
      db.prepare(`
        UPDATE recipes SET title=?, description=?, servings=?, prep_time=?, cook_time=?, total_time=?, difficulty=?, notes=?, calories=?, protein=?, carbs=?, fat=?, nutrition_note=?, updated_at=CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(title, description, servings, prep_time, cook_time, totalTime, difficulty, notes,
        parseFloat(calories) || null, parseFloat(protein) || null, parseFloat(carbs) || null, parseFloat(fat) || null, nutrition_note || null, recipeId);

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
   * Unterstützt individuelle Zutatenmengen-Overrides (ingredientOverrides).
   * Pantry-Abzug findet IMMER statt – nicht nur bei Wochenplan-Einträgen.
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
          ingredientOverrides: {
            type: 'object',
            description: 'Map von Zutatname (lowercase) → angepasste Menge (skaliert, in Originaleinheit)',
            additionalProperties: { type: 'number' },
          },
        },
      },
    },
  }, async (request) => {
    const userId = request.user.id;
    const recipeId = request.params.id;
    const { servings, rating, notes, ingredientOverrides } = request.body || {};

    // Kochhistorie eintragen
    db.prepare(
      'INSERT INTO cooking_history (user_id, recipe_id, servings, rating, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, recipeId, servings, rating, notes);

    // Rezept-Statistiken aktualisieren
    db.prepare(
      'UPDATE recipes SET times_cooked = times_cooked + 1, last_cooked_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(recipeId);

    // Rezept-Originalportionen laden
    const recipeRow = db.prepare('SELECT servings FROM recipes WHERE id = ?').get(recipeId);
    const originalServings = recipeRow?.servings || servings || 4;
    const targetServings = servings || originalServings;

    // ── Wochenplan-Sync: Wenn das Rezept heute im Plan steht → auch dort als gekocht markieren ──
    let mealPlanUpdated = false;

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
    }

    // ── Vorräte IMMER abziehen (unabhängig vom Wochenplan) ──
    const pantryUpdated = deductPantryForRecipe(userId, recipeId, originalServings, targetServings, ingredientOverrides);

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

    // Source-Check (empfohlen, aber nicht strikt für Kompatibilität)
    if (importData.source && importData.source !== 'Zauberjournal') {
      return reply.status(400).send({ error: 'Unbekannte Quelle. Nur Zauberjournal-Exporte werden unterstützt.' });
    }

    if (importData.recipes.length === 0) {
      return reply.status(400).send({ error: 'Keine Rezepte zum Importieren gefunden.' });
    }

    // Max. 100 Rezepte pro Import
    if (importData.recipes.length > 100) {
      return reply.status(400).send({ error: 'Maximal 100 Rezepte pro Import erlaubt.' });
    }

    // Base64-Bilder Vorabprüfung: max ~14 MB Base64-String pro Bild (=10 MB raw)
    for (const recipe of importData.recipes) {
      if (recipe.image_base64 && typeof recipe.image_base64 === 'string' && recipe.image_base64.length > 14 * 1024 * 1024) {
        recipe.image_base64 = null; // Zu groß, Bild verwerfen statt Absturz
      }
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
          const title = sanitize(recipe.title, 300);
          const recipeResult = db.prepare(`
            INSERT INTO recipes (user_id, title, description, servings, prep_time, cook_time, total_time, difficulty, source_url, is_favorite, notes, ai_generated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            userId,
            title,
            sanitize(recipe.description, 2000) || null,
            Math.min(Math.max(parseInt(recipe.servings) || 4, 1), 100),
            Math.min(Math.max(parseInt(recipe.prep_time) || 0, 0), 1440),
            Math.min(Math.max(parseInt(recipe.cook_time) || 0, 0), 1440),
            Math.min(Math.max(parseInt(recipe.total_time) || (parseInt(recipe.prep_time) || 0) + (parseInt(recipe.cook_time) || 0), 0), 2880),
            VALID_DIFFICULTIES.has(recipe.difficulty) ? recipe.difficulty : 'mittel',
            sanitize(recipe.source_url, 2000) || null,
            recipe.is_favorite ? 1 : 0,
            sanitize(recipe.notes, 2000) || null,
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
        } catch {
          skipped++;
          errors.push(`Fehler bei "${sanitize(recipe.title || 'Unbenannt', 50)}"`);
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
