---
title: Sicherheit
description: Authentifizierung, Verschlüsselung und Sicherheitsmaßnahmen.
---

## Dual-Auth

Zwei Authentifizierungsmechanismen:

| Typ | Beschreibung | Lebensdauer |
|-----|-------------|-------------|
| **JWT** | Kurzlebige Tokens via `@fastify/jwt` | Session-basiert |
| **API-Key** | Dauerhafter Key via `X-API-Key` Header | Bis zum Widerruf |

Das `authenticate`-Decorator prüft beide Varianten — zuerst JWT, dann API-Key als Fallback.

## Token-Redaktion

JWT-Tokens in URL-Query-Parametern werden in Server-Logs automatisch als `token=***` maskiert.

## Rate-Limiting

- API-Key Generierung und Widerruf: **max. 5 Anfragen pro Stunde**

## Datenbankindex

Unique-Index auf `api_key` (WHERE NOT NULL) für schnelle Lookups und Eindeutigkeit.

## XSS-Schutz

Das Tampermonkey-Userscript escaped alle Fehlermeldungen (`escapeHtml()`) bevor sie ins DOM eingefügt werden.

## Userscript-Sicherheit

- **`@connect`-Einschränkung** — Userscript darf nur mit dem konfigurierten API-Host kommunizieren (kein `@connect *`)
- **`GM_setValue`** — Konfiguration in Tampermonkey-Storage statt in `localStorage` der REWE-Domain

## Bring!-Verschlüsselung

Bring!-Passwörter werden **AES-256-GCM-verschlüsselt** in der SQLite-Datenbank gespeichert.

## Admin-Schutz

`requireAdmin` nutzt das zentrale `authenticate`-Decorator (API-Key-kompatibel) statt direktem `jwtVerify`.
