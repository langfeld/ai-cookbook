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
