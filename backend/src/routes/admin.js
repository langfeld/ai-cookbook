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
import { readdirSync, statSync, unlinkSync } from 'fs';
import { resolve, join } from 'path';
import { config } from '../config/env.js';

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
        const imgPath = resolve(config.upload.path, recipe.image_url.replace('/api/uploads/', ''));
        unlinkSync(imgPath);
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
        additionalProperties: { type: 'string' },
      },
    },
  }, async (request) => {
    const settings = request.body;

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
    config: { allowUnauthenticated: true },
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
}
