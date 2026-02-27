---
title: KI-Provider wechseln
description: Kimi, OpenAI, Anthropic oder Ollama als KI-Backend konfigurieren.
---

Die KI-Anbindung ist über ein **Provider-Pattern** abstrahiert (`backend/src/services/ai/`). Alle Einstellungen können im **Admin-Panel** unter *KI-Konfiguration* gesetzt werden — oder als Umgebungsvariablen (Fallback).

## Kimi / Moonshot AI (Standard)

```bash
AI_PROVIDER=kimi
KIMI_API_KEY=sk-dein-key
KIMI_BASE_URL=https://api.moonshot.ai/v1
KIMI_MODEL=kimi-k2.5
KIMI_SIMPLE_MODEL=moonshot-v1-32k
```

:::caution
Verwende `api.moonshot.ai` (International), **nicht** `api.moonshot.cn`.
:::

### Zwei Modell-Typen

Moonshot bietet zwei Modell-Typen:

| Typ | Modelle | Verwendung |
|-----|---------|------------|
| **Reasoning** | `kimi-k2.5`, `kimi-k2` | Komplexe Aufgaben (Rezept-Import, Wochenplan-Reasoning). Erzwingen `temperature=1`. |
| **Standard** | `moonshot-v1-8k/32k/128k` | Einfache strukturierte Aufgaben (JSON-Erzeugung). Schneller und günstiger. |

Das **schnelle Modell** (`KIMI_SIMPLE_MODEL`) wird automatisch für Aufgaben verwendet, die kein Reasoning benötigen — konfigurierbar im Admin-Panel unter *KI-Konfiguration → Schnelles Modell*.

## OpenAI

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-dein-key
OPENAI_MODEL=gpt-4o
```

## Anthropic

```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-dein-key
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

## Ollama (Lokal)

```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llava
```

:::tip
Ollama läuft **komplett lokal** — keine Cloud-Abhängigkeit, keine API-Kosten. Ideal für maximale Privatsphäre.
:::
