---
title: Einkaufsliste
description: Automatische Generierung, Zutaten-Zusammenführung, Alias-System und Verlauf.
---

## Automatische Generierung

Die Einkaufsliste wird **direkt aus dem Wochenplan** generiert:
- Intelligente **Duplikat-Konsolidierung** — gleiche Zutaten werden zusammengefasst
- **Einheiten-Normalisierung** — g + kg, ml + l etc. werden umgerechnet

## Wochenplan-Auswahl

Beim Generieren aus dem Wochenplan wird eine übersichtliche **Wochenauswahl** angeboten:
- Nur Wochen mit tatsächlich vorhandenen Plänen werden angezeigt
- **Kalenderwoche** (KW) + Datumsspanne für schnelle Orientierung
- **Rezept-Vorschau** mit Thumbnails der geplanten Gerichte
- **AKTUELL**-Badge für die laufende Woche
- **EINGEKAUFT**-Badge für Wochen, die bereits eine Einkaufsliste haben
- Option: **Vergangene Tage einbeziehen** (Toggle — standardmäßig aus)
- **Wochenplan löschen** — Papierkorb-Icon direkt neben jedem Plan (mit Bestätigungsdialog)

## Vorratsabgleich

Vorhandene Vorräte werden automatisch abgezogen, mit Anzeige, was abgezogen wurde.

## Vorratscheck

Aufklappbare Sektion in der Einkaufsliste, die zeigt, welche Zutaten für die Rezepte des Wochenplans **im Vorrat vorhanden sein sollten**:

- Pro Rezept: Zutatenliste mit Status (**gedeckt** oder **teilweise vorhanden**)
- Berechnung basiert auf den freien Vorräten (nicht bereits anderen Rezepten zugeordnet)
- Nicht mehr vorhandene Zutaten per Klick direkt **zur Einkaufsliste hinzufügen**
- Vorrat wird dabei automatisch angepasst
- Neu hinzugefügte Artikel werden in der richtigen Kategorie eingefügt und **kurz hervorgehoben**

## Gruppierung nach Abteilungen

Items werden nach Supermarkt-Abteilungen sortiert:
- Obst & Gemüse
- Milchprodukte
- Fleisch & Fisch
- Backwaren
- etc.

## Manuelles Hinzufügen/Löschen

Eigene Artikel ergänzen oder entfernen — unabhängig vom Wochenplan.

## Rezept-Verknüpfung

Zu jedem Artikel sehen, aus **welchem Rezept** er stammt (mit Thumbnail, ein-/ausblendbar).

## Fortschrittsbalken

Visueller Einkaufsfortschritt — wie viel wurde schon abgehakt?

## Einkauf abschließen

Abgehakte Artikel landen automatisch im **Vorratsschrank**. Ist die Liste mit einem Wochenplan verknüpft, wird dieser automatisch gesperrt.

## Einkaufslisten-Verlauf

Vorherige Einkaufslisten bleiben erhalten und können jederzeit:
- Wieder geladen und reaktiviert werden
- Nach Datum durchsucht werden
- Mit Fortschrittsanzeige eingesehen werden

## Zutaten zusammenfassen (Multi-Merge)

Gleiche Zutaten mit unterschiedlichen Schreibweisen zusammenführen:
- z. B. „Knoblauch" und „Knoblauchzehe" → ein Eintrag
- **Multi-Merge**: beliebig viele Artikel gleichzeitig auswählen
- Kanonischen Namen wählen

## Automatische Alias-Auflösung

Gespeicherte Zuordnungen (Aliases) werden bei jeder neuen Einkaufslistengenerierung **automatisch angewandt**, sodass zusammengeführte Zutaten dauerhaft konsolidiert bleiben.

## Alias-Verwaltung

Alle gespeicherten Zutatenzuordnungen einsehen und einzeln löschen (Split-Button in der Einkaufsliste).

## Zutaten blockieren

Zutaten für zukünftige Einkaufslisten blockieren:
- **Auswahl-Modus** (wie Zusammenfassen) — beliebig viele Artikel markieren
- Bestätigung → dauerhaft blockiert
- Blockierte Zutaten werden bei der Listengenerierung automatisch übersprungen

## Block-Verwaltung

Alle blockierten Zutaten einsehen und einzeln freigeben.

## In Vorratsschrank verschieben

Einzelne Artikel direkt vom Einkaufszettel in den Vorratsschrank übertragen — noch vor dem Einkaufsabschluss.
