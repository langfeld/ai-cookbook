---
title: Umgebungsvariablen
description: Alle konfigurierbaren Umgebungsvariablen und Volumes.
---

## Umgebungsvariablen

| Variable | Pflicht | Standard | Beschreibung |
|---|---|---|---|
| `JWT_SECRET` | ✅ | — | Geheimer Schlüssel für Auth-Tokens. Generieren: `openssl rand -base64 48` |
| `PUID` | — | `1000` | User-ID für Volume-Dateien (NAS!) |
| `PGID` | — | `1000` | Group-ID für Volume-Dateien (NAS!) |
| `KIMI_API_KEY` | — | — | Fallback, wenn nicht im Admin-Panel gesetzt |
| `AI_PROVIDER` | — | `kimi` | Fallback für KI-Anbieter (`kimi`, `openai`, `anthropic`, `ollama`) |
| `MAX_UPLOAD_SIZE` | — | `10` | Fallback für maximale Upload-Größe in MB |

:::note
Die meisten Einstellungen (KI-Provider, API-Keys, REWE, Upload-Größe) können auch im **Admin-Panel** unter *Einstellungen* konfiguriert werden. Die Umgebungsvariablen dienen als Fallback.
:::

## Volumes

| Mount | Beschreibung |
|---|---|
| `/app/data` | Datenbank (`cookbook.db`) + Upload-Bilder (`uploads/`) |

Das `data`-Verzeichnis enthält:
- `cookbook.db` — die SQLite-Datenbank mit allen Benutzer- und Rezeptdaten
- `uploads/` — hochgeladene Rezeptbilder und Zutaten-Icons

:::caution
Sichere das `data`-Volume regelmäßig! Es enthält alle Daten der Anwendung. Die App bietet zusätzlich eine [Komplett-Backup-Funktion](/docs/guides/export-import/) als JSON.
:::
