---
title: Updates & CI/CD
description: App aktualisieren und automatische Builds mit GitHub Actions.
---

## Aktualisieren

### Mit Docker Compose

```bash
docker compose pull && docker compose up -d
```

### Manuell

```bash
docker pull ghcr.io/langfeld/zauberjournal:latest
docker stop zauberjournal && docker rm zauberjournal
# Gleicher docker run Befehl wie bei der Installation (Volume bleibt erhalten)
```

:::tip
Das `data`-Volume bleibt bei Updates erhalten — deine Daten gehen nicht verloren.
:::

## GitHub Actions

Der Workflow (`.github/workflows/docker-build.yml`) baut das Image automatisch bei:

- **Push auf `main`** — Build und Push zu `ghcr.io`
- **Git-Tags** (`v1.0.0`) — Versionierte Releases

Images werden für **amd64 + arm64** gebaut (Multi-Arch).

### Voraussetzung

*Settings → Actions → General → Workflow permissions → **Read and write permissions***.
