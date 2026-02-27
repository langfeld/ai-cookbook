---
title: Vorratsschrank
description: Ablaufdaten, Teilmengen, automatischer Nachschub und Rezept-Integration.
---

## Übersicht

Der Vorratsschrank trackt alle vorhandenen Lebensmittel mit Mengen, Einheiten und Ablaufdaten.

## Kategorie-Gruppierung

Vorräte werden nach Lebensmittelgruppen sortiert — übersichtlich auch bei großen Beständen.

## Ablaufdaten (MHD)

- **MHD-Tracking** mit Warnungen bei bald ablaufenden Artikeln
- **Badge in der Navigation** — zeigt die Anzahl der bald ablaufenden Artikel

## Verbrauchsfunktion

Teilmengen entnehmen — z. B. „150 g von 500 g Mehl verbrauchen".

## Automatischer Nachschub

- Überschüsse aus **abgeschlossenen Einkäufen** werden automatisch erfasst
- Einzelne Artikel können aus der Einkaufsliste direkt **in den Vorratsschrank verschoben** werden

## Rezept-Integration

- **Vorratsmengen** werden direkt in der Rezept-Detailansicht angezeigt
- Beim **Kochen** (auch ohne Wochenplan) werden verwendete Zutaten automatisch abgezogen
- Im **Mengenanpassungsmodus** zeigt das Eingabefeld den verfügbaren Vorrat farbkodiert an

## Export / Import

- **Export** als CSV (Semikolon-getrennt) oder JSON
- **Import** von CSV oder JSON — bestehende Einträge werden automatisch zusammengeführt (Menge addiert)
- Unterstützte Trennzeichen: Semikolon (`;`) und Komma (`,`), BOM wird automatisch entfernt

### CSV-Format

```csv
Zutat;Menge;Einheit;Kategorie;MHD;Notizen
Mehl;2;kg;Backwaren;2026-12-31;Weizenmehl Type 405
Milch;1;l;Milchprodukte;2026-02-25;
```

→ Siehe auch [Export & Import](/docs/guides/export-import/) für die Admin-Funktionen.
