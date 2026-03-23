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
- Verknüpfte **Einkaufslisten bleiben erhalten** (Verknüpfung wird aufgehoben)
- Gesperrte Pläne müssen erst entsperrt werden
- Bestätigungsdialog vor dem Löschen

## Tages-Nährwerte

Für jeden Tag im Wochenplan wird eine **Nährwert-Zusammenfassung** angezeigt:

- Summe aus allen Mahlzeiten des Tages (Kalorien, Eiweiß, Kohlenhydrate, Fett)
- Portionsbezogen berechnet — angepasste Portionen werden berücksichtigt
- Sichtbar in allen Ansichten: Kompakt-Grid, Karten-Ansicht, Tagesansicht und Mobile
- Erscheint nur, wenn mindestens eine Mahlzeit Nährwertdaten hat

## Rezeptvorschläge

Unterhalb des Wochenplans zeigt eine **aufklappbare Vorschlagsbox** Rezept-Ideen aus drei Quellen:

### Letzte Woche

Rezepte aus dem **Wochenplan der vergangenen Kalenderwoche** — praktisch, um erfolgreiche Gerichte schnell zu wiederholen.

### Vergangene Wochen

Siehe Rezepte aus **älteren Wochenplänen** per KW-Slider durch:
- Nur Wochen **mit Wochenplan** werden angezeigt — leere Wochen werden automatisch übersprungen
- Navigation über Pfeil-Buttons (älter / neuer)
- KW-Nummer wird als Label angezeigt

### Haushalt

Wenn der Benutzer einem **Haushalt** angehört, erscheint ein dritter Tab mit Empfehlungen:
- **Beliebteste Rezepte** im Haushalt (am häufigsten in Wochenpläne eingeplant)
- **Favoriten** anderer Haushaltsmitglieder
- Rezepte, die bereits im aktuellen Wochenplan enthalten sind, werden ausgeschlossen

### Drag & Drop (Desktop)

Auf Desktop-Geräten (Maus-Pointer) können Rezepte direkt aus der Vorschlagsbox per **Drag & Drop** in einen Wochenplan-Slot gezogen werden:
- Visuelles Drag-Handle (Grip-Icon) erscheint beim Hover
- **Auto-Plan-Erstellung** — wenn noch kein Wochenplan existiert, wird beim ersten Drop automatisch einer angelegt
- **Konflikt-Dialog** — wird ein Rezept auf einen bereits belegten Slot gezogen, erscheint ein Dialog mit Optionen: Ersetzen, anderen Slot wählen oder Abbrechen

### Mobile Tap-Aktion

Auf Touch-Geräten öffnet ein Tap auf eine Rezeptkarte ein **Bottom-Sheet** mit zwei Optionen:
- **Rezept öffnen** — Rezeptdetails anzeigen
- **Auf Tag planen** — Mahlzeit-Typ wählen, dann Tag antippen. Belegte Slots werden farblich markiert

## Offline-Modus

Der aktuelle Wochenplan ist auch **ohne Netzwerkverbindung** verfügbar:

- **Lokaler Cache** — Plan-Daten werden via Pinia-Persistenz in localStorage gespeichert
- **Gekocht-Markierung** — offline toggle-bar, wird bei Reconnect synchronisiert
- **Portionen ändern** — offline möglich, Queue-basierte Synchronisation
- **Optimistisches UI** — Änderungen werden sofort angezeigt, unabhängig vom Netzwerkstatus
- **Online-only Features** — Plan-Generierung, Rezept tauschen und Drag & Drop bleiben online-only
