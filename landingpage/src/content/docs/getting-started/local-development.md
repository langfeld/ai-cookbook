---
title: Lokale Entwicklung
description: Zauberjournal ohne Docker für die Entwicklung einrichten.
---

## Voraussetzungen

- **Node.js 22+**
- Ein KI-API-Key (optional)

## Setup

```bash
# Repository klonen
git clone <repo-url> zauberjournal
cd zauberjournal

# Umgebungsvariablen konfigurieren
cp .env.example .env
# .env bearbeiten: JWT_SECRET und optional KIMI_API_KEY eintragen
```

## Backend starten

```bash
cd backend
npm install
npm run dev          # → http://localhost:3001
```

## Frontend starten (neues Terminal)

```bash
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

:::note
Das Backend lädt `.env` über `--env-file=../.env` (Node 22 nativ, kein `dotenv` nötig).
:::

## Landing Page / Docs starten

```bash
cd landingpage
npm install
npm run dev          # → http://localhost:4321/zauberjournal/
```

## PWA / Offline-Modus testen

Der Service Worker wird nur im **Production Build** vollständig generiert. So testest du den Offline-Modus lokal:

```bash
# Backend starten
cd backend && node src/server.js &

# Frontend bauen + Preview-Server starten
cd frontend && npm run preview:offline   # → http://localhost:4173
```

1. Seite einmal bei aktivem Netzwerk laden (Service Worker installiert sich)
2. In Chrome DevTools → **Application** → **Service Workers** prüfen, ob der SW aktiv ist
3. Netzwerk trennen (DevTools → Network → Offline) und Seite neu laden
4. Die App sollte vollständig funktionieren (Einkaufsliste, Wochenplan)

:::tip
Im Dev-Modus (`npm run dev`) ist der Service Worker ebenfalls aktiv, allerdings mit eingeschränktem Caching. Für vollständige Offline-Tests immer den Production Build verwenden.
:::
