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

## KI-Vorratsabzug beim Kochen

Beim Kochen (Kochmodus oder Wochenplan) werden verwendete Zutaten **KI-gestützt** aus dem Vorratsschrank abgezogen:

- **Semantisches Matching** — die KI erkennt Synonyme und Varianten (z. B. „Sahne" im Vorrat passt zu „Schlagsahne" im Rezept)
- **Einheiten-Konvertierung** — unterschiedliche Einheiten werden intelligent umgerechnet (ml ↔ l, g ↔ kg)
- **Teilmengen-Erkennung** — „2 Knoblauchzehen" werden korrekt von „1 Knolle Knoblauch" abgezogen
- **Undo-Funktion** — der letzte KI-Vorratsabzug kann rückgängig gemacht werden (pro Rezept/Wochenplan-Eintrag)
- **Fallback** — wenn kein KI-Provider konfiguriert ist, wird der bisherige regelbasierte Abzug verwendet
- Aktivierbar über **Admin-Einstellungen → KI-Vorratsabzug**

## KI-Vorrats-Transfer (Einkaufsliste → Vorratsschrank)

Beim Verschieben eines Artikels aus der Einkaufsliste in den Vorratsschrank analysiert die KI den Produktnamen:

- **Namens-Normalisierung** — Marken, Prozentangaben, Verpackungshinweise werden entfernt (z. B. „Bio-Vollmilch 3.5%" → „Vollmilch")
- **Vorhandene Vorräte erkennen** — die KI findet semantisch passende Einträge im Vorratsschrank und ergänzt die Menge (z. B. „Barilla Penne Rigate" wird zu „Penne" hinzugefügt)
- **Intelligente Kategorie-Zuweisung** — neue Artikel erhalten eine passende Kategorie (z. B. „Emmentaler gerieben" → Milchprodukte) statt der Standard-Kategorie „Sonstiges"
- **Einheiten-Konvertierung** — Mengen werden in die Einheit des bestehenden Vorratseintrags umgerechnet
- **Non-Match-Schutz** — ähnlich klingende, aber verschiedene Zutaten werden korrekt als neue Einträge angelegt (z. B. „Tomatenmark" ≠ „Tomaten")
- **Fallback** — bei deaktivierter KI oder Fehler wird der bisherige direkte Transfer verwendet
- Aktivierbar über **Admin-Einstellungen → KI-Vorrats-Transfer**

## Rezept-Integration

- **Vorratsmengen** werden direkt in der Rezept-Detailansicht angezeigt
- Beim **Kochen** (auch ohne Wochenplan) werden verwendete Zutaten automatisch abgezogen
- Im **Mengenanpassungsmodus** zeigt das Eingabefeld den verfügbaren Vorrat farbkodiert an
- **Vorratscheck** in der Einkaufsliste — zeigt erwartete Vorräte für den Wochenplan, fehlende Zutaten können direkt zur Einkaufsliste verschoben werden

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
