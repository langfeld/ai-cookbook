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
- KI-Rezeptüberarbeitung: **max. 5 Anfragen pro 15 Minuten**

## KI-Prompt-Schutz

Bei der KI-Rezeptüberarbeitung werden Nutzer-Eingaben in **Delimiter-Blöcke** eingebettet und dürfen nur als inhaltliche Anweisung interpretiert werden. Der System-Prompt weist die KI explizit an, Anweisungen außerhalb des Rezept-Kontexts zu ignorieren. Der KI-Output wird durch `sanitizeAiRecipe()` sanitiert (Längenlimits, Typ-Validierung, Wertebereichsprüfung) und zusätzlich strukturell validiert (mind. 1 Zutat, 1 Zubereitungsschritt, nicht-leerer Titel).

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

## Haushalt-Zugriffskontrolle

Alle Haushalt-bezogenen Endpunkte prüfen die Mitgliedschaft über `isHouseholdMember()`. Der `resolveHousehold`-Decorator:
1. Authentifiziert den Benutzer (JWT oder API-Key)
2. Liest den `X-Household-Id`-Header
3. Validiert die Mitgliedschaft — bei ungültigem Haushalt gibt es `403 Forbidden`
4. Setzt `request.householdId` für alle nachfolgenden Queries

## SSE-Authentifizierung

Da die native `EventSource`-API keine Custom-Header unterstützt, wird das JWT-Token als Query-Parameter (`?token=...`) akzeptiert. Das Token wird serverseitig manuell via `fastify.jwt.verify()` geprüft.

## Einladungscodes

- **8 Zeichen**, alphanumerisch, mittels `crypto.randomBytes()` generiert
- **48 Stunden** gültig, danach nicht mehr verwendbar
- **Einmalverwendung** — nach erfolgreichem Beitritt nicht erneut nutzbar

## Share-Tokens

- **32 Byte**, hex-encoded (`crypto.randomBytes(32)`)
- **7 Tage** gültig (konfigurierbar per `expires_days`-Parameter)
- Öffentlicher Zugriff zeigt nur Rezeptdaten — keine sensiblen Felder (User-ID, Haushalt-ID etc.)
