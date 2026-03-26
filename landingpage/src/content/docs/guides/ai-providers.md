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
KIMI_SIMPLE_MODEL=kimi-k2.5
```

:::caution
Verwende `api.moonshot.ai` (International), **nicht** `api.moonshot.cn`.
:::

### Zwei Modell-Varianten

Das `kimi-k2.5`-Modell unterstützt zwei Modi über den `thinking`-Parameter:

| Variante | Modus | Verwendung |
|----------|-------|------------|
| **K2.5 Thinking** | `thinking: enabled` (Standard) | Komplexe Aufgaben (Rezept-Import, Wochenplan-Reasoning, Einkaufslisten-Check). Temperature fest 1.0. |
| **K2.5 Instant** | `thinking: disabled` | Einfache strukturierte Aufgaben (JSON-Erzeugung, Nährwert-Schätzung). Schneller, temperature fest 0.6. |

Das **schnelle Modell** (`KIMI_SIMPLE_MODEL`) nutzt automatisch den Instant-Modus (Thinking deaktiviert) — konfigurierbar im Admin-Panel unter *KI-Konfiguration → Schnelles Modell*.

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
