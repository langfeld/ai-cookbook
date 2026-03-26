---
title: Willkommen
description: Zauberjournal — KI-gestützte Rezeptverwaltung mit Wochenplaner, Einkaufsliste, REWE- & Bring!-Integration und Vorratsschrank.
---

**Zauberjournal** ist eine Self-Hosted Rezeptverwaltung mit KI-gestütztem Import, intelligentem Wochenplaner, automatischer Einkaufsliste, REWE- und Bring!-Integration sowie Vorratsschrank — alles in einem Docker-Container.

## Highlights

- **KI-Rezeptimport** — Foto oder Text → strukturiertes Rezept mit Zutaten, Schritten und Kategorien
- **Nährwertschätzung** — Kalorien, Eiweiß, Kohlenhydrate und Fett pro Portion — automatisch von der KI geschätzt, manuell editierbar
- **Wochenplaner** — Score-basierter Algorithmus mit Rotation, Synergien, Rezept-Sperren und optionalem KI-Reasoning
- **Einkaufsliste** — Automatisch generiert, mit Zutaten-Zusammenführung, Alias-System, Vorratsabgleich und KI-Überprüfung
- **KI-Einkaufslisten-Check** — Automatische Prüfung auf fehlende Zutaten, Duplikate, Mengenlogik, Plausibilität und REWE-Zuordnungsfehler — mit Ein-Klick-Korrekturen
- **Intelligente Duplikat-Erkennung** — Synonyme, Singular/Plural, Schreibvarianten und Wortreihenfolge beim Generieren erkennen und zusammenführen
- **REWE-Integration** — Automatisches AI-Produktmatching, Preisoptimierung, Tampermonkey-Userscript
- **Bring!-Anbindung** — Einkaufsliste per Klick an die Bring!-App senden
- **Vorratsschrank** — Ablaufdaten, Teilmengen, automatischer Nachschub aus Einkäufen
- **KI-Vorratsabzug** — Beim Kochen erkennt die KI semantisch passende Vorräte und zieht sie intelligent ab — auch bei abweichenden Namen oder Einheiten
- **KI-Vorrats-Transfer** — Beim Verschieben aus der Einkaufsliste normalisiert die KI Produktnamen (Marken, Zusätze entfernen), weist Kategorien zu und erkennt vorhandene Vorräte
- **Offline-Modus** — Einkaufsliste und Wochenplan offline nutzbar, automatische Synchronisation bei Reconnect
- **Haushalt-Sharing** — Gemeinsame Rezepte, Wochenpläne, Einkaufslisten und Vorräte mit Familie oder WG, Echtzeit-Synchronisation
- **Rezept-Link-Sharing** — Einzelne Rezepte per Link teilen (auch ohne Account), Import per Klick
- **Backup & Export** — Komplett-Backup aller Daten als JSON
- **Self-Hosted** — Ein Container, ein Volume, NAS-ready (PUID/PGID)
- **Mehrbenutzerfähig** — Admin-Bereich mit Rollen und Benutzerverwaltung

## Technologie-Stack

| Komponente | Technologie |
|-----------|-------------|
| **Frontend** | Vue 3 + Vite + Pinia + Vue Router |
| **Styling** | Tailwind CSS 4 |
| **Backend** | Fastify + Node.js 22 |
| **Datenbank** | SQLite (WAL-Modus) |
| **KI** | Kimi / OpenAI / Anthropic / Ollama — austauschbar |
| **Offline** | PWA Service Worker + IndexedDB Queue + Pinia Persistence |
| **Container** | Docker (Single-Container) |

## Schnellstart

```yaml
services:
  zauberjournal:
    image: ghcr.io/langfeld/zauberjournal:latest
    container_name: zauberjournal
    restart: unless-stopped
    ports:
      - "8080:3001"
    volumes:
      - ./data:/app/data
    environment:
      - JWT_SECRET=CHANGE_ME
      - PUID=1000
      - PGID=1000
```

```bash
docker compose up -d
```

Erreichbar unter **http://localhost:8080** — der erste registrierte Account wird automatisch Admin.

→ Weiter zur ausführlichen [Docker-Anleitung](/docs/getting-started/docker/)
