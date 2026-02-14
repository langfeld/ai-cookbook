/**
 * ============================================
 * Rezept-Routen (CRUD + AI-Import)
 * ============================================
 * Vollständige CRUD-Operationen für Rezepte inkl.
 * Foto-Import, Favoriten und Kochhistorie.
 */

import db from '../config/database.js';
import { parseRecipeFromImage, parseRecipeFromText, suggestCategories } from '../services/recipe-parser.js';
import { config } from '../config/env.js';
import { writeFileSync } from 'fs';
import { resolve, join } from 'path';
import sharp from 'sharp';
import { generateId } from '../utils/helpers.js';

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
          sort: { type: 'string', enum: ['title', 'created_at', 'last_cooked_at', 'total_time', 'times_cooked'] },
          order: { type: 'string', enum: ['asc', 'desc'] },
          limit: { type: 'integer', default: 50 },
          offset: { type: 'integer', default: 0 },
        },
      },
    },
  }, async (request) => {
    const { search, category, favorite, difficulty, sort = 'created_at', order = 'desc', limit, offset } = request.query;
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
    query += ` ORDER BY r.${sort} ${order}`;
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
    const { title, description, servings, prep_time, cook_time, difficulty, ingredients, steps, categoryIds, notes } = request.body;

    const totalTime = (prep_time || 0) + (cook_time || 0);

    const transaction = db.transaction(() => {
      // Rezept einfügen
      const recipeResult = db.prepare(`
        INSERT INTO recipes (user_id, title, description, servings, prep_time, cook_time, total_time, difficulty, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, title, description, servings || 4, prep_time || 0, cook_time || 0, totalTime, difficulty || 'mittel', notes);

      const recipeId = recipeResult.lastInsertRowid;

      // Kategorien zuordnen
      if (categoryIds?.length) {
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
    const parts = request.files();
    const imageBuffers = [];
    let firstImagePath = null;

    for await (const part of parts) {
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
    const { title, description, servings, prep_time, cook_time, difficulty, ingredients, steps, categoryIds, notes } = request.body;

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
      if (categoryIds) {
        db.prepare('DELETE FROM recipe_categories WHERE recipe_id = ?').run(recipeId);
        const insertCat = db.prepare('INSERT OR IGNORE INTO recipe_categories (recipe_id, category_id) VALUES (?, ?)');
        for (const catId of categoryIds) {
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
   * DELETE /api/recipes/:id
   * Rezept löschen
   */
  fastify.delete('/:id', {
    schema: { description: 'Rezept löschen', tags: ['Rezepte'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const result = db.prepare('DELETE FROM recipes WHERE id = ? AND user_id = ?').run(request.params.id, request.user.id);
    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Rezept nicht gefunden' });
    }
    return { message: 'Rezept gelöscht' };
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

    return { message: 'Als gekocht markiert!' };
  });
}
