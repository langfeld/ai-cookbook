/**
 * ============================================
 * Admin Routen - Verwaltungsoberfläche
 * ============================================
 * Nur für Benutzer mit role='admin' zugänglich.
 * - Dashboard-Statistiken
 * - Benutzerverwaltung
 * - Globale Kategorien
 * - Systemeinstellungen
 */

import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { readdirSync, statSync, unlinkSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import sharp from 'sharp';
import { config } from '../config/env.js';
import { safePath, generateId } from '../utils/helpers.js';
import { resetProvider } from '../services/ai/provider.js';

// Erlaubte Einstellungs-Keys (verhindert Injection beliebiger Keys)
const ALLOWED_SETTINGS = new Set([
  // Allgemein
  'registration_enabled',
  'maintenance_mode',
  'max_upload_size',
  // KI-Provider
  'ai_provider',
  'kimi_api_key',
  'kimi_base_url',
  'kimi_model',
  'openai_api_key',
  'openai_model',
  'anthropic_api_key',
  'anthropic_model',
  'ollama_base_url',
  'ollama_model',
  // REWE
  'rewe_market_id',
  'rewe_zip_code',
]);

export default async function adminRoutes(fastify) {

  // ============================================
  // Helper: Admin-Aktion loggen
  // ============================================
  function logAdminAction(userId, action, details = null) {
    try {
      db.prepare('INSERT INTO admin_logs (user_id, action, details) VALUES (?, ?, ?)').run(userId, action, details);
    } catch { /* Logging-Fehler ignorieren */ }
  }

  // ============================================
  // Alle Admin-Routen erfordern Admin-Rolle
  // ============================================
  fastify.addHook('onRequest', async function (request, reply) {
    return fastify.requireAdmin(request, reply);
  });

  // ============================================
  // GET /api/admin/stats - Dashboard-Statistiken
  // ============================================
  fastify.get('/stats', {
    schema: {
      description: 'Admin-Statistiken abrufen',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const activeUserCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
    const recipeCount = db.prepare('SELECT COUNT(*) as count FROM recipes').get().count;
    const aiRecipeCount = db.prepare('SELECT COUNT(*) as count FROM recipes WHERE ai_generated = 1').get().count;
    const mealPlanCount = db.prepare('SELECT COUNT(*) as count FROM meal_plans').get().count;
    const shoppingListCount = db.prepare('SELECT COUNT(*) as count FROM shopping_lists').get().count;
    const pantryItemCount = db.prepare('SELECT COUNT(*) as count FROM pantry').get().count;
    const cookingCount = db.prepare('SELECT COUNT(*) as count FROM cooking_history').get().count;
    const rewePrefsCount = db.prepare('SELECT COUNT(*) as count FROM rewe_product_preferences').get().count;
    const aliasCount = db.prepare('SELECT COUNT(*) as count FROM ingredient_aliases').get().count;
    const recipeBlockCount = db.prepare('SELECT COUNT(*) as count FROM recipe_blocks').get().count;

    // Top 10 beliebteste Rezepte
    const popularRecipes = db.prepare(`
      SELECT r.id, r.title, r.times_cooked, r.is_favorite, u.username as author
      FROM recipes r
      JOIN users u ON r.user_id = u.id
      ORDER BY r.times_cooked DESC
      LIMIT 10
    `).all();

    // Neueste Benutzer
    const recentUsers = db.prepare(`
      SELECT id, username, display_name, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `).all();

    // Aktivität letzte 7 Tage
    const weekActivity = db.prepare(`
      SELECT DATE(cooked_at) as date, COUNT(*) as count
      FROM cooking_history
      WHERE cooked_at >= DATE('now', '-7 days')
      GROUP BY DATE(cooked_at)
      ORDER BY date
    `).all();

    // DB-Größe
    const dbSize = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get();

    // Upload-Speicher berechnen
    let storageSize = 0;
    try {
      const uploadsDir = resolve(config.upload.path);
      const calcDirSize = (dir) => {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            calcDirSize(fullPath);
          } else {
            try { storageSize += statSync(fullPath).size; } catch { /* ignorieren */ }
          }
        }
      };
      calcDirSize(uploadsDir);
    } catch { /* Verzeichnis existiert nicht */ }

    return {
      total_users: userCount,
      active_users: activeUserCount,
      total_recipes: recipeCount,
      ai_recipes: aiRecipeCount,
      total_meal_plans: mealPlanCount,
      total_shopping_lists: shoppingListCount,
      total_pantry_items: pantryItemCount,
      total_cook_count: cookingCount,
      rewe_preferences: rewePrefsCount,
      ingredient_aliases: aliasCount,
      recipe_blocks: recipeBlockCount,
      storage_size: storageSize,
      db_size: dbSize?.size || 0,
      popular_recipes: popularRecipes,
      recent_users: recentUsers,
      week_activity: weekActivity,
    };
  });

  // ============================================
  // GET /api/admin/logs - Aktivitätslog
  // ============================================
  fastify.get('/logs', {
    schema: {
      description: 'Admin-Aktivitätslog abrufen',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  }, async (request) => {
    const limit = request.query.limit || 20;
    const logs = db.prepare(`
      SELECT al.id, al.action, al.details, al.created_at,
             u.username
      FROM admin_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ?
    `).all(limit);

    return { logs };
  });

  // ============================================
  // GET /api/admin/users - Alle Benutzer
  // ============================================
  fastify.get('/users', {
    schema: {
      description: 'Alle Benutzer auflisten',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const users = db.prepare(`
      SELECT
        u.id, u.username, u.email, u.display_name, u.role, u.is_active,
        u.created_at, u.updated_at,
        (SELECT COUNT(*) FROM recipes WHERE user_id = u.id) as recipe_count,
        (SELECT COUNT(*) FROM cooking_history WHERE user_id = u.id) as cooking_count,
        (SELECT MAX(cooked_at) FROM cooking_history WHERE user_id = u.id) as last_activity
      FROM users u
      ORDER BY u.created_at DESC
    `).all();

    return { users };
  });

  // ============================================
  // PUT /api/admin/users/:id - Benutzer bearbeiten
  // ============================================
  fastify.put('/users/:id', {
    schema: {
      description: 'Benutzer bearbeiten (Rolle, Status)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
      },
      body: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['user', 'admin'] },
          is_active: { type: 'boolean' },
          display_name: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { role, is_active, display_name } = request.body;

    // Sich selbst nicht degradieren
    if (id === request.user.id && role === 'user') {
      return reply.status(400).send({ error: 'Du kannst dir nicht selbst die Admin-Rechte entziehen.' });
    }

    // Sich selbst nicht sperren
    if (id === request.user.id && is_active === false) {
      return reply.status(400).send({ error: 'Du kannst dich nicht selbst sperren.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return reply.status(404).send({ error: 'Benutzer nicht gefunden.' });
    }

    const updates = [];
    const params = [];

    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (display_name !== undefined) { updates.push('display_name = ?'); params.push(display_name); }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'Keine Änderungen angegeben.' });
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    logAdminAction(request.user.id, 'Benutzer bearbeitet', `${user.username} (ID ${id})`);

    return { message: 'Benutzer aktualisiert.' };
  });

  // ============================================
  // POST /api/admin/users/:id/reset-password
  // ============================================
  fastify.post('/users/:id/reset-password', {
    schema: {
      description: 'Passwort eines Benutzers zurücksetzen',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['new_password'],
        properties: {
          new_password: { type: 'string', minLength: 6 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { new_password } = request.body;

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) {
      return reply.status(404).send({ error: 'Benutzer nicht gefunden.' });
    }

    const passwordHash = await bcrypt.hash(new_password, 12);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(passwordHash, id);

    const targetUser = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
    logAdminAction(request.user.id, 'Passwort zurückgesetzt', `${targetUser?.username || 'Unbekannt'} (ID ${id})`);

    return { message: 'Passwort zurückgesetzt.' };
  });

  // ============================================
  // DELETE /api/admin/users/:id - Benutzer löschen
  // ============================================
  fastify.delete('/users/:id', {
    schema: {
      description: 'Benutzer und alle zugehörigen Daten löschen',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params;

    // Sich selbst nicht löschen
    if (Number(id) === request.user.id) {
      return reply.status(400).send({ error: 'Du kannst dich nicht selbst löschen.' });
    }

    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
    if (!user) {
      return reply.status(404).send({ error: 'Benutzer nicht gefunden.' });
    }

    // Rezeptbilder des Benutzers löschen
    const recipes = db.prepare('SELECT image_url FROM recipes WHERE user_id = ? AND image_url IS NOT NULL').all(id);
    for (const recipe of recipes) {
      try {
        const imgRelative = recipe.image_url.replace('/api/uploads/', '');
        const imgPath = safePath(config.upload.path, imgRelative);
        if (imgPath) unlinkSync(imgPath);
      } catch { /* Bild existiert nicht mehr */ }
    }

    // CASCADE löscht alle verknüpften Daten
    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    logAdminAction(request.user.id, 'Benutzer gelöscht', `${user.username} (ID ${id})`);

    return { message: `Benutzer "${user.username}" und alle Daten gelöscht.` };
  });

  // ============================================
  // GET /api/admin/categories - Globale Kategorien
  // ============================================
  fastify.get('/categories', {
    schema: {
      description: 'Alle Kategorien aller Benutzer',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const categories = db.prepare(`
      SELECT c.*, u.username as owner,
        (SELECT COUNT(*) FROM recipe_categories rc WHERE rc.category_id = c.id) as recipe_count
      FROM categories c
      JOIN users u ON c.user_id = u.id
      ORDER BY c.name
    `).all();

    return { categories };
  });

  // ============================================
  // GET /api/admin/settings - Einstellungen lesen
  // ============================================
  fastify.get('/settings', {
    schema: {
      description: 'Systemeinstellungen abrufen',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};

    // API-Keys maskieren (nur letzte 4 Zeichen zeigen)
    const sensitiveKeys = new Set(['kimi_api_key', 'openai_api_key', 'anthropic_api_key']);
    for (const row of rows) {
      if (sensitiveKeys.has(row.key) && row.value && row.value.length > 4) {
        settings[row.key] = '•'.repeat(row.value.length - 4) + row.value.slice(-4);
      } else {
        settings[row.key] = row.value;
      }
    }
    return { settings };
  });

  // ============================================
  // PUT /api/admin/settings - Einstellungen speichern
  // ============================================
  fastify.put('/settings', {
    schema: {
      description: 'Systemeinstellungen aktualisieren',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          settings: { type: 'object', additionalProperties: { type: 'string' } },
        },
        required: ['settings'],
      },
    },
  }, async (request, reply) => {
    const settings = request.body.settings;

    // Nur erlaubte Keys akzeptieren
    const invalidKeys = Object.keys(settings).filter(k => !ALLOWED_SETTINGS.has(k));
    if (invalidKeys.length) {
      return reply.status(400).send({ error: `Unbekannte Einstellungen: ${invalidKeys.join(', ')}` });
    }

    // Maskierte API-Keys ignorieren (wenn der Wert nur • und 4 Zeichen am Ende hat)
    const sensitiveKeys = new Set(['kimi_api_key', 'openai_api_key', 'anthropic_api_key']);
    const filteredSettings = {};
    for (const [key, value] of Object.entries(settings)) {
      if (sensitiveKeys.has(key) && value && value.startsWith('•')) continue; // Maskiert → nicht überschreiben
      filteredSettings[key] = value;
    }

    const stmt = db.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
    );

    const transaction = db.transaction(() => {
      for (const [key, value] of Object.entries(filteredSettings)) {
        stmt.run(key, String(value));
      }
    });

    transaction();

    // KI-Provider zurücksetzen, wenn sich KI-Einstellungen geändert haben
    const aiKeys = Object.keys(filteredSettings).filter(k => k.startsWith('ai_') || k.endsWith('_api_key') || k.endsWith('_model') || k.endsWith('_base_url'));
    if (aiKeys.length > 0) {
      resetProvider();
    }

    logAdminAction(request.user.id, 'Einstellungen geändert', Object.keys(filteredSettings).join(', '));

    return { message: 'Einstellungen gespeichert.' };
  });

  // ============================================
  // POST /api/admin/cleanup - Verwaiste Bilder aufräumen
  // ============================================
  fastify.post('/cleanup', {
    schema: {
      description: 'Verwaiste Bilder aufräumen',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const uploadsDir = resolve(config.upload.path, 'recipes');
    let files;
    try {
      files = readdirSync(uploadsDir);
    } catch {
      return { cleaned: 0, message: 'Upload-Verzeichnis nicht gefunden.' };
    }

    // Alle in der DB referenzierten Bilder sammeln
    const dbImages = db.prepare("SELECT image_url FROM recipes WHERE image_url IS NOT NULL").all();
    const referencedFiles = new Set(dbImages.map(r => r.image_url.split('/').pop()));

    let cleaned = 0;
    for (const file of files) {
      if (!referencedFiles.has(file)) {
        try {
          unlinkSync(join(uploadsDir, file));
          cleaned++;
        } catch { /* Ignorieren */ }
      }
    }

    logAdminAction(request.user.id, 'Aufräumen durchgeführt', `${cleaned} verwaiste Bilder entfernt`);

    return { cleaned, message: `${cleaned} verwaiste Bilder entfernt.` };
  });

  // ============================================
  // ADMIN EXPORT / IMPORT
  // ============================================

  /**
   * GET /api/admin/export
   * Alle Rezepte aller Benutzer als JSON exportieren
   * ?include_images=true  — Bilder als Base64 einbetten
   * ?user_id=123          — Nur Rezepte eines bestimmten Users
   */
  fastify.get('/export', {
    schema: {
      description: 'Alle Rezepte exportieren (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          include_images: { type: 'boolean', default: false },
          user_id: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const includeImages = request.query.include_images === true || request.query.include_images === 'true';
    const filterUserId = request.query.user_id;

    // Rezepte laden (alle oder gefiltert nach User)
    let recipes;
    if (filterUserId) {
      recipes = db.prepare(`
        SELECT r.*, u.username as author
        FROM recipes r JOIN users u ON r.user_id = u.id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
      `).all(filterUserId);
    } else {
      recipes = db.prepare(`
        SELECT r.*, u.username as author
        FROM recipes r JOIN users u ON r.user_id = u.id
        ORDER BY u.username, r.created_at DESC
      `).all();
    }

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'AI Cookbook (Admin-Export)',
      recipe_count: recipes.length,
      recipes: [],
    };

    for (const recipe of recipes) {
      const categories = db.prepare(`
        SELECT c.name, c.icon, c.color FROM categories c
        JOIN recipe_categories rc ON c.id = rc.category_id
        WHERE rc.recipe_id = ?
      `).all(recipe.id);

      const ingredients = db.prepare(
        'SELECT name, amount, unit, group_name, sort_order, is_optional, notes FROM ingredients WHERE recipe_id = ? ORDER BY group_name, sort_order'
      ).all(recipe.id);

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
        author: recipe.author,
        categories,
        ingredients,
        steps,
      };

      if (includeImages && recipe.image_url) {
        try {
          const relPath = recipe.image_url.replace('/api/uploads/', '');
          const imgPath = safePath(config.upload.path, relPath);
          if (imgPath && existsSync(imgPath)) {
            const imgBuffer = readFileSync(imgPath);
            recipeExport.image_base64 = imgBuffer.toString('base64');
            recipeExport.image_mime = 'image/webp';
          }
        } catch { /* ignorieren */ }
      }

      exportData.recipes.push(recipeExport);
    }

    const suffix = filterUserId ? `-user-${filterUserId}` : '-alle';
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="admin-rezepte-export${suffix}-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  /**
   * POST /api/admin/import
   * Rezepte aus JSON-Datei importieren (Admin)
   * Kann einem bestimmten User zugewiesen werden
   */
  fastify.post('/import', {
    schema: {
      description: 'Rezepte importieren und einem Benutzer zuweisen (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    // JSON-Datei oder Body akzeptieren
    let importData;
    let targetUserId;

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
        } else if (part.fieldname === 'user_id') {
          targetUserId = parseInt(part.value, 10);
        }
      }
    } else {
      importData = request.body?.data || request.body;
      targetUserId = request.body?.user_id;
    }

    if (!importData?.recipes || !Array.isArray(importData.recipes)) {
      return reply.status(400).send({ error: 'Ungültiges Export-Format. Erwartet: { recipes: [...] }' });
    }

    if (importData.recipes.length === 0) {
      return reply.status(400).send({ error: 'Keine Rezepte zum Importieren gefunden.' });
    }

    if (importData.recipes.length > 500) {
      return reply.status(400).send({ error: 'Maximal 500 Rezepte pro Admin-Import erlaubt.' });
    }

    // Ziel-User bestimmen (oder Admin selbst)
    const userId = targetUserId || request.user.id;
    const targetUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return reply.status(404).send({ error: 'Ziel-Benutzer nicht gefunden.' });
    }

    // Kategorien des Ziel-Users laden
    const userCategories = db.prepare('SELECT id, name FROM categories WHERE user_id = ?').all(userId);
    const catMap = new Map(userCategories.map(c => [c.name, c.id]));

    let imported = 0;
    let skipped = 0;
    const errors = [];
    const pendingImages = [];

    const transaction = db.transaction(() => {
      for (const recipe of importData.recipes) {
        try {
          if (!recipe.title) {
            skipped++;
            errors.push('Übersprungen: Rezept ohne Titel');
            continue;
          }

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

          // Bild für spätere Verarbeitung vormerken (Sharp ist async)
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

          // Kategorien zuordnen (max. 20 pro Rezept)
          if (recipe.categories?.length) {
            const cats = recipe.categories.slice(0, 20);
            const insertCat = db.prepare(
              'INSERT OR IGNORE INTO recipe_categories (recipe_id, category_id) VALUES (?, ?)'
            );
            for (const cat of cats) {
              const catName = typeof cat === 'string' ? cat : cat.name;
              let catId = catMap.get(catName);
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

          // Zutaten (max. 200 pro Rezept)
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

          // Schritte (max. 100 pro Rezept)
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

    // Bilder asynchron durch Sharp re-encodieren (validiert echtes Bildformat)
    for (const { recipeId, imgBuffer, imagePath } of pendingImages) {
      try {
        const fullPath = resolve(config.upload.path, imagePath);
        await sharp(imgBuffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toFile(fullPath);
      } catch {
        // Ungültiges Bild – ignorieren
      }
    }

    logAdminAction(request.user.id, 'Rezepte importiert', `${imported} Rezept(e) für ${targetUser.username}`);

    return {
      message: `${imported} Rezept(e) für "${targetUser.username}" importiert, ${skipped} übersprungen.`,
      imported,
      skipped,
      target_user: targetUser.username,
      errors: errors.length ? errors : undefined,
    };
  });

  // ============================================
  // ADMIN VORRATSSCHRANK EXPORT / IMPORT
  // ============================================

  /**
   * GET /api/admin/export/pantry
   * Alle Vorräte aller Benutzer als JSON exportieren
   * ?user_id=123 — Nur Vorräte eines bestimmten Users
   */
  fastify.get('/export/pantry', {
    schema: {
      description: 'Alle Vorräte exportieren (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          user_id: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const filterUserId = request.query.user_id;

    let items;
    if (filterUserId) {
      items = db.prepare(`
        SELECT p.*, u.username as owner
        FROM pantry p JOIN users u ON p.user_id = u.id
        WHERE p.user_id = ?
        ORDER BY u.username, p.category, p.ingredient_name
      `).all(filterUserId);
    } else {
      items = db.prepare(`
        SELECT p.*, u.username as owner
        FROM pantry p JOIN users u ON p.user_id = u.id
        ORDER BY u.username, p.category, p.ingredient_name
      `).all();
    }

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'AI Cookbook (Admin-Export)',
      type: 'pantry',
      item_count: items.length,
      items: items.map(i => ({
        ingredient_name: i.ingredient_name,
        amount: i.amount,
        unit: i.unit,
        category: i.category,
        expiry_date: i.expiry_date,
        notes: i.notes,
        owner: i.owner,
      })),
    };

    const suffix = filterUserId ? `-user-${filterUserId}` : '-alle';
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="admin-vorrat-export${suffix}-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  /**
   * POST /api/admin/import/pantry
   * Vorräte aus JSON importieren und einem Benutzer zuweisen (Admin)
   */
  fastify.post('/import/pantry', {
    schema: {
      description: 'Vorräte importieren und einem Benutzer zuweisen (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    let importData;
    let targetUserId;

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
        } else if (part.fieldname === 'user_id') {
          targetUserId = parseInt(part.value, 10);
        }
      }
    } else {
      importData = request.body?.data || request.body;
      targetUserId = request.body?.user_id;
    }

    if (!importData?.items || !Array.isArray(importData.items)) {
      return reply.status(400).send({ error: 'Ungültiges Export-Format. Erwartet: { items: [...] }' });
    }

    if (importData.items.length === 0) {
      return reply.status(400).send({ error: 'Keine Vorräte zum Importieren gefunden.' });
    }

    if (importData.items.length > 2000) {
      return reply.status(400).send({ error: 'Maximal 2000 Vorräte pro Admin-Import erlaubt.' });
    }

    const userId = targetUserId || request.user.id;
    const targetUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return reply.status(404).send({ error: 'Ziel-Benutzer nicht gefunden.' });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    const findExisting = db.prepare(
      'SELECT * FROM pantry WHERE user_id = ? AND LOWER(ingredient_name) = LOWER(?)'
    );
    const insertItem = db.prepare(
      'INSERT INTO pantry (user_id, ingredient_name, amount, unit, category, expiry_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const updateAmount = db.prepare(
      'UPDATE pantry SET amount = amount + ?, unit = COALESCE(?, unit), category = COALESCE(?, category), expiry_date = COALESCE(?, expiry_date), notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );

    const transaction = db.transaction(() => {
      for (const item of importData.items) {
        try {
          const name = String(item.ingredient_name || item.name || '').trim();
          if (!name) { skipped++; continue; }

          const amount = parseFloat(item.amount) || 0;
          if (amount <= 0) { skipped++; continue; }

          const unit = String(item.unit || 'Stk.').trim();
          const category = String(item.category || 'Sonstiges').trim();
          const expiry_date = item.expiry_date || null;
          const notes = item.notes || null;

          const existing = findExisting.get(userId, name);
          if (existing) {
            updateAmount.run(amount, unit, category, expiry_date, notes, existing.id);
            updated++;
          } else {
            insertItem.run(userId, name, amount, unit, category, expiry_date, notes);
            imported++;
          }
        } catch (err) {
          skipped++;
          errors.push(`Fehler bei "${item.ingredient_name || '?'}": ${err.message}`);
        }
      }
    });

    transaction();

    logAdminAction(request.user.id, 'Vorräte importiert', `${imported} neu, ${updated} aktualisiert für ${targetUser.username}`);

    return {
      message: `${imported} neu importiert, ${updated} aktualisiert, ${skipped} übersprungen für "${targetUser.username}".`,
      imported,
      updated,
      skipped,
      target_user: targetUser.username,
      errors: errors.length ? errors : undefined,
    };
  });

  // ============================================
  // REWE Produkt-Präferenzen Export / Import
  // ============================================

  /**
   * GET /api/admin/export/rewe-preferences
   * Alle REWE Produkt-Präferenzen als JSON exportieren
   * ?user_id=123 — Nur Präferenzen eines bestimmten Users
   */
  fastify.get('/export/rewe-preferences', {
    schema: {
      description: 'REWE Produkt-Präferenzen exportieren (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          user_id: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const filterUserId = request.query.user_id;

    let prefs;
    if (filterUserId) {
      prefs = db.prepare(`
        SELECT rpp.*, u.username as owner
        FROM rewe_product_preferences rpp JOIN users u ON rpp.user_id = u.id
        WHERE rpp.user_id = ?
        ORDER BY u.username, rpp.ingredient_name
      `).all(filterUserId);
    } else {
      prefs = db.prepare(`
        SELECT rpp.*, u.username as owner
        FROM rewe_product_preferences rpp JOIN users u ON rpp.user_id = u.id
        ORDER BY u.username, rpp.ingredient_name
      `).all();
    }

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'AI Cookbook (Admin-Export)',
      type: 'rewe-preferences',
      preference_count: prefs.length,
      preferences: prefs.map(p => ({
        ingredient_name: p.ingredient_name,
        rewe_product_id: p.rewe_product_id,
        rewe_product_name: p.rewe_product_name,
        rewe_price: p.rewe_price,
        rewe_package_size: p.rewe_package_size,
        times_selected: p.times_selected,
        owner: p.owner,
      })),
    };

    const suffix = filterUserId ? `-user-${filterUserId}` : '-alle';
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="admin-rewe-prefs-export${suffix}-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  /**
   * POST /api/admin/import/rewe-preferences
   * REWE Produkt-Präferenzen aus JSON importieren (Admin)
   */
  fastify.post('/import/rewe-preferences', {
    schema: {
      description: 'REWE Produkt-Präferenzen importieren (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    let importData;
    let targetUserId;

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
        } else if (part.fieldname === 'user_id') {
          targetUserId = parseInt(part.value, 10);
        }
      }
    } else {
      importData = request.body?.data || request.body;
      targetUserId = request.body?.user_id;
    }

    if (!importData?.preferences || !Array.isArray(importData.preferences)) {
      return reply.status(400).send({ error: 'Ungültiges Export-Format. Erwartet: { preferences: [...] }' });
    }

    if (importData.preferences.length === 0) {
      return reply.status(400).send({ error: 'Keine Präferenzen zum Importieren gefunden.' });
    }

    if (importData.preferences.length > 5000) {
      return reply.status(400).send({ error: 'Maximal 5000 Präferenzen pro Import erlaubt.' });
    }

    const userId = targetUserId || request.user.id;
    const targetUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return reply.status(404).send({ error: 'Ziel-Benutzer nicht gefunden.' });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    const upsertPref = db.prepare(`
      INSERT INTO rewe_product_preferences (user_id, ingredient_name, rewe_product_id, rewe_product_name, rewe_price, rewe_package_size, times_selected, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, ingredient_name) DO UPDATE SET
        rewe_product_id = excluded.rewe_product_id,
        rewe_product_name = excluded.rewe_product_name,
        rewe_price = excluded.rewe_price,
        rewe_package_size = excluded.rewe_package_size,
        times_selected = excluded.times_selected,
        updated_at = CURRENT_TIMESTAMP
    `);

    const findExisting = db.prepare(
      'SELECT id FROM rewe_product_preferences WHERE user_id = ? AND LOWER(ingredient_name) = LOWER(?)'
    );

    const transaction = db.transaction(() => {
      for (const pref of importData.preferences) {
        try {
          const ingredientName = String(pref.ingredient_name || '').trim();
          if (!ingredientName) { skipped++; continue; }

          const productId = String(pref.rewe_product_id || '').trim();
          if (!productId) { skipped++; continue; }

          const productName = String(pref.rewe_product_name || '').trim();
          const price = pref.rewe_price || null;
          const packageSize = pref.rewe_package_size || null;
          const timesSelected = parseInt(pref.times_selected) || 1;

          const existing = findExisting.get(userId, ingredientName);
          upsertPref.run(userId, ingredientName, productId, productName, price, packageSize, timesSelected);

          if (existing) {
            updated++;
          } else {
            imported++;
          }
        } catch (err) {
          skipped++;
          errors.push(`Fehler bei "${pref.ingredient_name || '?'}": ${err.message}`);
        }
      }
    });

    transaction();

    logAdminAction(request.user.id, 'REWE-Präferenzen importiert', `${imported} neu, ${updated} aktualisiert für ${targetUser.username}`);

    return {
      message: `${imported} neu importiert, ${updated} aktualisiert, ${skipped} übersprungen für "${targetUser.username}".`,
      imported,
      updated,
      skipped,
      target_user: targetUser.username,
      errors: errors.length ? errors : undefined,
    };
  });

  // ============================================
  // Benutzer Export / Import
  // ============================================

  /**
   * GET /api/admin/export/users
   * Alle Benutzerkonten als JSON exportieren (ohne Passwörter)
   */
  fastify.get('/export/users', {
    schema: {
      description: 'Benutzerkonten exportieren (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const users = db.prepare(`
      SELECT id, username, email, display_name, role, is_active, created_at, updated_at
      FROM users
      ORDER BY id
    `).all();

    // Zusatzdaten pro Benutzer sammeln
    const enrichedUsers = users.map(u => {
      const recipeCount = db.prepare('SELECT COUNT(*) as c FROM recipes WHERE user_id = ?').get(u.id).c;
      const pantryCount = db.prepare('SELECT COUNT(*) as c FROM pantry WHERE user_id = ?').get(u.id).c;
      const cookCount = db.prepare('SELECT COUNT(*) as c FROM cooking_history WHERE user_id = ?').get(u.id).c;

      // Bring!-Einstellungen (ohne Passwort)
      const bring = db.prepare('SELECT default_list_uuid, default_list_name FROM bring_settings WHERE user_id = ?').get(u.id);

      return {
        ...u,
        stats: { recipes: recipeCount, pantry_items: pantryCount, times_cooked: cookCount },
        bring_settings: bring ? { default_list_uuid: bring.default_list_uuid, default_list_name: bring.default_list_name } : null,
      };
    });

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'AI Cookbook (Admin-Export)',
      type: 'users',
      user_count: enrichedUsers.length,
      users: enrichedUsers,
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="admin-users-export-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  /**
   * POST /api/admin/import/users
   * Benutzerkonten aus JSON importieren (Admin)
   * Erstellt Konten mit temporärem Passwort
   */
  fastify.post('/import/users', {
    schema: {
      description: 'Benutzerkonten importieren (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
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
      importData = request.body?.data || request.body;
    }

    if (!importData?.users || !Array.isArray(importData.users)) {
      return reply.status(400).send({ error: 'Ungültiges Export-Format. Erwartet: { users: [...] }' });
    }

    if (importData.users.length === 0) {
      return reply.status(400).send({ error: 'Keine Benutzer zum Importieren gefunden.' });
    }

    if (importData.users.length > 500) {
      return reply.status(400).send({ error: 'Maximal 500 Benutzer pro Import erlaubt.' });
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];
    const tempPassword = 'Changeme123!';
    const hashedTempPw = bcrypt.hashSync(tempPassword, 10);

    const insertUser = db.prepare(`
      INSERT INTO users (username, email, display_name, role, is_active, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);

    const checkUsername = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)');
    const checkEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)');

    const transaction = db.transaction(() => {
      for (const user of importData.users) {
        try {
          const username = String(user.username || '').trim();
          const email = String(user.email || '').trim();

          if (!username || !email) {
            skipped++;
            errors.push(`Übersprungen: Benutzername oder E-Mail fehlt.`);
            continue;
          }

          // Doppelten Benutzernamen/E-Mail prüfen
          if (checkUsername.get(username)) {
            skipped++;
            errors.push(`"${username}" existiert bereits.`);
            continue;
          }
          if (checkEmail.get(email)) {
            skipped++;
            errors.push(`E-Mail "${email}" existiert bereits.`);
            continue;
          }

          const displayName = user.display_name || username;
          const role = (user.role === 'admin') ? 'admin' : 'user';
          const isActive = user.is_active !== undefined ? (user.is_active ? 1 : 0) : 1;

          insertUser.run(username, email, displayName, role, isActive, hashedTempPw, user.created_at || null);
          imported++;
        } catch (err) {
          skipped++;
          errors.push(`Fehler bei "${user.username || '?'}": ${err.message}`);
        }
      }
    });

    transaction();

    logAdminAction(request.user.id, 'Benutzer importiert', `${imported} Benutzer importiert`);

    return {
      message: `${imported} Benutzer importiert, ${skipped} übersprungen.`,
      imported,
      skipped,
      temp_password: imported > 0 ? tempPassword : undefined,
      errors: errors.length ? errors : undefined,
    };
  });

  // ============================================
  // Zutaten-Aliase Export / Import
  // ============================================

  /**
   * GET /api/admin/export/ingredient-aliases
   * Alle Zutaten-Aliase als JSON exportieren
   */
  fastify.get('/export/ingredient-aliases', {
    schema: {
      description: 'Zutaten-Aliase exportieren (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          user_id: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const filterUserId = request.query.user_id;

    let aliases;
    if (filterUserId) {
      aliases = db.prepare(`
        SELECT ia.*, u.username as owner
        FROM ingredient_aliases ia JOIN users u ON ia.user_id = u.id
        WHERE ia.user_id = ?
        ORDER BY u.username, ia.canonical_name, ia.alias_name
      `).all(filterUserId);
    } else {
      aliases = db.prepare(`
        SELECT ia.*, u.username as owner
        FROM ingredient_aliases ia JOIN users u ON ia.user_id = u.id
        ORDER BY u.username, ia.canonical_name, ia.alias_name
      `).all();
    }

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'AI Cookbook (Admin-Export)',
      type: 'ingredient-aliases',
      alias_count: aliases.length,
      aliases: aliases.map(a => ({
        canonical_name: a.canonical_name,
        alias_name: a.alias_name,
        owner: a.owner,
      })),
    };

    const suffix = filterUserId ? `-user-${filterUserId}` : '-alle';
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="admin-ingredient-aliases-export${suffix}-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  /**
   * POST /api/admin/import/ingredient-aliases
   * Zutaten-Aliase aus JSON importieren (Admin)
   */
  fastify.post('/import/ingredient-aliases', {
    schema: {
      description: 'Zutaten-Aliase importieren (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    let importData;
    let targetUserId;

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
        } else if (part.fieldname === 'user_id') {
          targetUserId = parseInt(part.value, 10);
        }
      }
    } else {
      importData = request.body?.data || request.body;
      targetUserId = request.body?.user_id;
    }

    if (!importData?.aliases || !Array.isArray(importData.aliases)) {
      return reply.status(400).send({ error: 'Ungültiges Export-Format. Erwartet: { aliases: [...] }' });
    }

    if (importData.aliases.length === 0) {
      return reply.status(400).send({ error: 'Keine Aliase zum Importieren gefunden.' });
    }

    if (importData.aliases.length > 5000) {
      return reply.status(400).send({ error: 'Maximal 5000 Aliase pro Import erlaubt.' });
    }

    const userId = targetUserId || request.user.id;
    const targetUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return reply.status(404).send({ error: 'Ziel-Benutzer nicht gefunden.' });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errorsArr = [];

    const upsertAlias = db.prepare(`
      INSERT INTO ingredient_aliases (user_id, canonical_name, alias_name)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, alias_name) DO UPDATE SET
        canonical_name = excluded.canonical_name
    `);

    const findExisting = db.prepare(
      'SELECT id FROM ingredient_aliases WHERE user_id = ? AND LOWER(alias_name) = LOWER(?)'
    );

    const transaction = db.transaction(() => {
      for (const alias of importData.aliases) {
        try {
          const canonicalName = String(alias.canonical_name || '').trim();
          const aliasName = String(alias.alias_name || '').trim();

          if (!canonicalName || !aliasName) { skipped++; continue; }

          const existing = findExisting.get(userId, aliasName);
          upsertAlias.run(userId, canonicalName, aliasName);

          if (existing) { updated++; } else { imported++; }
        } catch (err) {
          skipped++;
          errorsArr.push(`Fehler bei "${alias.alias_name || '?'}": ${err.message}`);
        }
      }
    });

    transaction();

    logAdminAction(request.user.id, 'Zutaten-Aliase importiert', `${imported} neu, ${updated} aktualisiert für ${targetUser.username}`);

    return {
      message: `${imported} neu importiert, ${updated} aktualisiert, ${skipped} übersprungen für "${targetUser.username}".`,
      imported,
      updated,
      skipped,
      target_user: targetUser.username,
      errors: errorsArr.length ? errorsArr : undefined,
    };
  });

  // ============================================
  // Wochenplan Export/Import (Admin)
  // ============================================

  /**
   * GET /api/admin/export/meal-plans
   * Alle Wochenpläne aller Benutzer als JSON exportieren
   */
  fastify.get('/export/meal-plans', {
    schema: {
      description: 'Alle Wochenpläne exportieren (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: { user_id: { type: 'integer' } },
      },
    },
  }, async (request, reply) => {
    const filterUserId = request.query.user_id;

    let plans;
    if (filterUserId) {
      plans = db.prepare(`
        SELECT mp.*, u.username as owner
        FROM meal_plans mp JOIN users u ON mp.user_id = u.id
        WHERE mp.user_id = ?
        ORDER BY u.username, mp.week_start DESC
      `).all(filterUserId);
    } else {
      plans = db.prepare(`
        SELECT mp.*, u.username as owner
        FROM meal_plans mp JOIN users u ON mp.user_id = u.id
        ORDER BY u.username, mp.week_start DESC
      `).all();
    }

    const planIds = plans.map(p => p.id);
    let entries = [];
    if (planIds.length) {
      entries = db.prepare(`
        SELECT mpe.*, r.title as recipe_title
        FROM meal_plan_entries mpe
        LEFT JOIN recipes r ON mpe.recipe_id = r.id
        WHERE mpe.meal_plan_id IN (${planIds.map(() => '?').join(',')})
        ORDER BY mpe.meal_plan_id, mpe.day_of_week, mpe.meal_type
      `).all(...planIds);
    }

    const plansWithEntries = plans.map(plan => ({
      week_start: plan.week_start,
      created_at: plan.created_at,
      owner: plan.owner,
      entries: entries
        .filter(e => e.meal_plan_id === plan.id)
        .map(e => ({
          recipe_title: e.recipe_title,
          recipe_id: e.recipe_id,
          day_of_week: e.day_of_week,
          meal_type: e.meal_type,
          servings: e.servings,
          is_cooked: e.is_cooked,
        })),
    }));

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'AI Cookbook (Admin-Export)',
      type: 'meal_plans',
      plan_count: plansWithEntries.length,
      plans: plansWithEntries,
    };

    const suffix = filterUserId ? `-user-${filterUserId}` : '-alle';
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="admin-wochenplaene-export${suffix}-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  /**
   * POST /api/admin/import/meal-plans
   * Wochenpläne importieren und einem Benutzer zuweisen (Admin)
   */
  fastify.post('/import/meal-plans', {
    schema: {
      description: 'Wochenpläne importieren (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    let importData;
    let targetUserId;

    const contentType = request.headers['content-type'] || '';
    if (contentType.includes('multipart')) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          try { importData = JSON.parse(buffer.toString('utf-8')); } catch {
            return reply.status(400).send({ error: 'Ungültiges JSON-Format.' });
          }
        } else if (part.fieldname === 'user_id') {
          targetUserId = parseInt(part.value, 10);
        }
      }
    } else {
      importData = request.body?.data || request.body;
      targetUserId = request.body?.user_id;
    }

    if (!importData?.plans || !Array.isArray(importData.plans)) {
      return reply.status(400).send({ error: 'Ungültiges Export-Format. Erwartet: { plans: [...] }' });
    }

    const userId = targetUserId || request.user.id;
    const targetUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
    if (!targetUser) return reply.status(404).send({ error: 'Ziel-Benutzer nicht gefunden.' });

    let imported = 0, skipped = 0, entriesImported = 0;

    const insertPlan = db.prepare('INSERT INTO meal_plans (user_id, week_start) VALUES (?, ?)');
    const insertEntry = db.prepare(
      'INSERT INTO meal_plan_entries (meal_plan_id, recipe_id, day_of_week, meal_type, servings, is_cooked) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const findRecipe = db.prepare('SELECT id FROM recipes WHERE user_id = ? AND LOWER(title) = LOWER(?)');
    const existingPlan = db.prepare('SELECT id FROM meal_plans WHERE user_id = ? AND week_start = ?');

    const transaction = db.transaction(() => {
      for (const plan of importData.plans) {
        if (!plan.week_start) { skipped++; continue; }
        if (existingPlan.get(userId, plan.week_start)) { skipped++; continue; }

        const { lastInsertRowid } = insertPlan.run(userId, plan.week_start);
        const planId = Number(lastInsertRowid);
        imported++;

        if (plan.entries?.length) {
          for (const entry of plan.entries) {
            let recipeId = entry.recipe_id;
            if (entry.recipe_title && !recipeId) {
              const recipe = findRecipe.get(userId, entry.recipe_title);
              if (recipe) recipeId = recipe.id;
            }
            if (!recipeId) continue;
            insertEntry.run(planId, recipeId, entry.day_of_week ?? 0, entry.meal_type || 'mittag', entry.servings || 2, entry.is_cooked ? 1 : 0);
            entriesImported++;
          }
        }
      }
    });
    transaction();

    logAdminAction(request.user.id, 'Wochenpläne importiert', `${imported} Pläne, ${entriesImported} Einträge für ${targetUser.username}`);

    return {
      message: `${imported} Pläne importiert, ${entriesImported} Einträge, ${skipped} übersprungen für "${targetUser.username}".`,
      imported,
      entries_imported: entriesImported,
      skipped,
      target_user: targetUser.username,
    };
  });

  // ============================================
  // Einkaufslisten Export/Import (Admin)
  // ============================================

  /**
   * GET /api/admin/export/shopping-lists
   * Alle Einkaufslisten aller Benutzer als JSON exportieren
   */
  fastify.get('/export/shopping-lists', {
    schema: {
      description: 'Alle Einkaufslisten exportieren (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: { user_id: { type: 'integer' } },
      },
    },
  }, async (request, reply) => {
    const filterUserId = request.query.user_id;

    let lists;
    if (filterUserId) {
      lists = db.prepare(`
        SELECT sl.*, u.username as owner
        FROM shopping_lists sl JOIN users u ON sl.user_id = u.id
        WHERE sl.user_id = ?
        ORDER BY u.username, sl.created_at DESC
      `).all(filterUserId);
    } else {
      lists = db.prepare(`
        SELECT sl.*, u.username as owner
        FROM shopping_lists sl JOIN users u ON sl.user_id = u.id
        ORDER BY u.username, sl.created_at DESC
      `).all();
    }

    const listIds = lists.map(l => l.id);
    let items = [];
    if (listIds.length) {
      items = db.prepare(`
        SELECT sli.*, r.title as recipe_title
        FROM shopping_list_items sli
        LEFT JOIN recipes r ON sli.recipe_id = r.id
        WHERE sli.shopping_list_id IN (${listIds.map(() => '?').join(',')})
        ORDER BY sli.shopping_list_id, sli.ingredient_name
      `).all(...listIds);
    }

    const listsWithItems = lists.map(list => ({
      name: list.name,
      is_active: list.is_active,
      created_at: list.created_at,
      owner: list.owner,
      items: items
        .filter(i => i.shopping_list_id === list.id)
        .map(i => ({
          ingredient_name: i.ingredient_name,
          amount: i.amount,
          unit: i.unit,
          is_checked: i.is_checked,
          recipe_title: i.recipe_title,
          rewe_product_name: i.rewe_product_name,
          rewe_price: i.rewe_price,
        })),
    }));

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'AI Cookbook (Admin-Export)',
      type: 'shopping_lists',
      list_count: listsWithItems.length,
      lists: listsWithItems,
    };

    const suffix = filterUserId ? `-user-${filterUserId}` : '-alle';
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="admin-einkaufslisten-export${suffix}-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  /**
   * POST /api/admin/import/shopping-lists
   * Einkaufslisten importieren und einem Benutzer zuweisen (Admin)
   */
  fastify.post('/import/shopping-lists', {
    schema: {
      description: 'Einkaufslisten importieren (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    let importData;
    let targetUserId;

    const contentType = request.headers['content-type'] || '';
    if (contentType.includes('multipart')) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          try { importData = JSON.parse(buffer.toString('utf-8')); } catch {
            return reply.status(400).send({ error: 'Ungültiges JSON-Format.' });
          }
        } else if (part.fieldname === 'user_id') {
          targetUserId = parseInt(part.value, 10);
        }
      }
    } else {
      importData = request.body?.data || request.body;
      targetUserId = request.body?.user_id;
    }

    if (!importData?.lists || !Array.isArray(importData.lists)) {
      return reply.status(400).send({ error: 'Ungültiges Export-Format. Erwartet: { lists: [...] }' });
    }

    const userId = targetUserId || request.user.id;
    const targetUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
    if (!targetUser) return reply.status(404).send({ error: 'Ziel-Benutzer nicht gefunden.' });

    let imported = 0, itemsImported = 0;

    const insertList = db.prepare('INSERT INTO shopping_lists (user_id, name, is_active) VALUES (?, ?, ?)');
    const insertItem = db.prepare(
      'INSERT INTO shopping_list_items (shopping_list_id, ingredient_name, amount, unit, is_checked) VALUES (?, ?, ?, ?, ?)'
    );

    const transaction = db.transaction(() => {
      for (const list of importData.lists) {
        const name = list.name || `Admin-Import ${new Date().toLocaleDateString('de-DE')}`;
        const { lastInsertRowid } = insertList.run(userId, name, 0);
        const listId = Number(lastInsertRowid);
        imported++;

        if (list.items?.length) {
          for (const item of list.items) {
            if (!item.ingredient_name) continue;
            insertItem.run(listId, item.ingredient_name, item.amount || null, item.unit || null, item.is_checked ? 1 : 0);
            itemsImported++;
          }
        }
      }
    });
    transaction();

    logAdminAction(request.user.id, 'Einkaufslisten importiert', `${imported} Listen, ${itemsImported} Artikel für ${targetUser.username}`);

    return {
      message: `${imported} Listen importiert, ${itemsImported} Artikel für "${targetUser.username}".`,
      imported,
      items_imported: itemsImported,
      target_user: targetUser.username,
    };
  });

  // ============================================
  // Rezept-Sperren Export/Import (Admin)
  // ============================================

  /**
   * GET /api/admin/export/recipe-blocks
   * Alle Rezept-Sperren aller Benutzer als JSON exportieren
   */
  fastify.get('/export/recipe-blocks', {
    schema: {
      description: 'Alle Rezept-Sperren exportieren (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: { user_id: { type: 'integer' } },
      },
    },
  }, async (request, reply) => {
    const filterUserId = request.query.user_id;

    let blocks;
    if (filterUserId) {
      blocks = db.prepare(`
        SELECT rb.*, r.title as recipe_title, u.username as owner
        FROM recipe_blocks rb
        JOIN recipes r ON rb.recipe_id = r.id
        JOIN users u ON rb.user_id = u.id
        WHERE rb.user_id = ?
        ORDER BY u.username, rb.blocked_until ASC
      `).all(filterUserId);
    } else {
      blocks = db.prepare(`
        SELECT rb.*, r.title as recipe_title, u.username as owner
        FROM recipe_blocks rb
        JOIN recipes r ON rb.recipe_id = r.id
        JOIN users u ON rb.user_id = u.id
        ORDER BY u.username, rb.blocked_until ASC
      `).all();
    }

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'AI Cookbook (Admin-Export)',
      type: 'recipe_blocks',
      block_count: blocks.length,
      blocks: blocks.map(b => ({
        recipe_title: b.recipe_title,
        recipe_id: b.recipe_id,
        blocked_until: b.blocked_until,
        reason: b.reason,
        created_at: b.created_at,
        owner: b.owner,
      })),
    };

    const suffix = filterUserId ? `-user-${filterUserId}` : '-alle';
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="admin-rezept-sperren-export${suffix}-${new Date().toISOString().split('T')[0]}.json"`);
    return exportData;
  });

  /**
   * POST /api/admin/import/recipe-blocks
   * Rezept-Sperren importieren und einem Benutzer zuweisen (Admin)
   */
  fastify.post('/import/recipe-blocks', {
    schema: {
      description: 'Rezept-Sperren importieren (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    let importData;
    let targetUserId;

    const contentType = request.headers['content-type'] || '';
    if (contentType.includes('multipart')) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          try { importData = JSON.parse(buffer.toString('utf-8')); } catch {
            return reply.status(400).send({ error: 'Ungültiges JSON-Format.' });
          }
        } else if (part.fieldname === 'user_id') {
          targetUserId = parseInt(part.value, 10);
        }
      }
    } else {
      importData = request.body?.data || request.body;
      targetUserId = request.body?.user_id;
    }

    if (!importData?.blocks || !Array.isArray(importData.blocks)) {
      return reply.status(400).send({ error: 'Ungültiges Export-Format. Erwartet: { blocks: [...] }' });
    }

    const userId = targetUserId || request.user.id;
    const targetUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
    if (!targetUser) return reply.status(404).send({ error: 'Ziel-Benutzer nicht gefunden.' });

    let imported = 0, updated = 0, skipped = 0;

    const findRecipe = db.prepare('SELECT id FROM recipes WHERE user_id = ? AND LOWER(title) = LOWER(?)');
    const findExisting = db.prepare('SELECT id FROM recipe_blocks WHERE user_id = ? AND recipe_id = ?');
    const insertBlock = db.prepare('INSERT INTO recipe_blocks (user_id, recipe_id, blocked_until, reason) VALUES (?, ?, ?, ?)');
    const updateBlock = db.prepare('UPDATE recipe_blocks SET blocked_until = ?, reason = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?');

    const transaction = db.transaction(() => {
      for (const block of importData.blocks) {
        let recipeId = block.recipe_id;
        if (block.recipe_title) {
          const recipe = findRecipe.get(userId, block.recipe_title);
          if (recipe) recipeId = recipe.id;
        }
        if (!recipeId || !block.blocked_until) { skipped++; continue; }

        const existing = findExisting.get(userId, recipeId);
        if (existing) {
          updateBlock.run(block.blocked_until, block.reason || null, existing.id);
          updated++;
        } else {
          insertBlock.run(userId, recipeId, block.blocked_until, block.reason || null);
          imported++;
        }
      }
    });
    transaction();

    logAdminAction(request.user.id, 'Rezept-Sperren importiert', `${imported} neu, ${updated} aktualisiert für ${targetUser.username}`);

    return {
      message: `${imported} neu importiert, ${updated} aktualisiert, ${skipped} übersprungen für "${targetUser.username}".`,
      imported,
      updated,
      skipped,
      target_user: targetUser.username,
    };
  });

  // ============================================
  // Komplett-Backup (SQLite DB Download)
  // ============================================

  /**
   * GET /api/admin/backup/download
   * SQLite-Datenbank als Datei herunterladen
   */
  fastify.get('/backup/download', {
    schema: {
      description: 'Komplette Datenbank als Backup herunterladen (Admin)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const dbPath = config.database.path;
    if (!existsSync(dbPath)) {
      return reply.status(404).send({ error: 'Datenbank-Datei nicht gefunden.' });
    }

    // WAL checkpoint, damit alle Daten in der Hauptdatei sind
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch { /* Ignorieren falls kein WAL-Modus */ }

    const dbBuffer = readFileSync(dbPath);
    const dateStr = new Date().toISOString().split('T')[0];

    logAdminAction(request.user.id, 'Datenbank-Backup heruntergeladen', `${(dbBuffer.length / 1024 / 1024).toFixed(1)} MB`);

    reply.header('Content-Type', 'application/x-sqlite3');
    reply.header('Content-Disposition', `attachment; filename="cookbook-backup-${dateStr}.db"`);
    reply.header('Content-Length', dbBuffer.length);
    return reply.send(dbBuffer);
  });
}
