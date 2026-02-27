---
title: Docker Setup
description: Zauberjournal mit Docker Compose oder Docker Run installieren.
---

## Voraussetzungen

- **Docker** und **Docker Compose** (v2+)
- Ein API-Key für einen KI-Provider (optional, im Admin-Panel konfigurierbar)

## Docker Compose (empfohlen)

Erstelle eine `docker-compose.yml`:

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
      # --- Pflicht ---
      - JWT_SECRET=CHANGE_ME         # openssl rand -base64 48

      # --- NAS-Berechtigungen ---
      - PUID=1000
      - PGID=1000

      # --- Optional (Fallback, wenn nicht im Admin-Panel gesetzt) ---
      # - KIMI_API_KEY=
      # - AI_PROVIDER=kimi
      # - MAX_UPLOAD_SIZE=10
```

Starten:

```bash
docker compose up -d
```

Erreichbar unter **http://localhost:8080**.

## Docker Run (Einzeiler)

```bash
docker run -d \
  --name zauberjournal \
  --restart unless-stopped \
  -p 8080:3001 \
  -v zauberjournal-data:/app/data \
  -e JWT_SECRET=$(openssl rand -base64 48) \
  -e PUID=1000 \
  -e PGID=1000 \
  ghcr.io/langfeld/zauberjournal:latest
```

## Docker selber bauen

```bash
git clone <repo-url> zauberjournal
cd zauberjournal
docker build -t zauberjournal .
docker run -d --name zauberjournal -p 8080:3001 \
  -v zauberjournal-data:/app/data --env-file .env zauberjournal
```

## NAS-Tipp

Auf **Synology/QNAP** die `PUID`/`PGID` an deinen NAS-Benutzer anpassen, damit Dateien im Volume die richtigen Besitzerrechte haben:

- Synology-Standard: `1000:1000`
- QNAP: häufig `500:500`

:::tip
KI-API-Keys, REWE-Einstellungen und weitere Konfiguration können bequem über das **Admin-Panel** (Einstellungen) gesetzt werden — dafür sind keine Umgebungsvariablen nötig!
:::
