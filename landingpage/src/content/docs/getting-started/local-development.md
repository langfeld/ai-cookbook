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
