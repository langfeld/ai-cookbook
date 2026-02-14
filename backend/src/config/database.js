/**
 * ============================================
 * Datenbank-Konfiguration (SQLite)
 * ============================================
 * Verwendet better-sqlite3 für synchrone, performante SQLite-Zugriffe.
 * Die Datenbank wird beim ersten Start automatisch erstellt.
 */

import Database from 'better-sqlite3';
import { config } from './env.js';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// Verzeichnis für DB-Datei sicherstellen
const dbDir = dirname(config.database.path);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Datenbank öffnen mit WAL-Modus für bessere Performance
const db = new Database(config.database.path);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Datenbank-Schema initialisieren
 * Erstellt alle Tabellen, falls sie nicht existieren.
 */
export function initializeDatabase() {
  db.exec(`
    -- ============================================
    -- Benutzer-Tabelle
    -- ============================================
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      role TEXT DEFAULT 'user',            -- 'user' oder 'admin'
      is_active INTEGER DEFAULT 1,         -- Gesperrt?
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================
    -- Kategorien (frei anlegbar)
    -- ============================================
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '🍽️',
      color TEXT DEFAULT '#6366f1',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- ============================================
    -- Rezepte
    -- ============================================
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      servings INTEGER DEFAULT 4,
      prep_time INTEGER DEFAULT 0,        -- Vorbereitungszeit in Minuten
      cook_time INTEGER DEFAULT 0,        -- Kochzeit in Minuten
      total_time INTEGER DEFAULT 0,       -- Gesamtzeit in Minuten
      difficulty TEXT DEFAULT 'mittel',   -- leicht, mittel, schwer
      image_url TEXT,                      -- Pfad zum Rezeptbild
      source_url TEXT,                     -- Originalquelle (falls importiert)
      is_favorite INTEGER DEFAULT 0,       -- Favorit?
      times_cooked INTEGER DEFAULT 0,      -- Wie oft gekocht
      last_cooked_at DATETIME,             -- Wann zuletzt gekocht
      ai_generated INTEGER DEFAULT 0,      -- Von KI erstellt?
      notes TEXT,                           -- Persönliche Notizen
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- ============================================
    -- Rezept-Kategorie Zuordnung (n:m)
    -- ============================================
    CREATE TABLE IF NOT EXISTS recipe_categories (
      recipe_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      PRIMARY KEY (recipe_id, category_id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    -- ============================================
    -- Zutaten eines Rezepts
    -- ============================================
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      amount REAL,                         -- Menge (z.B. 500)
      unit TEXT,                           -- Einheit (z.B. g, ml, Stück)
      group_name TEXT,                     -- Gruppe (z.B. "Für die Sauce")
      sort_order INTEGER DEFAULT 0,
      is_optional INTEGER DEFAULT 0,       -- Optional?
      notes TEXT,                           -- Anmerkungen (z.B. "alternativ Hafermilch")
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );

    -- ============================================
    -- Kochschritte
    -- ============================================
    CREATE TABLE IF NOT EXISTS cooking_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      step_number INTEGER NOT NULL,
      title TEXT,                           -- Titel des Schritts (z.B. "Vorbereitung")
      instruction TEXT NOT NULL,
      duration_minutes INTEGER,             -- Geschätzte Dauer
      image_url TEXT,                       -- Optionales Bild zum Schritt
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );

    -- ============================================
    -- Wochenplan
    -- ============================================
    CREATE TABLE IF NOT EXISTS meal_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      week_start DATE NOT NULL,            -- Montag der Woche
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- ============================================
    -- Wochenplan-Einträge (einzelne Mahlzeiten)
    -- ============================================
    CREATE TABLE IF NOT EXISTS meal_plan_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_plan_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,        -- 0=Mo, 1=Di, ... 6=So
      meal_type TEXT NOT NULL,             -- fruehstueck, mittag, abendessen, snack
      servings INTEGER DEFAULT 4,          -- Portionen für diesen Eintrag
      is_cooked INTEGER DEFAULT 0,         -- Schon gekocht?
      FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );

    -- ============================================
    -- Einkaufsliste
    -- ============================================
    CREATE TABLE IF NOT EXISTS shopping_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      meal_plan_id INTEGER,                -- Optional: Verknüpfung zum Wochenplan
      name TEXT DEFAULT 'Einkaufsliste',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE SET NULL
    );

    -- ============================================
    -- Einkaufslisten-Einträge
    -- ============================================
    CREATE TABLE IF NOT EXISTS shopping_list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shopping_list_id INTEGER NOT NULL,
      ingredient_name TEXT NOT NULL,
      amount REAL,
      unit TEXT,
      is_checked INTEGER DEFAULT 0,        -- Abgehakt?
      recipe_id INTEGER,                   -- Aus welchem Rezept?
      rewe_product_id TEXT,                -- REWE Produkt-ID
      rewe_product_name TEXT,              -- REWE Produktname
      rewe_price REAL,                     -- REWE Preis
      rewe_package_size TEXT,              -- Packungsgröße bei REWE
      pantry_deducted REAL DEFAULT 0,      -- Bereits aus Vorrat abgezogen
      FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
    );

    -- ============================================
    -- Vorratsschrank
    -- ============================================
    CREATE TABLE IF NOT EXISTS pantry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      ingredient_name TEXT NOT NULL,
      amount REAL NOT NULL,
      unit TEXT,
      category TEXT DEFAULT 'Sonstiges',   -- Lebensmittelkategorie
      expiry_date DATE,                     -- Ablaufdatum (optional)
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- ============================================
    -- Kochhistorie
    -- ============================================
    CREATE TABLE IF NOT EXISTS cooking_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      cooked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      servings INTEGER,
      rating INTEGER,                      -- 1-5 Sterne Bewertung
      notes TEXT,                           -- Notizen zum Kochen
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
    );

    -- ============================================
    -- Indizes für Performance
    -- ============================================
    CREATE INDEX IF NOT EXISTS idx_recipes_user ON recipes(user_id);
    CREATE INDEX IF NOT EXISTS idx_recipes_favorite ON recipes(user_id, is_favorite);
    CREATE INDEX IF NOT EXISTS idx_recipes_last_cooked ON recipes(user_id, last_cooked_at);
    CREATE INDEX IF NOT EXISTS idx_ingredients_recipe ON ingredients(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_cooking_steps_recipe ON cooking_steps(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_meal_plan_entries_plan ON meal_plan_entries(meal_plan_id);
    CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON shopping_list_items(shopping_list_id);
    CREATE INDEX IF NOT EXISTS idx_pantry_user ON pantry(user_id);
    CREATE INDEX IF NOT EXISTS idx_cooking_history_user ON cooking_history(user_id, cooked_at);

    -- ============================================
    -- Systemeinstellungen (Key-Value)
    -- ============================================
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================
  // Migrationen für bestehende Datenbanken
  // ============================================
  migrateDatabase();

  console.log('✅ Datenbank-Schema initialisiert');
}

/**
 * Inkrementelle Migrationen für bestehende DBs
 */
function migrateDatabase() {
  // Spalte 'role' in users hinzufügen (falls nicht vorhanden)
  const userColumns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!userColumns.includes('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
    console.log('  ↳ Migration: users.role hinzugefügt');
  }
  if (!userColumns.includes('is_active')) {
    db.exec("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1");
    console.log('  ↳ Migration: users.is_active hinzugefügt');
  }

  // Standard-Einstellungen setzen (falls leer)
  const settingsCount = db.prepare("SELECT COUNT(*) as count FROM settings").get().count;
  if (settingsCount === 0) {
    const defaults = {
      registration_enabled: 'true',
      ai_provider: 'kimi',
      max_upload_size: '10',
      maintenance_mode: 'false',
    };
    const stmt = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
    for (const [key, value] of Object.entries(defaults)) {
      stmt.run(key, value);
    }
    console.log('  ↳ Migration: Standard-Einstellungen erstellt');
  }

  // Migration: max_upload_size_mb → max_upload_size umbenennen
  const oldKey = db.prepare("SELECT value FROM settings WHERE key = 'max_upload_size_mb'").get();
  if (oldKey) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('max_upload_size', ?)").run(oldKey.value);
    db.prepare("DELETE FROM settings WHERE key = 'max_upload_size_mb'").run();
    console.log('  ↳ Migration: max_upload_size_mb → max_upload_size umbenannt');
  }
}

/**
 * Standard-Kategorien für neue Benutzer anlegen
 */
export function createDefaultCategories(userId) {
  const defaultCategories = [
    { name: 'Frühstück', icon: '🌅', color: '#f59e0b', sort_order: 1 },
    { name: 'Mittagessen', icon: '☀️', color: '#10b981', sort_order: 2 },
    { name: 'Abendessen', icon: '🌙', color: '#6366f1', sort_order: 3 },
    { name: 'Snack', icon: '🍿', color: '#ec4899', sort_order: 4 },
    { name: 'Dessert', icon: '🍰', color: '#f43f5e', sort_order: 5 },
    { name: 'Getränke', icon: '🥤', color: '#06b6d4', sort_order: 6 },
  ];

  const stmt = db.prepare(
    'INSERT INTO categories (user_id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)'
  );

  for (const cat of defaultCategories) {
    stmt.run(userId, cat.name, cat.icon, cat.color, cat.sort_order);
  }
}

export default db;
