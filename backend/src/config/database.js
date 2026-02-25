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

// Pfad wird in env.js absolut aufgelöst (relativ zum backend/-Verzeichnis)
const dbPath = config.database.path;

// Verzeichnis für DB-Datei sicherstellen
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Datenbank öffnen mit WAL-Modus für bessere Performance
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Datenbank-Schema initialisieren
 * Erstellt alle Tabellen, falls sie nicht existieren.
 */
export function initializeDatabase() {
  // Pre-Migration: Alte ingredient_icons-Tabelle (aus rollback) durch neue ersetzen
  try {
    const iconColumns = db.prepare("PRAGMA table_info(ingredient_icons)").all().map(c => c.name);
    if (iconColumns.length > 0 && !iconColumns.includes('keyword')) {
      db.exec("DROP TABLE IF EXISTS ingredient_icons");
      console.log('  ↳ Pre-Migration: Alte ingredient_icons-Tabelle entfernt');
    }
  } catch { /* Tabelle existiert noch nicht — OK */ }

  // Migration: is_permanent-Spalte zum Vorratsschrank hinzufügen
  try {
    const pantryColumns = db.prepare("PRAGMA table_info(pantry)").all().map(c => c.name);
    if (pantryColumns.length > 0 && !pantryColumns.includes('is_permanent')) {
      db.exec("ALTER TABLE pantry ADD COLUMN is_permanent INTEGER DEFAULT 0");
      console.log('  ↳ Migration: is_permanent-Spalte zu pantry hinzugefügt');
    }
  } catch { /* Tabelle existiert noch nicht — OK */ }

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
      is_permanent INTEGER DEFAULT 0,       -- Dauerhaft verfügbar (z.B. Wasser, Salz)
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
      recipe_id INTEGER NOT NULL,          -- HINWEIS: NOT NULL kollidiert mit ON DELETE SET NULL,
                                           -- daher wird cooking_history vor Rezept-Löschung explizit bereinigt
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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pantry_user_ingredient ON pantry(user_id, ingredient_name);
    CREATE INDEX IF NOT EXISTS idx_cooking_history_user ON cooking_history(user_id, cooked_at);

    -- ============================================
    -- Systemeinstellungen (Key-Value)
    -- ============================================
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================
    -- Admin-Aktivitätslog
    -- ============================================
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);

    -- ============================================
    -- Zutaten-Icons (Emoji-Mapping)
    -- ============================================
    CREATE TABLE IF NOT EXISTS ingredient_icons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL UNIQUE COLLATE NOCASE,
      emoji TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ingredient_icons_keyword ON ingredient_icons(keyword);

    -- ============================================
    -- REWE Markt-Einstellungen pro User
    -- ============================================
    CREATE TABLE IF NOT EXISTS user_rewe_settings (
      user_id INTEGER PRIMARY KEY,
      market_id TEXT NOT NULL,
      market_name TEXT,
      zip_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- ============================================
    -- REWE Produkt-Präferenzen (merkt sich die manuelle Auswahl)
    -- ============================================
    CREATE TABLE IF NOT EXISTS rewe_product_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      ingredient_name TEXT NOT NULL COLLATE NOCASE,   -- normalisiert (z.B. "butter")
      rewe_product_id TEXT NOT NULL,
      rewe_product_name TEXT NOT NULL,
      rewe_price INTEGER,                             -- Cent, letzter bekannter Preis
      rewe_package_size TEXT,
      times_selected INTEGER DEFAULT 1,               -- wie oft gewählt (Vertrauen)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, ingredient_name)
    );
    CREATE INDEX IF NOT EXISTS idx_rewe_prefs_user ON rewe_product_preferences(user_id);
    CREATE INDEX IF NOT EXISTS idx_rewe_prefs_ingredient ON rewe_product_preferences(user_id, ingredient_name);

    -- ============================================
    -- Sammlungen (Collections)
    -- ============================================
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📁',
      color TEXT DEFAULT '#6366f1',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);

    -- ============================================
    -- Rezept-Sammlungs-Zuordnung (n:m)
    -- ============================================
    CREATE TABLE IF NOT EXISTS recipe_collections (
      recipe_id INTEGER NOT NULL,
      collection_id INTEGER NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (recipe_id, collection_id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_recipe_collections_collection ON recipe_collections(collection_id);
    CREATE INDEX IF NOT EXISTS idx_recipe_collections_recipe ON recipe_collections(recipe_id);

    -- ============================================
    -- Bring! Einkaufslisten-Verbindung
    -- ============================================
    CREATE TABLE IF NOT EXISTS bring_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      email TEXT NOT NULL,
      password_encrypted TEXT NOT NULL,       -- AES-256-GCM verschlüsselt
      default_list_uuid TEXT,                 -- Standard-Bring!-Liste
      default_list_name TEXT,                 -- Name der Liste (zur Anzeige)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- ============================================
    -- Zutaten-Aliase (Zusammenfassung ähnlicher Zutaten)
    -- ============================================
    CREATE TABLE IF NOT EXISTS ingredient_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      canonical_name TEXT NOT NULL COLLATE NOCASE,  -- Der Hauptname (z.B. "Gurke-Mini")
      alias_name TEXT NOT NULL COLLATE NOCASE,       -- Die Variante (z.B. "Gurke Mini")
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, alias_name)
    );
    CREATE INDEX IF NOT EXISTS idx_ingredient_aliases_user ON ingredient_aliases(user_id);
    CREATE INDEX IF NOT EXISTS idx_ingredient_aliases_lookup ON ingredient_aliases(user_id, alias_name);

    -- ============================================
    -- Geblockte Zutaten (für Einkaufslisten-Generierung)
    -- ============================================
    CREATE TABLE IF NOT EXISTS blocked_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      ingredient_name TEXT NOT NULL COLLATE NOCASE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, ingredient_name)
    );
    CREATE INDEX IF NOT EXISTS idx_blocked_ingredients_user ON blocked_ingredients(user_id);

    -- ingredient_conversions entfernt – KI-Aggregation ersetzt zutat-spezifische Umrechnungen
    -- Tabelle wird in migrateDatabase() per DROP TABLE entfernt

    -- ============================================
    -- Rezept-Sperren (für Wochenplanung)
    -- ============================================
    CREATE TABLE IF NOT EXISTS recipe_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipe_id INTEGER NOT NULL,
      blocked_until DATE NOT NULL,           -- Gesperrt bis (Datum)
      reason TEXT,                            -- Optionaler Grund (z.B. "Kein Kürbis verfügbar")
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      UNIQUE(user_id, recipe_id)
    );
    CREATE INDEX IF NOT EXISTS idx_recipe_blocks_user ON recipe_blocks(user_id);
    CREATE INDEX IF NOT EXISTS idx_recipe_blocks_until ON recipe_blocks(user_id, blocked_until);
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

  // Spalte 'recipe_ids' in shopping_list_items hinzufügen (JSON-Array mit Rezept-IDs)
  const sliCols = db.prepare("PRAGMA table_info(shopping_list_items)").all().map(c => c.name);
  if (!sliCols.includes('recipe_ids')) {
    db.exec("ALTER TABLE shopping_list_items ADD COLUMN recipe_ids TEXT DEFAULT '[]'");
    console.log('  ↳ Migration: shopping_list_items.recipe_ids hinzugefügt');
  }

  // Spalte 'rewe_quantity' in shopping_list_items hinzufügen (Anzahl benötigter Packungen)
  if (!sliCols.includes('rewe_quantity')) {
    db.exec("ALTER TABLE shopping_list_items ADD COLUMN rewe_quantity INTEGER DEFAULT 1");
    console.log('  ↳ Migration: shopping_list_items.rewe_quantity hinzugefügt');
  }

  // Spalte 'rewe_image_url' in shopping_list_items hinzufügen (REWE Produktbild-URL)
  if (!sliCols.includes('rewe_image_url')) {
    db.exec("ALTER TABLE shopping_list_items ADD COLUMN rewe_image_url TEXT");
    console.log('  ↳ Migration: shopping_list_items.rewe_image_url hinzugefügt');
  }

  // Spalte 'source' in shopping_list_items hinzufügen (Herkunft: 'recipe', 'manual', 'bring')
  if (!sliCols.includes('source')) {
    db.exec("ALTER TABLE shopping_list_items ADD COLUMN source TEXT DEFAULT 'recipe'");
    // Bestehende Items ohne Rezept-IDs als manuell markieren
    db.exec("UPDATE shopping_list_items SET source = 'manual' WHERE recipe_ids IS NULL OR recipe_ids = '[]'");
    console.log('  ↳ Migration: shopping_list_items.source hinzugefügt');
  }

  // Spalte 'pantry_note' in shopping_list_items hinzufügen
  // (Hinweis bei inkompatiblen Einheiten zwischen Vorrat und Einkaufsliste)
  if (!sliCols.includes('pantry_note')) {
    db.exec("ALTER TABLE shopping_list_items ADD COLUMN pantry_note TEXT");
    console.log('  ↳ Migration: shopping_list_items.pantry_note hinzugefügt');
  }

  // Spalte 'rewe_image_url' in rewe_product_preferences hinzufügen
  const rppCols = db.prepare("PRAGMA table_info(rewe_product_preferences)").all().map(c => c.name);
  if (!rppCols.includes('rewe_image_url')) {
    db.exec("ALTER TABLE rewe_product_preferences ADD COLUMN rewe_image_url TEXT");
    console.log('  ↳ Migration: rewe_product_preferences.rewe_image_url hinzugefügt');
  }

  // Spalte 'reasoning' in meal_plans hinzufügen (KI-/Algorithmus-Begründung)
  const mpCols = db.prepare("PRAGMA table_info(meal_plans)").all().map(c => c.name);
  if (!mpCols.includes('reasoning')) {
    db.exec("ALTER TABLE meal_plans ADD COLUMN reasoning TEXT");
    console.log('  ↳ Migration: meal_plans.reasoning hinzugefügt');
  }

  // Spalte 'is_locked' in meal_plans hinzufügen (Woche fixieren)
  if (!mpCols.includes('is_locked')) {
    db.exec("ALTER TABLE meal_plans ADD COLUMN is_locked INTEGER DEFAULT 0");
    console.log('  ↳ Migration: meal_plans.is_locked hinzugefügt');
  }

  // Standard-Zutaten-Icons seeden (nur wenn Tabelle leer)
  const iconsCount = db.prepare("SELECT COUNT(*) as count FROM ingredient_icons").get().count;
  if (iconsCount === 0) {
    const defaultIcons = [
      // Gemüse
      ['tomate', '🍅'], ['kartoffel', '🥔'], ['karotte', '🥕'], ['möhre', '🥕'],
      ['zwiebel', '🧅'], ['knoblauch', '🧄'], ['paprika', '🫑'], ['gurke', '🥒'],
      ['brokkoli', '🥦'], ['mais', '🌽'], ['pilz', '🍄'], ['champignon', '🍄'],
      ['salat', '🥬'], ['spinat', '🥬'], ['aubergine', '🍆'], ['avocado', '🥑'],
      ['erbse', '🫛'], ['bohne', '🫘'], ['chili', '🌶️'], ['ingwer', '🫚'],
      ['olive', '🫒'], ['zucchini', '🥒'], ['kürbis', '🎃'], ['sellerie', '🥬'],
      ['lauch', '🧅'], ['fenchel', '🌿'], ['radieschen', '🔴'], ['rote bete', '🟣'],
      // Obst
      ['apfel', '🍎'], ['birne', '🍐'], ['orange', '🍊'], ['zitrone', '🍋'],
      ['limette', '🍋'], ['banane', '🍌'], ['erdbeere', '🍓'], ['kirsche', '🍒'],
      ['traube', '🍇'], ['weintraube', '🍇'], ['wassermelone', '🍉'], ['pfirsich', '🍑'],
      ['ananas', '🍍'], ['mango', '🥭'], ['kiwi', '🥝'], ['blaubeere', '🫐'],
      ['heidelbeere', '🫐'], ['himbeere', '🍓'], ['kokosnuss', '🥥'], ['pflaume', '🟣'],
      // Fleisch & Fisch
      ['fleisch', '🥩'], ['rindfleisch', '🥩'], ['schweinefleisch', '🥩'],
      ['hähnchen', '🍗'], ['huhn', '🍗'], ['hühnchen', '🍗'], ['pute', '🍗'],
      ['speck', '🥓'], ['schinken', '🥓'], ['wurst', '🌭'], ['hackfleisch', '🥩'],
      ['fisch', '🐟'], ['lachs', '🐟'], ['thunfisch', '🐟'], ['garnele', '🦐'],
      ['shrimp', '🦐'], ['muschel', '🦪'], ['tintenfisch', '🦑'],
      // Milchprodukte & Eier
      ['ei', '🥚'], ['eier', '🥚'], ['butter', '🧈'], ['käse', '🧀'],
      ['milch', '🥛'], ['sahne', '🥛'], ['joghurt', '🥛'], ['quark', '🥛'],
      ['schmand', '🥛'], ['frischkäse', '🧀'], ['parmesan', '🧀'], ['mozzarella', '🧀'],
      // Getreide & Backwaren
      ['brot', '🍞'], ['brötchen', '🍞'], ['toast', '🍞'], ['reis', '🍚'],
      ['nudel', '🍝'], ['pasta', '🍝'], ['spaghetti', '🍝'], ['mehl', '🌾'],
      ['haferflocken', '🌾'], ['couscous', '🌾'], ['semmel', '🍞'], ['tortilla', '🫓'],
      ['croissant', '🥐'], ['brezel', '🥨'], ['pfannkuchen', '🥞'],
      // Gewürze & Saucen
      ['salz', '🧂'], ['pfeffer', '🧂'], ['zucker', '🍬'], ['honig', '🍯'],
      ['senf', '🟡'], ['ketchup', '🍅'], ['sojasauce', '🥫'], ['essig', '🫙'],
      ['basilikum', '🌿'], ['petersilie', '🌿'], ['oregano', '🌿'], ['thymian', '🌿'],
      ['rosmarin', '🌿'], ['dill', '🌿'], ['koriander', '🌿'], ['zimt', '🟤'],
      ['curry', '🟡'], ['paprikapulver', '🟠'], ['muskat', '🟤'], ['vanille', '🟡'],
      // Nüsse & Öle
      ['nuss', '🥜'], ['walnuss', '🥜'], ['mandel', '🥜'], ['erdnuss', '🥜'],
      ['haselnuss', '🥜'], ['cashew', '🥜'], ['pistazie', '🥜'],
      ['olivenöl', '🫒'], ['öl', '🫒'], ['sonnenblumenöl', '🌻'],
      // Getränke
      ['wasser', '💧'], ['wein', '🍷'], ['weißwein', '🍷'], ['rotwein', '🍷'],
      ['bier', '🍺'], ['kaffee', '☕'], ['tee', '🍵'], ['saft', '🧃'],
      // Sonstiges
      ['schokolade', '🍫'], ['kakao', '🍫'], ['tofu', '🟨'], ['hefe', '🟡'],
      ['gelatine', '🟡'], ['tomatenmark', '🍅'], ['kokosmilch', '🥥'],
    ];
    const stmt = db.prepare("INSERT OR IGNORE INTO ingredient_icons (keyword, emoji) VALUES (?, ?)");
    const insertMany = db.transaction((icons) => {
      for (const [keyword, emoji] of icons) {
        stmt.run(keyword, emoji);
      }
    });
    insertMany(defaultIcons);
    console.log(`  ↳ Migration: ${defaultIcons.length} Standard-Zutaten-Icons erstellt`);
  }

  // Spalte 'rewe_matched_by' in shopping_list_items hinzufügen (Matching-Methode: 'ai' oder 'fallback')
  const sliColsLatest = db.prepare("PRAGMA table_info(shopping_list_items)").all().map(c => c.name);
  if (!sliColsLatest.includes('rewe_matched_by')) {
    db.exec("ALTER TABLE shopping_list_items ADD COLUMN rewe_matched_by TEXT");
    console.log('  ↳ Migration: shopping_list_items.rewe_matched_by hinzugefügt');
  }

  // ingredient_conversions Tabelle entfernen (nicht mehr benötigt – KI-Aggregation ersetzt zutat-spezifische Umrechnungen)
  try {
    db.exec("DROP TABLE IF EXISTS ingredient_conversions");
    console.log('  ↳ Migration: ingredient_conversions Tabelle entfernt');
  } catch { /* Tabelle existiert möglicherweise nicht */ }
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
