---
title: Wochenplaner
description: Score-basierter Algorithmus mit KI-Reasoning, Rezept-Sperren und Portionensteuerung.
---

## Score-basierter Algorithmus

Der Wochenplaner berechnet für jedes Rezept einen **Score**, der folgende Faktoren berücksichtigt:

- **Kochhistorie** — Rezepte, die lange nicht gekocht wurden, werden bevorzugt
- **Rezeptrotation** — Vermeidet Wiederholungen
- **Favoriten** — Lieblingsrezepte erhalten einen Bonus
- **Schwierigkeitsgrad** — Berücksichtigt die Verteilung über die Woche
- **Zutatensynergien** — Rezepte mit gemeinsamen Zutaten nahe beieinander
- **Vorräte** — Vorhandene Vorräte werden bevorzugt eingeplant

## KI-Reasoning (optional)

Falls ein KI-Provider konfiguriert ist, generiert die KI eine **kurze Begründung** zum Plan — warum welches Rezept an welchem Tag eingeplannt wurde. Das ist kein Pflichtfeature.

## 4 Mahlzeiten pro Tag

Jeder Tag bietet Slots für:
- Frühstück
- Mittagessen
- Abendessen
- Snack

## 7-Tage-Raster

Horizontal scrollbares Wochen-Raster — auch auf **Mobile** voll nutzbar.

## Sammlungs-Filter

Plan-Generierung optional auf bestimmte **Sammlungen** beschränken:
- Mehrfachauswahl möglich
- Deduplizierungs-Option für Rezepte in mehreren Sammlungen

## Rezept-Sperren

Einzelne Rezepte für **1–52 Wochen** aus der Generierung ausschließen:
- Optionaler Grund (z. B. „saisonale Zutaten nicht verfügbar")
- Verwaltung in den Einstellungen
- Automatischer Ablauf nach der gesetzten Dauer

## Portionen pro Mahlzeit

Portionszahl je Eintrag direkt im Wochenplaner anpassen:
- Klick auf die Personenzahl öffnet ein Popup
- −/+ Steuerung (viewport-optimiert für Mobile)

## Plan sperren

Wochenplan manuell fixieren, um versehentliche Änderungen zu verhindern.

### Auto-Lock

Wird der Einkauf einer verknüpften Einkaufsliste abgeschlossen, wird der zugehörige Wochenplan **automatisch gesperrt**.

## Plan löschen

Einzelne Wochenpläne können gelöscht werden:
- Löschen-Button direkt im **Wochenplaner** (Header-Leiste)
- Löschen auch über die **Einkaufsliste** möglich (Papierkorb-Icon in der Wochenauswahl)
- Verknüpfte **Einkaufslisten bleiben erhalten** (Verknpfung wird aufgehoben)
- Gesperrte Pläne müssen erst entsperrt werden
- Bestätigungsdialog vor dem Löschen
