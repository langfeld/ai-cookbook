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
import { createDefaultCategories } from '../config/database.js';
import { readdirSync, statSync, unlinkSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { config } from '../config/env.js';
import { safePath, generateId } from '../utils/helpers.js';

// Erlaubte Einstellungs-Keys (verhindert Injection beliebiger Keys)
const ALLOWED_SETTINGS = new Set([
  'registration_enabled',
  'ai_provider',
  'max_upload_size',
  'maintenance_mode',
]);

export default async function adminRoutes(fastify) {

  // ============================================
  // Alle Admin-Routen erfordern Admin-Rolle
  // /seed ist ausgenommen (prüft selbst)
  // ============================================
  fastify.addHook('onRequest', async function (request, reply) {
    // Seed-Route überspringen (erlaubt unauthentifierten Zugriff)
    if (request.url.includes('/admin/seed') && request.method === 'POST') return;
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

    return {
      users: { total: userCount, active: activeUserCount },
      recipes: { total: recipeCount, ai_generated: aiRecipeCount },
      meal_plans: mealPlanCount,
      shopping_lists: shoppingListCount,
      pantry_items: pantryItemCount,
      cooking_sessions: cookingCount,
      popular_recipes: popularRecipes,
      recent_users: recentUsers,
      week_activity: weekActivity,
      database_size_bytes: dbSize?.size || 0,
    };
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
    for (const row of rows) {
      settings[row.key] = row.value;
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

    const stmt = db.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
    );

    const transaction = db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        stmt.run(key, String(value));
      }
    });

    transaction();

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

    return { cleaned, message: `${cleaned} verwaiste Bilder entfernt.` };
  });

  // ============================================
  // POST /api/admin/seed - Ersten Admin erstellen
  // ============================================
  fastify.post('/seed', {
    config: {
      rateLimit: { max: 3, timeWindow: '1 hour' },
      allowUnauthenticated: true,
    },
    schema: {
      description: 'Erstellt den ersten Admin-Account (nur wenn keine Admins existieren)',
      tags: ['Admin'],
    },
  }, async (request, reply) => {
    // Hook überspringen für diese Route
    // Prüfen ob bereits ein Admin existiert
    const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
    if (existingAdmin) {
      return reply.status(400).send({ error: 'Es existiert bereits ein Administrator.' });
    }

    const passwordHash = await bcrypt.hash('admin123', 12);
    const result = db.prepare(
      "INSERT INTO users (username, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)"
    ).run('admin', 'admin@cookbook.local', passwordHash, 'Administrator', 'admin');

    createDefaultCategories(result.lastInsertRowid);

    return {
      message: 'Admin-Account erstellt!',
      credentials: {
        username: 'admin',
        password: 'admin123',
        hint: 'Bitte Passwort nach dem ersten Login ändern!',
      },
    };
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

          // Bild aus Base64 wiederherstellen
          if (recipe.image_base64) {
            try {
              const imgBuffer = Buffer.from(recipe.image_base64, 'base64');
              const imageId = generateId();
              const imagePath = `recipes/${imageId}.webp`;
              const fullPath = resolve(config.upload.path, imagePath);
              writeFileSync(fullPath, imgBuffer);
              db.prepare('UPDATE recipes SET image_url = ? WHERE id = ?').run(`/api/uploads/${imagePath}`, recipeId);
            } catch { /* ignorieren */ }
          }

          // Kategorien zuordnen
          if (recipe.categories?.length) {
            const insertCat = db.prepare(
              'INSERT OR IGNORE INTO recipe_categories (recipe_id, category_id) VALUES (?, ?)'
            );
            for (const cat of recipe.categories) {
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

          // Zutaten
          if (recipe.ingredients?.length) {
            const insertIng = db.prepare(`
              INSERT INTO ingredients (recipe_id, name, amount, unit, group_name, sort_order, is_optional, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            recipe.ingredients.forEach((ing, idx) => {
              insertIng.run(recipeId, ing.name, ing.amount || null, ing.unit || null, ing.group_name || null, ing.sort_order ?? idx, ing.is_optional ? 1 : 0, ing.notes || null);
            });
          }

          // Schritte
          if (recipe.steps?.length) {
            const insertStep = db.prepare(`
              INSERT INTO cooking_steps (recipe_id, step_number, title, instruction, duration_minutes)
              VALUES (?, ?, ?, ?, ?)
            `);
            recipe.steps.forEach((step, idx) => {
              insertStep.run(recipeId, step.step_number ?? idx + 1, step.title || null, step.instruction, step.duration_minutes || null);
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

    return {
      message: `${imported} Rezept(e) für "${targetUser.username}" importiert, ${skipped} übersprungen.`,
      imported,
      skipped,
      target_user: targetUser.username,
      errors: errors.length ? errors : undefined,
    };
  });
}
