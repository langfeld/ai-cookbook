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
- **Rezept-Import: Instant-Modus** — schnelleres KI-Parsing ohne Thinking
- **Einkaufslisten-Check: Instant-Modus** — schnellerer KI-Review ohne Thinking
- **Upload-Größe** konfigurieren
- **REWE-Integration** ein-/ausschalten
- **Max. Haushaltsmitglieder** konfigurieren (Standard: 10)
- **Max. Haushalte pro Benutzer** konfigurieren (Standard: 3)

## Zutaten-Icons

- Keyword→Emoji-Mappings verwalten (Hinzufügen, Bearbeiten, Löschen)
- Integrierter **Emoji-Picker**
- Tabs für: Mappings / verwendete Zutaten / fehlende Zutaten

## Datei-Bereinigung

Verwaiste Upload-Dateien automatisch erkennen und entfernen.

## Datenverwaltung

Zentrale Seite für alle Export/Import-Funktionen:

### Einzel-Exporte/-Importe

| Datentyp | Export | Import |
|---|---|---|
| **Benutzer** | JSON (ohne Passwörter) | JSON (Zufallspasswort) |
| **Rezepte** | JSON (nach Benutzer filterbar, inkl. Nährwerte & Bilder) | JSON (Benutzer zuweisbar, max. 500) |
| **Vorratsschrank** | JSON (nach Benutzer filterbar) | JSON/CSV (Zielbenutzer wählbar) |
| **REWE-Präferenzen** | JSON (pro Benutzer filterbar) | JSON |
| **Zutaten-Einstellungen** | JSON (Aliase + Blockierungen) | JSON |
| **SQLite-Datenbank** | Datei-Download | — |

### JSON-Komplett-Backup

Exportiert und importiert **alle Benutzerdaten** in einer einzigen JSON-Datei — ideal für Server-Migration.

| Feature | Beschreibung |
|---|---|
| **Multi-User-Export** | Alle Benutzer inkl. Rezepte, Nährwerte, Sammlungen, Vorräte, Wochenpläne, Einkaufslisten, Sperren, Aliase |
| **Haushalte** | Haushalte mit Mitgliedern werden mitexportiert |
| **Auto-Zuordnung** | Import ordnet Daten automatisch per Username zu |
| **Fehlende Benutzer anlegen** | Optional: fehlende User werden mit sicherem Zufallspasswort erstellt |
| **Überschreiben-Modus** | Optional: bestehende Daten mit Backup-Daten ersetzen (für Migration) |
| **Bilder** | Optional als Base64 einbettbar |

## Haushalt-Verwaltung

- Alle Haushalte **anzeigen** (Name, Mitgliederzahl, Erstellt-Datum)
- Haushalte **auflösen** (alle Mitgliedschaften und `household_id`-Referenzen werden aufgelöst)
- **Statistiken** — Gesamtanzahl Haushalte und durchschnittliche Mitglieder im Dashboard

## Aktivitätslog

Alle Admin-Aktionen werden protokolliert — nachvollziehbar, wer was wann gemacht hat.
