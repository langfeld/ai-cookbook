---
title: Haushalt-Sharing
description: Gemeinsame Nutzung von Rezepten, Wochenplänen, Einkaufslisten und Vorräten im Haushalt.
---

## Konzept

Zauberjournal unterstützt ein **Hybrid-Modell** aus Haushalt-Sharing und Einzel-Sharing:

- **Haushalt** — ein gemeinsamer Datenraum, in dem mehrere Nutzer Rezepte, Wochenpläne, Einkaufslisten, Vorräte und Kategorien teilen
- **Rezept-Link-Sharing** — einzelne Rezepte per Link mit beliebigen Personen teilen (auch ohne Account)

Alle Haushaltsmitglieder haben **gleiche Berechtigungen** — es gibt keine Rollen innerhalb eines Haushalts.

## Haushalt erstellen

Über die **Haushalt-Seite** einen neuen Haushalt anlegen:
- Name vergeben (z. B. „Familie Müller", „WG Küche")
- Der Ersteller wird automatisch Mitglied
- Pro Benutzer können bis zu **3 Haushalte** erstellt werden (konfigurierbar)

## Einladungen

Andere Nutzer per **Einladungscode** hinzufügen:
- Code generieren (8 Zeichen, gültig für **48 Stunden**)
- Code teilen (in die Zwischenablage kopieren)
- Empfänger gibt den Code auf der Haushalt-Seite ein → wird sofort Mitglied
- Pro Haushalt max. **10 Mitglieder** (konfigurierbar über Admin-Einstellungen)

## Geteilte Daten

Nach dem Beitritt sehen alle Mitglieder die gleichen Daten:

| Datentyp | Geteilt |
|----------|---------|
| Rezepte (mit `household_id`) | ✅ |
| Kategorien | ✅ |
| Sammlungen | ✅ |
| Wochenpläne | ✅ |
| Einkaufslisten | ✅ |
| Vorratsschrank | ✅ |
| Zutaten-Aliase & Blockierungen | ✅ |
| Rezept-Sperren | ✅ |
| REWE-Produktpräferenzen | ❌ (bleiben privat) |
| Bring!-Verbindung | ❌ (bleibt privat) |

:::note
Private Rezepte (ohne `household_id`) bleiben nur für den Ersteller sichtbar. Beim Haushalt-Beitritt werden bestehende Daten **nicht automatisch** dem Haushalt zugeordnet — das erfordert eine explizite Datenmigration.
:::

## Datenmigration

Bestehende persönliche Daten können über die Haushalt-Seite **in den Haushalt migriert** werden:
- Betroffen: Rezepte, Kategorien, Sammlungen, Wochenpläne, Einkaufslisten, Vorräte, Aliase, Sperren
- Einmalige Aktion, kann nicht rückgängig gemacht werden
- Danach sind alle migrierten Daten für alle Mitglieder sichtbar

## Haushalt wechseln

Wer Mitglied in mehreren Haushalten ist, kann über die Haushalt-Seite den **aktiven Haushalt** wechseln. Der aktive Haushalt bestimmt, welche Daten in allen Views (Rezepte, Wochenplan, Einkaufsliste etc.) angezeigt werden.

## Echtzeit-Synchronisation

Änderungen anderer Haushaltsmitglieder werden **in Echtzeit** per SSE (Server-Sent Events) empfangen:
- Neues Rezept erstellt → sofort bei allen sichtbar
- Einkaufsliste aktualisiert → Artikel erscheint live
- Wochenplan geändert → Plan wird aktualisiert
- Vorratsschrank aktualisiert → Bestand wird live angezeigt

Die SSE-Verbindung wird automatisch aufgebaut und bei Haushalt-Wechsel neu verbunden.

## Haushalt verlassen / auflösen

- **Verlassen** — Mitglied kann jederzeit den Haushalt verlassen. Eigene Daten bleiben bestehen, `household_id` wird auf `NULL` gesetzt
- **Auflösen** — Der letzte verbleibende Nutzer kann den Haushalt löschen. Alle `household_id`-Referenzen werden auf `NULL` gesetzt, Daten gehen nicht verloren

## Rezeptvorschläge aus dem Haushalt

Im Wochenplaner steht ein **Haushalt-Tab** in der Vorschlagsbox zur Verfügung:
- Zeigt die **beliebtesten Rezepte** im Haushalt (am häufigsten in Wochenpläne eingeplant)
- Ergänzt durch **Favoriten** anderer Haushaltsmitglieder
- Bereits im aktuellen Wochenplan vertretene Rezepte werden automatisch ausgeblendet
- Maximal 6 Vorschläge — per Drag & Drop (Desktop) oder Tap-Dialog (Mobile) direkt einplanbar

## Aktivitäts-Feed

Auf der Haushalt-Seite wird ein **Aktivitätsprotokoll** angezeigt:
- Wer ist beigetreten / hat verlassen
- Einladungen erstellt
- Datenmigration durchgeführt
- etc.

## Rezept-Link-Sharing

Einzelne Rezepte können **per Link geteilt** werden — unabhängig vom Haushalt:
- In der Rezeptansicht über „Teilen" einen Share-Link generieren
- Link enthält ein **kryptografisches Token** (32 Byte, hex-encoded)
- Link ist **7 Tage** gültig (konfigurierbar)
- Empfänger sieht das Rezept **ohne Login** (öffentliche Ansicht)
- Eingeloggte Nutzer können das Rezept **importieren** (Kopie in die eigene Sammlung)
- Native Share API auf Mobilgeräten, Zwischenablage-Fallback auf Desktop

## Haushalt-Export

Alle Daten eines Haushalts können als **JSON exportiert** werden — inklusive Rezepte, Kategorien, Vorräte, Wochenpläne, Einkaufslisten, Aliase und Mitglieder-Info.
