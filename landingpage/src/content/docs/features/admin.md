---
title: Admin-Bereich
description: Dashboard, Benutzerverwaltung, Systemeinstellungen und Datenverwaltung.
---

## Dashboard

- **Systemstatistiken** — Benutzer, Rezepte, KI-Imports, Speicherverbrauch
- **Beliebteste Rezepte** — Top-Rezepte nach Kochhäufigkeit
- **Admin-Aktivitätslog** — Wer hat was wann gemacht?

## Benutzerverwaltung

- Alle Benutzer **anzeigen und suchen**
- **Rollen ändern** — Admin/User
- Konten **sperren/entsperren**
- **Passwort zurücksetzen**
- Benutzer **löschen** (mit allen Daten)

## Systemeinstellungen

- **Registrierung** aktivieren/deaktivieren
- **Wartungsmodus**
- **KI-Anbieter** wählen (inkl. schnelles Modell für einfache Aufgaben)
- **Upload-Größe** konfigurieren
- **REWE-Integration** ein-/ausschalten

## Zutaten-Icons

- Keyword→Emoji-Mappings verwalten (Hinzufügen, Bearbeiten, Löschen)
- Integrierter **Emoji-Picker**
- Tabs für: Mappings / verwendete Zutaten / fehlende Zutaten

## Datei-Bereinigung

Verwaiste Upload-Dateien automatisch erkennen und entfernen.

## Datenverwaltung

Zentrale Seite für alle Export/Import-Funktionen:

| Datentyp | Export | Import |
|---|---|---|
| **Benutzer** | JSON (ohne Passwörter) | JSON (temporäres Passwort) |
| **Rezepte** | JSON (nach Benutzer filterbar, mit Bildern) | JSON (Benutzer zuweisbar, max. 500) |
| **Vorratsschrank** | JSON (nach Benutzer filterbar) | JSON/CSV (Zielbenutzer wählbar) |
| **REWE-Präferenzen** | JSON (pro Benutzer filterbar) | JSON |
| **Zutaten-Einstellungen** | JSON (Aliase + Blockierungen) | JSON |
| **Komplett-Backup** | SQLite-Datei | — |

## Aktivitätslog

Alle Admin-Aktionen werden protokolliert — nachvollziehbar, wer was wann gemacht hat.
