---
title: Bekannte Einschränkungen
description: Aktuelle Limitierungen und bekannte Probleme.
---

## Vue Transition

Alle Views müssen **genau ein Root-Element** haben — wegen `<Transition mode="out-in">` in `App.vue`.

## REWE-API

Inoffizielle API, kann sich ändern. Der Admin kann die Integration zentral deaktivieren.

## Bring!-API

Nutzt das Community-Paket `bring-shopping` (inoffiziell). Bring!-Passwörter werden AES-256-GCM-verschlüsselt in der DB gespeichert.

## KI-Genauigkeit

Foto-Import funktioniert am besten mit gut beleuchteten, scharfen Rezeptfotos.

## SQLite

Für **Single-Server-Betrieb** ausgelegt, nicht für horizontale Skalierung.

## Passwort ändern

Es gibt aktuell keine **Self-Service-Funktion** zum Passwort-Ändern. Admins können Passwörter über die Benutzerverwaltung zurücksetzen.

## API-Key Speicherung

API-Keys werden im Klartext in der SQLite-DB gespeichert. Akzeptabel für Self-Hosted-Betrieb, nicht für Multi-Tenant.

## Offline-Modus

- **Nur Einkaufsliste und Wochenplan** sind offline nutzbar — Rezeptimport, REWE-Matching, Bring!-Senden und Admin-Funktionen erfordern eine Verbindung
- **Optimistisches UI** — Offline-Änderungen werden sofort lokal angezeigt, die Queue-Synchronisation erfolgt bei Reconnect. Bei Server-Konflikten gilt die Server-Wahrheit (nach Sync wird der Store vom Server aktualisiert)
- **localStorage-Limit** — Pinia-Persistenz nutzt localStorage (~5 MB pro Origin). Sehr große Einkaufslisten/Wochenpläne könnten theoretisch das Limit erreichen
- **Kein Service Worker** — Die aktuelle Implementierung setzt auf Pinia-Persistenz + IndexedDB-Queue. Statische Assets werden nicht offline gecacht; die App muss mindestens einmal online geladen werden
- **Max 3 Retries** — Fehlgeschlagene Sync-Aktionen werden maximal 3× wiederholt, danach als `failed` markiert
