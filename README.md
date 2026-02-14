# AI Cookbook 🍳🤖

Eine KI-gestützte Rezeptverwaltung mit intelligentem Wochenplaner, Einkaufsliste und REWE-Integration.

![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

---

## ✨ Features

### 🥘 Rezeptverwaltung
- **KI-Foto-Import** — Rezepte per Foto importieren (auch mehrseitige Rezeptkarten). Die KI erkennt Zutaten, Kochschritte, Schwierigkeitsgrad und schlägt Kategorien vor
- **Text-Import** — Rezept als Freitext beschreiben, die KI strukturiert es
- **Bildzuschnitt** — Integrierter Cropper mit Seitenverhältnissen (4:3, 1:1, 16:9, Frei) und Drehen
- **Kategorien** — Frei anlegbare Kategorien mit Icons und Farben
- **Farbige Zutatenerkennung** — Zutaten werden in Kochschritten farblich hervorgehoben (Fleisch 🔴, Gemüse 🟢, Milch 🔵, Gewürze 🟡)
- **Portionsrechner** — Zutatenmengen dynamisch umrechnen
- **Kochhistorie** — Protokoll, wann welches Rezept zuletzt gekocht wurde
- **Favoriten** — Lieblingsrezepte markieren und filtern

### 📅 Wochenplaner
- **KI-optimierte Planung** — Berücksichtigt Kochhistorie, Rezeptvielfalt und Zutatensynergien
- **4 Mahlzeiten/Tag** — Frühstück, Mittag, Abendessen, Snack
- **Horizontal scrollbares 7-Tage-Raster** — Auch auf Mobile voll nutzbar

### 🛒 Einkaufsliste
- **Automatisch generiert** — Aus dem Wochenplan, gruppiert nach Abteilungen
- **Vorratsabgleich** — Vorhandene Vorräte werden abgezogen
- **REWE-Integration** — Produktzuordnung und Preisanzeige
- **Fortschrittsbalken** — Visueller Einkaufsfortschritt
- **Einkauf abschließen** → Gekaufte Artikel landen im Vorratsschrank

### 🏪 Vorratsschrank
- **Kategorie-Gruppierung** — Übersichtlich nach Lebensmittelgruppen
- **Ablaufdaten** — MHD-Tracking mit Warnungen bei bald ablaufenden Artikeln
- **Verbrauchsfunktion** — Teilmengen entnehmen
- **Automatischer Nachschub** — Überschüsse aus Einkäufen werden erfasst

### 🎨 Design & UX
- **Dark Mode / Light Mode** — Umschaltbar, klassenbasiert
- **Voll Responsiv** — Mobile-Sidebar als Overlay-Drawer, horizontaler Scroll für Wochenplaner, adaptive Grids
- **Tailwind CSS 4** — Native CSS mit Custom Properties, kein `@apply`
- **Animierte Übergänge** — Vue `<Transition>` für Seitenwechsel und Modals
- **Deutsche Fehlermeldungen** — Nutzerfreundliche Hinweise bei Netzwerk-/API-Fehlern

### 🛡️ Admin-Bereich
- **Dashboard** — Systemstatistiken (Benutzer, Rezepte, KI-Imports, Speicherverbrauch), beliebteste Rezepte, Admin-Aktivitätslog
- **Benutzerverwaltung** — Alle Benutzer anzeigen/suchen, Rollen ändern (Admin/User), Konten sperren/entsperren, Passwort zurücksetzen, Benutzer löschen
- **Systemeinstellungen** — Registrierung aktivieren/deaktivieren, Wartungsmodus, KI-Anbieter wählen, Upload-Größe konfigurieren
- **Datei-Bereinigung** — Verwaiste Upload-Dateien automatisch erkennen und entfernen
- **Aktivitätslog** — Alle Admin-Aktionen werden protokolliert (Wer hat was wann gemacht?)

---

## 🛠 Technologie-Stack

| Komponente | Technologie | Version |
|-----------|-------------|---------|
| **Frontend** | Vue 3 + Vite + Pinia + Vue Router | 3.5 / 6.x / 2.3 / 4.5 |
| **Styling** | Tailwind CSS 4 (`@theme`, `@custom-variant`) | 4.x |
| **Icons** | Lucide Vue Next | 0.468 |
| **Bildzuschnitt** | vue-advanced-cropper | 2.8 |
| **Backend** | Fastify + Node.js 22 | 5.2 / 22.x |
| **Datenbank** | SQLite (better-sqlite3, WAL-Modus) | 11.7 |
| **Bildverarbeitung** | Sharp (Resize, WebP-Konvertierung) | 0.33 |
| **KI-Provider** | Kimi K2.5 (Moonshot AI) — austauschbar | — |
| **Auth** | JWT (@fastify/jwt + bcryptjs) | — |
| **Container** | Docker + Docker Compose + Nginx | — |

---

## 🚀 Schnellstart

### Voraussetzungen
- **Node.js 22+** (für lokale Entwicklung) oder **Docker + Docker Compose**
- Ein API-Key für Kimi/Moonshot AI (oder einen anderen KI-Provider)

### Installation (Docker)

```bash
# Repository klonen
git clone <repo-url> ai-cookbook
cd ai-cookbook

# Umgebungsvariablen konfigurieren
cp .env.example .env
# .env bearbeiten: JWT_SECRET und KIMI_API_KEY eintragen

# Container starten
docker compose up -d
```

Erreichbar unter **http://localhost:8080**

### Lokale Entwicklung (ohne Docker)

```bash
# Umgebungsvariablen konfigurieren
cp .env.example .env
# .env bearbeiten: JWT_SECRET und KIMI_API_KEY eintragen

# Backend starten
cd backend
npm install
npm run dev          # → http://localhost:3001

# Frontend starten (neues Terminal)
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

> **Hinweis:** Das Backend lädt `.env` über `--env-file=../.env` (Node 22 nativ, kein dotenv nötig).

### 🛡️ Admin-Account einrichten

Beim **ersten Start** existiert kein Administrator. So wird der initiale Admin-Account erstellt:

```bash
# 1. Backend muss laufen, dann:
curl -X POST http://localhost:3001/api/admin/seed
```

**Antwort:**
```json
{
  "message": "Admin-Account erstellt!",
  "credentials": {
    "username": "admin",
    "password": "admin123",
    "hint": "Bitte Passwort nach dem ersten Login ändern!"
  }
}
```

**Ablauf bei frischem Start:**
1. App starten (Backend + Frontend)
2. `POST /api/admin/seed` aufrufen → Erstellt Admin-Account (`admin` / `admin123`)
3. Im Browser anmelden unter `http://localhost:5173/login`
4. In der Sidebar erscheint der **Admin-Bereich** (Shield-Icon)
5. Unter **Admin → Benutzer** das eigene Passwort über „Passwort zurücksetzen" ändern
6. Optional: Registrierung und andere Einstellungen unter **Admin → Einstellungen** konfigurieren

> **Sicherheit:** Die Seed-Route funktioniert **nur**, wenn noch kein Admin existiert. Bei einem erneuten Aufruf wird `400 Es existiert bereits ein Administrator` zurückgegeben.

---

## 📁 Projektstruktur

```
ai-cookbook/
├── .env.example                # Umgebungsvariablen-Vorlage
├── docker-compose.yml          # 3-Service-Compose (Backend, Frontend, Nginx)
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js           # Fastify Server + Plugin-Registrierung
│       ├── config/
│       │   ├── env.js          # Zentrale Config aus Umgebungsvariablen
│       │   ├── database.js     # SQLite-Initialisierung (WAL, FK, CASCADE)
│       │   └── migrate.js      # DB-Migrationen
│       ├── plugins/            # Fastify-Plugins (Auth, CORS, Static)
│       ├── routes/
│       │   ├── auth.js         # Registrierung, Login, Token-Refresh
│       │   ├── recipes.js      # CRUD + Foto-Import + Text-Import
│       │   ├── categories.js   # Kategorien CRUD
│       │   ├── mealplan.js     # Wochenplaner + KI-Generierung
│       │   ├── shopping.js     # Einkaufsliste + REWE-Matching
│       │   ├── pantry.js       # Vorratsschrank CRUD + Verbrauch
│       │   ├── rewe.js         # REWE Produktsuche
│       │   └── admin.js        # Admin: Stats, Benutzerverwaltung, Settings, Logs
│       ├── services/
│       │   ├── ai/
│       │   │   ├── base.js     # BaseAIProvider (Chat, JSON-Parse, Bildanalyse)
│       │   │   ├── kimi.js     # Kimi K2.5 Provider (api.moonshot.ai)
│       │   │   └── index.js    # Provider-Factory
│       │   └── recipe-parser.js # Multi-Bild-Rezeptanalyse (max 16384 Tokens)
│       └── utils/
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js          # Vite 6 + @vitejs/plugin-vue + @tailwindcss/vite
│   └── src/
│       ├── main.js             # App-Einstieg + Pinia + Router
│       ├── App.vue             # Layout-Shell (Sidebar, Header, Transition)
│       ├── assets/styles/
│       │   └── main.css        # Tailwind 4 (@theme, @custom-variant dark)
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppSidebar.vue     # Responsive: Desktop static, Mobile overlay
│       │   │   ├── AppHeader.vue      # Suche, Theme-Toggle, Benutzermenü
│       │   │   ├── ThemeToggle.vue    # Dark/Light Mode Umschalter
│       │   │   └── NotificationToast.vue
│       │   ├── ui/
│       │   │   ├── ConfirmDialog.vue  # Wiederverwendbarer Bestätigungsdialog
│       │   │   └── ImageCropModal.vue # Bildzuschnitt mit Seitenverhältnissen
│       │   ├── recipes/
│       │   │   ├── RecipeCard.vue     # Grid-Vorschaukarte
│       │   │   └── RecipeImportModal.vue # KI-Import (Foto + Text)
│       │   └── dashboard/
│       │       └── StatCard.vue
│       ├── views/
│       │   ├── LoginView.vue          # Login + Registrierung
│       │   ├── DashboardView.vue      # Statistiken, Tagesplan, Schnellaktionen
│       │   ├── RecipesView.vue        # Übersicht mit Filtern + Suche
│       │   ├── RecipeDetailView.vue   # Vollansicht mit Zutatenhighlighting
│       │   ├── RecipeFormView.vue     # Erstellen/Bearbeiten + Bildzuschnitt
│       │   ├── MealPlanView.vue       # 7-Tage-Wochenplaner
│       │   ├── ShoppingView.vue       # Einkaufsliste + REWE
│       │   ├── PantryView.vue         # Vorratsschrank
│       │   └── admin/
│       │       ├── AdminDashboardView.vue  # System-Statistiken + Logs
│       │       ├── AdminUsersView.vue      # Benutzerverwaltung
│       │       └── AdminSettingsView.vue   # Systemeinstellungen + Cleanup
│       ├── stores/                    # Pinia Stores
│       │   ├── auth.js
│       │   ├── recipes.js
│       │   ├── mealplan.js
│       │   ├── shopping.js
│       │   └── pantry.js
│       ├── composables/
│       │   ├── useApi.js              # Fetch-Wrapper mit Fehlerbehandlung
│       │   ├── useTheme.js            # Dark-Mode-Verwaltung
│       │   └── useNotification.js     # Toast-System
│       └── router/
│           └── index.js
│
└── nginx/
    └── default.conf                   # Reverse Proxy (Frontend + /api → Backend)
```

---

## 🔌 API-Endpunkte

### Auth (`/api/auth`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/register` | Neuen Benutzer registrieren |
| `POST` | `/login` | Anmelden, JWT erhalten |
| `GET` | `/me` | Aktuellen Benutzer abrufen |

### Rezepte (`/api/recipes`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/` | Alle Rezepte (mit Filtern, Suche, Pagination) |
| `GET` | `/:id` | Rezeptdetails mit Zutaten, Schritten, Historie |
| `POST` | `/` | Neues Rezept erstellen |
| `PUT` | `/:id` | Rezept bearbeiten |
| `DELETE` | `/:id` | Rezept löschen (inkl. Bild-Cleanup) |
| `POST` | `/import-photo` | KI-Foto-Import (Multi-Bild) |
| `POST` | `/import-text` | KI-Text-Import |
| `POST` | `/:id/image` | Bild hochladen/ersetzen |
| `POST` | `/:id/favorite` | Favorit togglen |
| `POST` | `/:id/cooked` | Als gekocht markieren |

### Kategorien (`/api/categories`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/` | Alle Kategorien |
| `POST` | `/` | Kategorie erstellen |
| `PUT` | `/:id` | Kategorie bearbeiten |
| `DELETE` | `/:id` | Kategorie löschen |

### Wochenplaner (`/api/mealplan`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/generate` | KI-Wochenplan generieren |
| `GET` | `/` | Aktuellen Plan abrufen |
| `GET` | `/history` | Vergangene Pläne |
| `PUT` | `/:planId/entry/:entryId` | Eintrag bearbeiten |
| `POST` | `/:planId/entry/:entryId/cooked` | Mahlzeit als gekocht |
| `DELETE` | `/:id` | Plan löschen |

### Einkaufsliste (`/api/shopping`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/generate` | Liste aus Wochenplan generieren |
| `GET` | `/list` | Aktive Einkaufsliste |
| `GET` | `/lists` | Alle Listen |
| `PUT` | `/item/:id/check` | Artikel abhaken |
| `PUT` | `/item/:id/rewe` | REWE-Produkt zuordnen |
| `POST` | `/:listId/complete` | Einkauf abschließen → Vorratsschrank |

### Vorratsschrank (`/api/pantry`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/` | Alle Vorräte |
| `POST` | `/` | Vorrat hinzufügen |
| `PUT` | `/:id` | Vorrat bearbeiten |
| `DELETE` | `/:id` | Vorrat entfernen |
| `POST` | `/:id/use` | Menge verbrauchen |

### REWE (`/api/rewe`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/search` | Produktsuche |
| `POST` | `/match-ingredient` | Einzelne Zutat matchen |
| `POST` | `/match-shopping-list` | Gesamte Liste matchen |

### Admin (`/api/admin`) 🔒
> Alle Routen (außer `/seed`) erfordern `role=admin`.

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/seed` | Ersten Admin-Account erstellen (nur wenn kein Admin existiert) |
| `GET` | `/stats` | Dashboard-Statistiken (User, Rezepte, Speicher, beliebte Rezepte) |
| `GET` | `/users` | Alle Benutzer mit Rezeptanzahl und letzter Aktivität |
| `PUT` | `/users/:id` | Benutzer-Rolle oder Status ändern |
| `DELETE` | `/users/:id` | Benutzer mit allen Daten löschen |
| `POST` | `/users/:id/reset-password` | Passwort zurücksetzen |
| `GET` | `/settings` | Systemeinstellungen abrufen |
| `PUT` | `/settings` | Einstellungen aktualisieren |
| `GET` | `/logs` | Admin-Aktivitätslog (paginiert) |
| `POST` | `/cleanup` | Verwaiste Upload-Dateien entfernen |

---

## 🤖 KI-Provider wechseln

Die KI-Anbindung ist über ein Provider-Pattern abstrahiert (`backend/src/services/ai/`).

### Kimi K2.5 (Standard)
```env
AI_PROVIDER=kimi
KIMI_API_KEY=sk-dein-key
KIMI_BASE_URL=https://api.moonshot.ai/v1
KIMI_MODEL=kimi-k2.5
```
> **Wichtig:** `api.moonshot.ai` (International), nicht `api.moonshot.cn`. Kimi K2.5 unterstützt keinen `temperature`-Parameter.

### OpenAI
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-dein-key
OPENAI_MODEL=gpt-4o
```

### Anthropic
```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-dein-key
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

### Ollama (Lokal)
```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llava
```

---

## 🎨 Tailwind CSS 4 Konventionen

Dieses Projekt verwendet **Tailwind CSS 4** mit CSS-basierter Konfiguration:

- **Theme:** `@theme { }` in `main.css` für Custom Tokens (`--color-primary-*`, `--color-accent-*`)
- **Dark Mode:** `@custom-variant dark (&:where(.dark, .dark *));` (klassenbasiert)
- **Kein `@apply`** — Alle Custom-Klassen verwenden native CSS mit `var(--color-*)`, `var(--spacing)`, `var(--radius-*)`
- **Dark-Mode in Scoped Styles:** `:is(.dark .my-class) { ... }`

---

## ⚠️ Bekannte Einschränkungen

- **Vue Transition:** Alle Views müssen **genau ein Root-Element** haben (wegen `<Transition mode="out-in">` in `App.vue`)
- **REWE-API:** Inoffizielle API, kann sich ändern. Fehlende Market-ID deaktiviert die Funktion
- **KI-Genauigkeit:** Foto-Import funktioniert am besten mit gut beleuchteten, scharfen Rezeptfotos
- **SQLite:** Für Single-Server-Betrieb ausgelegt, nicht für horizontale Skalierung
- **Admin-Seed:** Der erste Admin kann nur via API-Call (`POST /api/admin/seed`) erstellt werden, nicht über die UI
- **Passwort ändern:** Es gibt aktuell keine Self-Service-Funktion zum Passwort-Ändern. Admins können Passwörter über die Benutzerverwaltung zurücksetzen

---

## 📜 Lizenz

MIT
