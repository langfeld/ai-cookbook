# AI Cookbook 🍳🤖

Eine KI-gestützte Rezeptverwaltung mit intelligentem Wochenplaner, Einkaufsliste und REWE-Integration.

## Features

### 🥘 Rezeptverwaltung
- **Foto-Import**: Rezepte per Foto importieren – die KI erkennt Zutaten, Schritte und mehr
- **Kategorien**: Frei anlegbare Kategorien (Frühstück, Mittag, Abendessen, Snack…)
- **KI-Kategorisierung**: Automatische Kategorie-Vorschläge durch die KI
- **Farbige Zutaten**: Zutaten werden in Kochschritten farblich hervorgehoben
- **Kochschritte**: Übersichtlich unterteilt mit Zeitangaben
- **Portionsrechner**: Zutatenmengen dynamisch anpassen
- **Schwierigkeitsgrad & Kochzeit**: Automatisch von der KI geschätzt

### 📅 Wochenplaner
- **Intelligente Planung**: KI wählt Rezepte aus, die länger nicht gekocht wurden
- **Einkaufsoptimiert**: Rezepte werden so kombiniert, dass Zutaten zusammenpassen
- **Drag & Drop**: Rezepte einfach in Tagesslots ziehen

### 🛒 Einkaufsliste
- **Automatisch generiert**: Aus dem Wochenplan
- **REWE-Integration**: Direkte Anbindung an REWE Abhol- und Lieferservice
- **Preisvergleich**: Aktuelle REWE-Preise zu jeder Zutat
- **Vorratsschrank-Abgleich**: Vorhandene Zutaten werden automatisch abgezogen

### 🏪 Vorratsschrank
- **Überschuss-Tracking**: Zu viel gekaufte Mengen werden automatisch erfasst
- **Ablaufdatum**: Optionale Verfallsdaten mit Warnungen
- **Nächster Einkauf**: Vorräte werden bei der nächsten Planung berücksichtigt

### ⭐ Weitere Features
- **Favoriten**: Lieblingsrezepte markieren
- **Kochhistorie**: Wann wurde was zuletzt gekocht?
- **Dark Mode**: Umschaltbar zwischen hellem und dunklem Design
- **Responsive**: Optimiert für Desktop, Tablet und Smartphone

## Technologie-Stack

| Komponente | Technologie |
|-----------|-------------|
| Frontend  | Vue 3, Tailwind CSS 4, Vite |
| Backend   | Node.js, Fastify |
| Datenbank | SQLite (better-sqlite3) |
| KI        | Kimi 2.5 (austauschbar: OpenAI, Anthropic, Ollama) |
| Container | Docker, Docker Compose |
| Proxy     | Nginx |

## Schnellstart

### Voraussetzungen
- Docker & Docker Compose
- Ein API-Key für den gewünschten KI-Provider (z.B. Kimi/Moonshot)

### Installation

```bash
# Repository klonen
git clone <repo-url> ai-cookbook
cd ai-cookbook

# Umgebungsvariablen konfigurieren
cp .env.example .env
# .env bearbeiten und API-Keys eintragen

# Container starten
docker compose up -d
```

Die Anwendung ist dann erreichbar unter:
- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3001
- **API Dokumentation**: http://localhost:3001/docs

### Entwicklung (ohne Docker)

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (neues Terminal)
cd frontend
npm install
npm run dev
```

## Projektstruktur

```
ai-cookbook/
├── docker-compose.yml          # Container-Orchestrierung
├── .env.example                # Umgebungsvariablen-Vorlage
├── README.md                   # Diese Datei
│
├── backend/                    # Fastify Backend
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js           # Server-Einstiegspunkt
│       ├── config/             # Konfiguration
│       ├── plugins/            # Fastify Plugins (Auth, CORS)
│       ├── routes/             # API-Routen
│       ├── services/           # Business-Logik
│       │   └── ai/             # KI-Provider (austauschbar)
│       ├── models/             # Datenbank-Modelle
│       └── utils/              # Hilfsfunktionen
│
├── frontend/                   # Vue 3 Frontend
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── components/         # Vue-Komponenten
│       ├── views/              # Seiten
│       ├── stores/             # Pinia Stores
│       ├── composables/        # Vue Composables
│       └── router/             # Vue Router
│
└── nginx/                      # Reverse Proxy
    └── default.conf
```

## KI-Provider wechseln

Die KI-Anbindung ist über ein Provider-Pattern abstrahiert. Um den Provider zu wechseln:

1. In `.env` den `AI_PROVIDER` ändern (z.B. `openai`, `anthropic`, `ollama`)
2. Den entsprechenden API-Key eintragen
3. Container neu starten

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Eigene Provider können einfach hinzugefügt werden – siehe `backend/src/services/ai/provider.js`.

## API-Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| POST | `/api/auth/register` | Registrierung |
| POST | `/api/auth/login` | Login |
| GET | `/api/recipes` | Alle Rezepte |
| POST | `/api/recipes` | Rezept erstellen |
| POST | `/api/recipes/import-photo` | Rezept per Foto importieren |
| GET | `/api/categories` | Kategorien auflisten |
| POST | `/api/mealplan/generate` | Wochenplan generieren (KI) |
| GET | `/api/shopping/list` | Einkaufsliste |
| GET | `/api/pantry` | Vorratsschrank |
| GET | `/api/rewe/search` | REWE Produktsuche |

Vollständige API-Dokumentation unter `/docs` (Swagger UI).

## Lizenz

MIT
