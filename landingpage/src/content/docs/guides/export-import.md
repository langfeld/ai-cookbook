---
title: Export & Import
description: Rezepte, Vorräte, Einstellungen und Komplett-Backups exportieren und importieren.
---

## Rezept Export/Import

### Export-Format (JSON)

```json
{
  "version": "1.0",
  "exported_at": "2026-02-14T12:00:00.000Z",
  "source": "Zauberjournal",
  "recipe_count": 3,
  "recipes": [
    {
      "title": "Spaghetti Carbonara",
      "description": "Klassische italienische Pasta",
      "servings": 4,
      "prep_time": 10,
      "cook_time": 20,
      "total_time": 30,
      "difficulty": "mittel",
      "is_favorite": 1,
      "notes": "Persönliche Notizen...",
      "calories": 550,
      "protein": 22,
      "carbs": 65,
      "fat": 18,
      "categories": [
        { "name": "Abendessen", "icon": "🌙", "color": "#6366f1" }
      ],
      "ingredients": [
        { "name": "Spaghetti", "amount": 400, "unit": "g", "group_name": null, "sort_order": 0 }
      ],
      "steps": [
        { "step_number": 1, "title": "Pasta kochen", "instruction": "Spaghetti al dente kochen", "duration_minutes": 10 }
      ],
      "image_base64": "...(optional)...",
      "image_mime": "image/webp"
    }
  ]
}
```

### Funktionen

| Feature | Benutzer | Admin |
|---------|----------|-------|
| Eigene Rezepte exportieren | ✅ | ✅ (nach Benutzer filterbar) |
| Bilder als Base64 einbetten | ✅ | ✅ |
| Rezepte importieren | ✅ (eigene) | ✅ (beliebigem User zuweisbar) |
| Max. Rezepte pro Import | 100 | 500 |
| Fehlende Kategorien erstellen | ✅ automatisch | ✅ automatisch |
| Bilder aus Base64 wiederherstellen | ✅ | ✅ |
| Drag & Drop Upload | ✅ | ✅ |
| Datei-Vorschau | ✅ | ✅ |

## Vorratsschrank Export/Import

### Benutzer
- **Export** als CSV (Semikolon-getrennt) oder JSON direkt aus dem Vorratsschrank
- **Import** von CSV oder JSON — bestehende Einträge werden zusammengeführt (Menge addiert)

### Admin
- **Export** aller Vorräte als JSON (`?user_id=X` zum Filtern)
- **Import** mit Zielbenutzer-Auswahl

### CSV-Format

```csv
Zutat;Menge;Einheit;Kategorie;MHD;Notizen
Mehl;2;kg;Backwaren;2026-12-31;Weizenmehl Type 405
Milch;1;l;Milchprodukte;2026-02-25;
```

:::note
Unterstützte Trennzeichen: Semikolon (`;`) und Komma (`,`). BOM wird automatisch entfernt.
:::

## Zutaten-Einstellungen Export/Import

Aliase und blockierte Zutaten als JSON exportieren und importieren — über die **„Meine Daten"**-Seite.

## Komplett-Backup (Admin)

Im Admin-Bereich unter *Datenverwaltung*:

| Datentyp | Export | Import |
|---|---|---|
| Benutzer | ✅ (JSON, ohne Passwörter) | ✅ (temporäres Passwort) |
| Rezepte | ✅ (JSON, mit Bildern) | ✅ (Benutzer zuweisbar) |
| Vorratsschrank | ✅ (JSON) | ✅ (CSV/JSON) |
| REWE-Präferenzen | ✅ (JSON) | ✅ |
| Zutaten-Einstellungen | ✅ (JSON) | ✅ |
| SQLite-Datenbank | ✅ (Datei-Download) | — |

## „Meine Daten"-Seite

Jeder Benutzer hat Zugriff auf eine persönliche Datenverwaltungsseite:
- Rezepte exportieren/importieren
- Vorräte exportieren/importieren
- Zutaten-Einstellungen exportieren/importieren
- REWE-Präferenzen exportieren/importieren
- Komplett-Backup aller eigenen Daten
