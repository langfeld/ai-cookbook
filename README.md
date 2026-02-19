# AI Cookbook 🍳🤖

Eine KI-gestützte Rezeptverwaltung mit intelligentem Wochenplaner (Score-Algorithmus + optionales KI-Reasoning), Kochmodus, Rezept-Sammlungen, Einkaufsliste mit Zutaten-Zusammenfassung, REWE-Integration, Bring!-Anbindung, Tampermonkey-Userscript, Vorratsschrank und umfangreichem Admin-Bereich.

![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?logo=docker&logoColor=white)
![Bring!](https://img.shields.io/badge/Bring!-Integration-4CAF50?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHRleHQgeT0iMTgiIGZvbnQtc2l6ZT0iMTgiPvCfm42uPC90ZXh0Pjwvc3ZnPg==&logoColor=white)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Userscript-00485B?logo=tampermonkey&logoColor=white)

---

## ✨ Features

### 🥘 Rezeptverwaltung
- **KI-Foto-Import** — Rezepte per Foto importieren (auch mehrseitige Rezeptkarten). Die KI erkennt Zutaten, Kochschritte, Schwierigkeitsgrad und schlägt Kategorien vor
- **Text-Import** — Rezept als Freitext beschreiben, die KI strukturiert es
- **Export/Import** — Rezepte als JSON exportieren und importieren (inkl. optionaler Bildeinbettung als Base64). Ideal für Backups, Migration oder zum Teilen
- **Bildzuschnitt** — Integrierter Cropper mit Seitenverhältnissen (4:3, 1:1, 16:9, Frei) und Drehen
- **Kategorien** — Frei anlegbare Kategorien mit Icons und Farben
- **Zutaten-Icons** — Emoji-Zuordnungen für Zutaten (z. B. 🍅 Tomate, 🧄 Knoblauch). Über Admin-Bereich verwaltbar mit Emoji-Picker
- **Farbige Zutatenerkennung** — Zutaten werden in Kochschritten farblich hervorgehoben
- **Portionsrechner** — Zutatenmengen dynamisch umrechnen
- **Kochhistorie** — Protokoll, wann welches Rezept zuletzt gekocht wurde
- **Favoriten** — Lieblingsrezepte markieren und filtern
- **Sammlungen** — Rezepte in frei erstellbare Sammlungen organisieren (mit Icon & Farbe). Ein Rezept kann mehreren Sammlungen angehören. Sammlungen lassen sich in der Rezeptübersicht als Filter verwenden
- **Kochmodus** — Immersiver Vollbild-Kochmodus mit Schritt-für-Schritt-Anleitung:
  - Swipe-Navigation (Touch oder Tastatur ←/→) zwischen Kochschritten
  - Zutaten-Seitenleiste (Desktop) oder ausklappbares Overlay (Mobile) mit Emoji-Icons
  - Farbige Zutatenerkennung im aktiven Schritt
  - Optionaler persistenter Timer (localStorage-basiert, überlebt Seitenwechsel)
  - WakeLock-API verhindert Bildschirm-Abdunklung beim Kochen
  - Automatischer Vorratsabzug beim Abschließen

### 📅 Wochenplaner
- **Score-basierter Algorithmus** — Berücksichtigt Kochhistorie, Rezeptrotation, Favoriten, Schwierigkeitsgrad, Zutatensynergien und Vorräte
- **Optionales KI-Reasoning** — Falls KI verfügbar, generiert sie eine kurze Begründung zum Plan (kein Pflichtfeature)
- **4 Mahlzeiten/Tag** — Frühstück, Mittag, Abendessen, Snack
- **Horizontal scrollbares 7-Tage-Raster** — Auch auf Mobile voll nutzbar
- **Sammlungs-Filter** — Plan-Generierung optional auf bestimmte Sammlungen beschränken (Mehrfachauswahl). Mit Deduplizierungs-Option für Rezepte, die in mehreren Sammlungen vorkommen

### 🛒 Einkaufsliste
- **Automatisch generiert** — Aus dem Wochenplan, mit intelligenter Duplikat-Konsolidierung und Einheiten-Normalisierung
- **Vorratsabgleich** — Vorhandene Vorräte werden automatisch abgezogen (mit Anzeige, was abgezogen wurde)
- **Gruppierung nach Abteilungen** — Items werden nach Supermarkt-Abteilungen sortiert (Obst & Gemüse, Milchprodukte, Fleisch & Fisch, etc.)
- **Manuelles Hinzufügen/Löschen** — Eigene Artikel ergänzen oder entfernen
- **In Vorratsschrank verschieben** — Einzelne Artikel direkt vom Einkaufszettel in den Vorratsschrank übertragen
- **Rezept-Verknüpfung** — Zu jedem Artikel sehen, aus welchem Rezept er stammt (mit Thumbnail, ein-/ausblendbar)
- **Fortschrittsbalken** — Visueller Einkaufsfortschritt
- **Einkauf abschließen** → Abgehakte Artikel landen automatisch im Vorratsschrank
- **Zutaten zusammenfassen** — Gleiche Zutaten mit unterschiedlichen Schreibweisen (z. B. „Knoblauch" und „Knoblauchzehe") zu einem Eintrag zusammenführen. Multi-Merge: beliebig viele Artikel gleichzeitig auswählen und den kanonischen Namen wählen
- **Automatische Alias-Auflösung** — Gespeicherte Zuordnungen (Aliases) werden bei jeder neuen Einkaufslistengenerierung automatisch angewandt, sodass zusammengeführte Zutaten dauerhaft konsolidiert bleiben
- **Alias-Verwaltung** — Alle gespeicherten Zutatenzuordnungen einsehen und einzeln löschen (Split-Button in der Einkaufsliste)

### 🏪 REWE-Integration
- **Automatisches Produkt-Matching** — Alle Zutaten werden per SSE-Stream mit Live-Fortschrittsanzeige REWE-Produkten zugeordnet
- **Relevanz-Scoring** — Intelligenter Algorithmus mit Compound-Wort-Erkennung (z. B. „Knoblauch" in „Knoblauchzehe"), Flavor-Filter (Saft, Bonbon, Duschgel etc.) und Grundpreis-Sortierung
- **Grundpreis-Optimierung** — Sortierung nach €/kg bzw. €/Stück statt Paketpreis. Bevorzugt größere, preiswertere Packungen automatisch
- **Intelligente Mengenberechnung** — Packungsgrößen-Parsing (g, kg, ml, l, Stück), Stückzahl-Erkennung aus Produktnamen (Duo, Trio, 6er-Pack, Beutel, Becher, Schale etc.), automatische Einheiten-Konvertierung
- **Produkt-Picker** — Alternatives REWE-Produkt suchen und auswählen (mit Suchfeld, Relevanz-Badge, Preis)
- **Produkt-Präferenzen** — Manuell gewählte Produkte werden gespeichert und beim nächsten Matching automatisch bevorzugt (mit Preisaktualität)
- **Preisübersicht** — Geschätzte Gesamtkosten, Einzelpreise pro Artikel
- **REWE-Bestell-Panel** — Alle zugeordneten Produkte auf einen Blick, mit Link zum REWE-Onlineshop
- **Warenkorb-Script** — Generiert ein Browser-Konsolenscript, das alle gematchten Produkte automatisch in den REWE-Warenkorb legt (Listing-ID-basiert, mit Fortschrittsanzeige)
- **Tampermonkey-Userscript** — Installiert sich als Browser-Extension auf rewe.de: Floating Action Button (🍳), Panel mit Produktliste, automatisches Einfügen in den Warenkorb, Live-Status pro Artikel (✅/❌/⚠️). Kommuniziert per `GM_xmlhttpRequest` CORS-frei mit der API
- **Marktsuche** — REWE-Markt per PLZ finden, konfigurierbar über Admin-Einstellungen

### 🛍️ Bring!-Integration
- **Account-Verbindung** — Bring!-Konto über E-Mail und Passwort verbinden (Passwort AES-256-GCM-verschlüsselt gespeichert)
- **Listen-Auswahl** — Alle eigenen Bring!-Listen werden geladen, Zielliste frei wählbar
- **Einkaufsliste senden** — Alle offenen Artikel der Einkaufsliste per Klick an die Bring!-App senden (mit Mengenangaben als Specification)
- **Bidirektionale Nutzung** — Einkaufsliste im AI Cookbook verwalten, unterwegs in der Bring!-App abhaken
- **Account trennen** — Bring!-Verbindung jederzeit entfernen (Zugangsdaten werden gelöscht)

### 🗄️ Vorratsschrank
- **Kategorie-Gruppierung** — Übersichtlich nach Lebensmittelgruppen
- **Ablaufdaten** — MHD-Tracking mit Warnungen bei bald ablaufenden Artikeln (Badge in der Navigation)
- **Verbrauchsfunktion** — Teilmengen entnehmen
- **Automatischer Nachschub** — Überschüsse aus Einkäufen und verschobene Artikel werden erfasst
- **Export** — Vorräte als CSV oder JSON exportieren
- **Import** — Vorräte aus CSV oder JSON importieren (mit Dateivorschau, Zusammenführung bestehender Einträge)

### 🎨 Design & UX
- **Dark Mode / Light Mode** — Umschaltbar, klassenbasiert
- **Voll Responsiv** — Mobile-Sidebar als Overlay-Drawer, horizontaler Scroll für Wochenplaner, adaptive Grids
- **Tailwind CSS 4** — Native CSS mit Custom Properties, kein `@apply`
- **Animierte Übergänge** — Vue `<Transition>` für Seitenwechsel und Modals
- **Deutsche Fehlermeldungen** — Nutzerfreundliche Hinweise bei Netzwerk-/API-Fehlern

### 🛡️ Admin-Bereich
- **Dashboard** — Systemstatistiken (Benutzer, Rezepte, KI-Imports, Speicherverbrauch), beliebteste Rezepte, Admin-Aktivitätslog
- **Benutzerverwaltung** — Alle Benutzer anzeigen/suchen, Rollen ändern (Admin/User), Konten sperren/entsperren, Passwort zurücksetzen, Benutzer löschen
- **Systemeinstellungen** — Registrierung aktivieren/deaktivieren, Wartungsmodus, KI-Anbieter wählen, Upload-Größe konfigurieren, REWE-Markt-ID/PLZ
- **Zutaten-Icons** — Keyword→Emoji-Mappings verwalten (Hinzufügen, Bearbeiten, Löschen), integrierter Emoji-Picker, Tabs für Mappings/verwendete/fehlende Zutaten
- **Datei-Bereinigung** — Verwaiste Upload-Dateien automatisch erkennen und entfernen
- **Rezept Export/Import** — Alle Rezepte (oder pro Benutzer) als JSON exportieren/importieren, mit Benutzer-Zuweisung beim Import
- **Vorratsschrank Export/Import** — Vorräte aller Benutzer exportieren (oder nach Benutzer filtern), importieren mit Zielbenutzer-Auswahl
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
| **KI-Provider** | Kimi K2.5 / OpenAI / Anthropic / Ollama — austauschbar | — |
| **Auth** | JWT (@fastify/jwt + bcryptjs) | — |
| **Bring!** | bring-shopping (npm) | 1.x |
| **Container** | Docker (Single-Container) + ghcr.io | — |

---

## 🚀 Schnellstart

### Voraussetzungen
- **Node.js 22+** (für lokale Entwicklung) oder **Docker**
- Ein API-Key für Kimi/Moonshot AI (oder einen anderen KI-Provider)

### Docker Compose (empfohlen)

```bash
# 1. docker-compose.yml anpassen (Image-Name, JWT_SECRET, API-Key)
# 2. Starten:
docker compose up -d
```

Die mitgelieferte `docker-compose.yml` enthält alle Einstellungen mit Erklärungen.

### Docker Run (Einzeiler)

```bash
docker run -d \
  --name cookbook \
  --restart unless-stopped \
  -p 8080:3001 \
  -v cookbook-data:/app/data \
  -e JWT_SECRET=$(openssl rand -base64 48) \
  -e PUID=1000 \
  -e PGID=1000 \
  ghcr.io/GITHUB_USER/ai-cookbook:latest
```

> ⚠️ **`GITHUB_USER`** durch deinen GitHub-Benutzernamen ersetzen (Kleinbuchstaben).

Erreichbar unter **http://localhost:8080**

> 💡 **KI-API-Keys, REWE-Daten und weitere Einstellungen** werden bequem über das **Admin-Panel** (Einstellungen) konfiguriert — nicht mehr per Umgebungsvariable!

#### Umgebungsvariablen

| Variable | Pflicht | Standard | Beschreibung |
|---|---|---|---|
| `JWT_SECRET` | ✅ | — | Geheimer Schlüssel für Auth-Tokens |
| `PUID` | — | `1000` | User-ID für Volume-Dateien (NAS!) |
| `PGID` | — | `1000` | Group-ID für Volume-Dateien (NAS!) |
| `KIMI_API_KEY` | — | — | Fallback, wenn nicht im Admin-Panel gesetzt |
| `AI_PROVIDER` | — | `kimi` | Fallback für KI-Anbieter |
| `MAX_UPLOAD_SIZE` | — | `10` | Fallback für Max-Upload in MB |

#### Volumes

| Mount | Beschreibung |
|---|---|
| `/app/data` | Datenbank (`cookbook.db`) + Upload-Bilder (`uploads/`) |

> **NAS-Tipp:** Auf Synology/QNAP die PUID/PGID an deinen NAS-Benutzer anpassen, damit Dateien im Volume die richtigen Besitzerrechte haben. Synology-Standard ist oft `1000:1000`, QNAP nutzt häufig `500:500`.

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

### Docker selber bauen

```bash
git clone <repo-url> ai-cookbook
cd ai-cookbook
docker build -t ai-cookbook .
docker run -d --name cookbook -p 8080:3001 -v cookbook-data:/app/data --env-file .env ai-cookbook
```

### 🛡️ Ersteinrichtung

Beim **ersten Start** existiert kein Administrator. Die App erkennt das automatisch:

1. Container starten (siehe oben)
2. Im Browser `http://localhost:8080` öffnen
3. Die Login-Seite zeigt einen **Setup-Hinweis** und das Registrierungsformular
4. **Den ersten Account registrieren** — dieser wird automatisch zum **Administrator**
5. In der Sidebar erscheint der **Admin-Bereich** (Shield-Icon)
6. **Admin → Einstellungen → KI-Konfiguration** → API-Key eintragen
7. Optional: Registrierung für weitere Benutzer deaktivieren, REWE-Integration konfigurieren

> **Sicherheit:** Nur der allererste registrierte Account wird zum Admin. Alle weiteren Accounts erhalten die Rolle „Benutzer".

### Aktualisieren

```bash
# Mit Docker Compose:
docker compose pull && docker compose up -d

# Oder manuell:
docker pull ghcr.io/GITHUB_USER/ai-cookbook:latest
docker stop cookbook && docker rm cookbook
# Gleicher docker run Befehl wie oben (Volume bleibt erhalten)
```

### GitHub Actions

Der Workflow (`.github/workflows/docker-build.yml`) baut das Image automatisch bei Push auf `main` oder bei Git-Tags (`v1.0.0`) und pusht es zu `ghcr.io`. Images werden für **amd64 + arm64** gebaut.

**Voraussetzung:** *Settings → Actions → General → Workflow permissions → Read and write permissions*.

---

## 📁 Projektstruktur

```
ai-cookbook/
├── Dockerfile                  # Single-Container Build (Frontend + Backend)
├── docker-compose.yml          # Compose für NAS / einfaches Deployment
├── entrypoint.sh               # PUID/PGID-Handling für NAS-Berechtigungen
├── .dockerignore
├── .env.example                # Umgebungsvariablen-Vorlage
├── .github/workflows/
│   └── docker-build.yml        # GitHub Actions → ghcr.io
│
├── backend/
│   ├── package.json
│   └── src/
│       ├── server.js           # Fastify Server + Frontend-Serving + SPA-Fallback
│       ├── config/
│       │   ├── env.js          # Zentrale Config aus Umgebungsvariablen
│       │   └── database.js     # SQLite-Initialisierung (WAL, FK, CASCADE)
│       ├── routes/
│       │   ├── auth.js         # Registrierung, Login, Token-Refresh
│       │   ├── recipes.js      # CRUD + Foto-Import + Text-Import + Export/Import
│       │   ├── categories.js   # Kategorien CRUD
│       │   ├── collections.js  # Sammlungen CRUD + Rezept-Zuordnungen
│       │   ├── mealplan.js     # Wochenplaner (Algorithmus + optionales KI-Reasoning)
│       │   ├── shopping.js     # Einkaufsliste: Generierung, Items, REWE-Zuordnung, Pantry-Transfer
│       │   ├── pantry.js       # Vorratsschrank CRUD + Verbrauch + CSV/JSON-Import
│       │   ├── rewe.js         # REWE: Produktsuche, SSE-Matching, Marktsuche, Präferenzen, Cart-Script
│       │   ├── rewe-userscript.js # REWE: Tampermonkey/Greasemonkey Userscript-Generator
│       │   ├── bring.js        # Bring!: Account-Verbindung, Listen, Senden, Trennen
│       │   ├── ingredient-icons.js # Zutaten-Emoji-Mappings (CRUD)
│       │   └── admin.js        # Admin: Stats, Benutzer, Settings, Logs, Export/Import (Rezepte + Pantry)
│       ├── services/
│       │   ├── ai/
│       │   │   ├── base.js     # BaseAIProvider (Chat, JSON-Parse, Bildanalyse)
│       │   │   ├── kimi.js     # Kimi K2.5 Provider (api.moonshot.ai)
│       │   │   ├── openai.js   # OpenAI Provider (GPT-4o etc.)
│       │   │   ├── anthropic.js # Anthropic Provider (Claude)
│       │   │   ├── ollama.js   # Ollama Provider (lokal)
│       │   │   └── provider.js # Provider-Factory
│       │   ├── meal-planner.js # Wochenplan-Algorithmus (Score-basiert + opt. KI-Reasoning)
│       │   ├── recipe-parser.js # Multi-Bild-Rezeptanalyse
│       │   ├── rewe-api.js     # REWE API-Client (Produktsuche, Marktsuche, URL-Builder)
│       │   └── shopping-list.js # Einkaufslisten-Service (Generierung, Konsolidierung, Vorratsabgleich)
│       └── utils/
│           ├── helpers.js      # normalizeUnit, Konvertierungsfunktionen
│           └── errors.js       # Fehlerbehandlung
│
└── frontend/
    ├── package.json
    ├── vite.config.js          # Vite 6 + @vitejs/plugin-vue + @tailwindcss/vite
    └── src/
        ├── main.js             # App-Einstieg + Pinia + Router
        ├── App.vue             # Layout-Shell (Sidebar, Header, Transition)
        ├── assets/styles/
        │   └── main.css        # Tailwind 4 (@theme, @custom-variant dark)
        ├── components/
        │   ├── layout/         # AppSidebar, AppHeader, ThemeToggle, NotificationToast
        │   ├── ui/             # ConfirmDialog, ImageCropModal
        │   ├── recipes/        # RecipeCard, RecipeImportModal, RecipeImportExportModal
        │   ├── collections/    # CollectionManager, AddToCollection
        │   ├── pantry/         # PantryImportExportModal
        │   └── dashboard/      # StatCard
        ├── views/
        │   ├── LoginView.vue
        │   ├── DashboardView.vue
        │   ├── RecipesView.vue / RecipeDetailView.vue / RecipeFormView.vue
        │   ├── MealPlanView.vue / ShoppingView.vue / PantryView.vue
        │   └── admin/          # AdminDashboard, AdminUsers, AdminSettings, AdminIngredientIcons
        ├── stores/             # Pinia (auth, recipes, mealplan, shopping, pantry, collections)
        ├── composables/        # useApi, useTheme, useNotification, useIngredientIcons
        └── router/index.js
```

---

## 🔌 API-Endpunkte

### Auth (`/api/auth`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/setup-status` | Prüft ob Ersteinrichtung nötig ist (öffentlich) |
| `POST` | `/register` | Neuen Benutzer registrieren (erster User → Admin) |
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
| `GET` | `/export` | Eigene Rezepte als JSON exportieren (`?include_images=true` für Bilder) |
| `POST` | `/import` | Rezepte aus JSON-Datei importieren (max. 100 pro Import) |

### Kategorien (`/api/categories`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/` | Alle Kategorien |
| `POST` | `/` | Kategorie erstellen |
| `PUT` | `/:id` | Kategorie bearbeiten |
| `DELETE` | `/:id` | Kategorie löschen |

### Sammlungen (`/api/collections`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/` | Alle Sammlungen mit Rezeptanzahl |
| `POST` | `/` | Neue Sammlung erstellen (Name, Icon, Farbe) |
| `PUT` | `/:id` | Sammlung bearbeiten |
| `DELETE` | `/:id` | Sammlung löschen (Rezepte bleiben erhalten) |
| `POST` | `/:id/recipes` | Rezepte zur Sammlung hinzufügen (`{recipeIds: [...]}`) |
| `DELETE` | `/:id/recipes/:recipeId` | Rezept aus Sammlung entfernen |
| `GET` | `/for-recipe/:recipeId` | Sammlungen eines Rezepts abrufen |

### Wochenplaner (`/api/mealplan`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/generate` | Wochenplan generieren (Algorithmus + optionales KI-Reasoning) |
| `GET` | `/` | Aktuellen Plan abrufen |
| `GET` | `/history` | Vergangene Pläne |
| `PUT` | `/:planId/entry/:entryId` | Eintrag bearbeiten |
| `POST` | `/:planId/entry/:entryId/cooked` | Mahlzeit als gekocht |
| `DELETE` | `/:id` | Plan löschen |

### Einkaufsliste (`/api/shopping`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/generate` | Liste aus Wochenplan generieren (mit Duplikat-Konsolidierung + Vorratsabgleich) |
| `GET` | `/list` | Aktive Einkaufsliste (inkl. Rezept-Details + REWE-Produkte) |
| `GET` | `/lists` | Alle Listen (auch vergangene) |
| `PUT` | `/item/:id/check` | Artikel abhaken/entabhaken |
| `POST` | `/item/add` | Artikel manuell hinzufügen |
| `DELETE` | `/item/:id` | Artikel löschen |
| `PUT` | `/item/:id/rewe-product` | REWE-Produkt zuordnen (speichert auch Präferenz) |
| `POST` | `/item/:id/to-pantry` | Artikel in den Vorratsschrank verschieben |
| `POST` | `/:listId/complete` | Einkauf abschließen → abgehakte Artikel in Vorratsschrank |

### Vorratsschrank (`/api/pantry`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/` | Alle Vorräte (Filter: `?category=X`, `?expiring=true`) |
| `POST` | `/` | Vorrat hinzufügen (bei Duplikat: Menge addieren) |
| `PUT` | `/:id` | Vorrat bearbeiten |
| `DELETE` | `/:id` | Vorrat entfernen |
| `POST` | `/:id/use` | Menge verbrauchen |
| `POST` | `/import` | Vorräte aus CSV/JSON importieren (Multipart-Upload) |

### REWE (`/api/rewe`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/search-ingredient` | Produktsuche mit Relevanz-Scoring (`?q=Butter&limit=8`) |
| `POST` | `/match-shopping-list` | Gesamte Liste matchen (SSE-Stream mit Live-Fortschritt) |
| `GET` | `/markets` | Marktsuche nach PLZ (`?zipCode=12345`) |
| `GET` | `/preferences` | Gespeicherte Produkt-Präferenzen abrufen |
| `DELETE` | `/preferences/:id` | Einzelne Präferenz löschen |
| `DELETE` | `/preferences` | Alle Präferenzen löschen |
| `GET` | `/cart-script` | Warenkorb-Script generieren (Listing-ID-basiert, für Browser-Konsole) |
| `GET` | `/userscript` | Tampermonkey/Greasemonkey-Userscript herunterladen (`?token=JWT`, ohne Auth-Hook) |

### Bring! (`/api/bring`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/connect` | Bring!-Account verbinden (E-Mail + Passwort + Zielliste) |
| `GET` | `/status` | Verbindungsstatus prüfen (verbunden? welche Liste?) |
| `GET` | `/lists` | Alle verfügbaren Bring!-Listen abrufen |
| `PUT` | `/list` | Aktive Bring!-Liste wechseln |
| `POST` | `/send` | Offene Einkaufsartikel an Bring!-Liste senden |
| `DELETE` | `/disconnect` | Bring!-Verbindung trennen (Zugangsdaten löschen) |

### Zutaten-Icons (`/api/ingredient-icons`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/` | Alle Keyword→Emoji-Mappings |
| `POST` | `/` | Neues Mapping erstellen 🔒 |
| `PUT` | `/:id` | Mapping bearbeiten 🔒 |
| `DELETE` | `/:id` | Mapping löschen 🔒 |

### Admin (`/api/admin`) 🔒
> Alle Routen erfordern `role=admin`.

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/stats` | Dashboard-Statistiken (User, Rezepte, Speicher, beliebte Rezepte) |
| `GET` | `/users` | Alle Benutzer mit Rezeptanzahl und letzter Aktivität |
| `PUT` | `/users/:id` | Benutzer-Rolle oder Status ändern |
| `DELETE` | `/users/:id` | Benutzer mit allen Daten löschen |
| `POST` | `/users/:id/reset-password` | Passwort zurücksetzen |
| `GET` | `/categories` | Alle Kategorien mit Nutzungsanzahl |
| `GET` | `/settings` | Systemeinstellungen abrufen |
| `PUT` | `/settings` | Einstellungen aktualisieren |
| `GET` | `/logs` | Admin-Aktivitätslog (paginiert) |
| `POST` | `/cleanup` | Verwaiste Upload-Dateien entfernen |
| `GET` | `/export` | Rezepte als JSON exportieren (`?user_id=X`, `?include_images=true`) |
| `POST` | `/import` | Rezepte importieren und Benutzer zuweisen (max. 500 pro Import) |
| `GET` | `/export/pantry` | Vorratsschrank als JSON exportieren (`?user_id=X`) |
| `POST` | `/import/pantry` | Vorräte importieren und Benutzer zuweisen (CSV/JSON) |

---

## 📦 Rezept Export/Import

### Export-Format (JSON)

```json
{
  "version": "1.0",
  "exported_at": "2026-02-14T12:00:00.000Z",
  "source": "AI Cookbook",
  "recipe_count": 3,
  "recipes": [
    {
      "title": "Spaghetti Carbonara",
      "description": "Klassische italienische Pasta",
      "servings": 4,
      "prep_time": 10,
      "cook_time": 20,
      "total_time": 30,
      "difficulty": "mittel",
      "is_favorite": 1,
      "notes": "Persönliche Notizen...",
      "categories": [
        { "name": "Abendessen", "icon": "🌙", "color": "#6366f1" }
      ],
      "ingredients": [
        { "name": "Spaghetti", "amount": 400, "unit": "g", "group_name": null, "sort_order": 0 }
      ],
      "steps": [
        { "step_number": 1, "title": "Pasta kochen", "instruction": "Spaghetti al dente kochen", "duration_minutes": 10 }
      ],
      "image_base64": "...(optional, nur mit ?include_images=true)...",
      "image_mime": "image/webp"
    }
  ]
}
```

### Funktionen

| Feature | Benutzer | Admin |
|---------|----------|-------|
| Eigene Rezepte exportieren | ✅ | ✅ (nach Benutzer filterbar) |
| Bilder als Base64 einbetten | ✅ | ✅ |
| Rezepte importieren | ✅ (eigene) | ✅ (beliebigem User zuweisbar) |
| Max. Rezepte pro Import | 100 | 500 |
| Fehlende Kategorien erstellen | ✅ automatisch | ✅ automatisch |
| Bilder aus Base64 wiederherstellen | ✅ | ✅ |
| Drag & Drop Upload | ✅ | ✅ |
| Datei-Vorschau | ✅ | ✅ |

---

## 🗄️ Vorratsschrank Export/Import

### Benutzer
- **Export** als CSV (Semikolon-getrennt) oder JSON direkt aus dem Vorratsschrank
- **Import** von CSV oder JSON, bestehende Einträge werden automatisch zusammengeführt (Menge addiert)

### Admin
- **Export** aller Vorräte als JSON (`?user_id=X` zum Filtern nach Benutzer)
- **Import** mit Zielbenutzer-Auswahl, Zusammenführung bestehender Einträge

### CSV-Format

```csv
Zutat;Menge;Einheit;Kategorie;MHD;Notizen
Mehl;2;kg;Backwaren;2026-12-31;Weizenmehl Type 405
Milch;1;l;Milchprodukte;2026-02-25;
```

> Unterstützte Trennzeichen: Semikolon (`;`) und Komma (`,`). BOM wird automatisch entfernt.

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
- **REWE-Userscript:** Token läuft nach 7 Tagen ab — danach muss ein neues Userscript installiert werden
- **Bring!-API:** Nutzt das Community-Paket `bring-shopping` (inoffiziell). Bring!-Passwörter werden AES-256-GCM-verschlüsselt in der DB gespeichert
- **KI-Genauigkeit:** Foto-Import funktioniert am besten mit gut beleuchteten, scharfen Rezeptfotos
- **SQLite:** Für Single-Server-Betrieb ausgelegt, nicht für horizontale Skalierung
- **Passwort ändern:** Es gibt aktuell keine Self-Service-Funktion zum Passwort-Ändern. Admins können Passwörter über die Benutzerverwaltung zurücksetzen

---

## 📜 Lizenz

MIT
