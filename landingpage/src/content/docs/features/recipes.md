---
title: Rezeptverwaltung
description: KI-Import, Kochmodus, Sammlungen und alle Rezept-Features im Detail.
---

## KI-Foto-Import

Rezepte per Foto importieren — auch mehrseitige Rezeptkarten. Die KI erkennt:

- **Zutaten** mit Mengen und Einheiten
- **Kochschritte** als strukturierte Anleitung
- **Schwierigkeitsgrad** (einfach, mittel, schwer)
- **Kategorien** — werden automatisch vorgeschlagen

Unterstützt **Multi-Bild-Upload** für Rezepte, die über mehrere Seiten gehen.

## KI-Text-Import

Alternativ ein Rezept als **Freitext** beschreiben — die KI strukturiert es automatisch in das Rezeptformat mit Zutaten, Schritten und Metadaten.

## KI-Überarbeitung

Bestehende Rezepte per KI umschreiben lassen — direkt aus der Rezeptansicht:

- **Freitext-Anweisungen** — beschreibe die gewünschten Änderungen (z.B. „Bohnen anbraten statt marinieren, mit Soja-Sauce")
- **Überschreiben oder Kopie** — wähle ob das Original aktualisiert oder ein neues Rezept erstellt wird
- **Wochenplan-Konfliktprüfung** — Warnung wenn das Rezept in einem fixierten, noch ungekochten Wochenplan steht (bereits gekochte Einträge lösen keine Warnung aus)
- **Konsistente Überarbeitung** — Titel, Beschreibung, Zutaten und Zubereitungsschritte werden zusammenhängend angepasst; Bild und Kategorien bleiben erhalten
- **Sicherheit** — Rate-Limit (5 Anfragen / 15 Min.), Eingabelimit (2000 Zeichen), KI-Output wird sanitiert und strukturell validiert

## Bildzuschnitt

Integrierter Cropper mit:
- Seitenverhältnissen: 4:3, 1:1, 16:9, Frei
- Drehen und Zuschneiden
- Direkte Vorschau

## Kategorien

Frei anlegbare Kategorien mit **Icons** und **Farben**. Werden beim KI-Import automatisch vorgeschlagen und können manuell zugewiesen werden.

## Zutaten-Icons

Emoji-Zuordnungen für Zutaten (z. B. 🍅 Tomate, 🧄 Knoblauch):
- Über den **Admin-Bereich** verwaltbar
- Integrierter **Emoji-Picker**
- Werden in der Rezeptansicht und im Kochmodus angezeigt

## Farbige Zutatenerkennung

Zutaten werden in den Kochschritten **farblich hervorgehoben** — so erkennst du auf einen Blick, welche Zutaten im aktuellen Schritt verwendet werden.

## Nährwerte

Jedes Rezept kann **Nährwerte pro Portion** enthalten:

- **Kalorien** (kcal), **Eiweiß** (g), **Kohlenhydrate** (g), **Fett** (g)
- Werden beim **KI-Import** (Foto, Text, URL) und bei der **KI-Überarbeitung** automatisch geschätzt
- Im Rezeptformular **manuell editierbar** (alle Felder optional)
- In der Rezeptansicht als dezente **farbige Badges** dargestellt
- Skalieren automatisch mit dem **Portionsrechner** — bei 2 statt 4 Portionen halbieren sich die Werte

## Portionsrechner

Zutatenmengen dynamisch umrechnen: Portionszahl ändern → alle Mengen werden proportional angepasst.

## Mengenanpassung

Im Anpassungsmodus einzelne Zutatenmengen editieren (z. B. mehr Soße):
- Direkt neben dem Eingabefeld wird der **verfügbare Vorrat** angezeigt: `[250] / 150 g`
- **Farbkodiert** nach Verfügbarkeit (grau = ausreichend, amber = teilweise, rot = leer)
- Änderungen gelten nur für die aktuelle Sitzung
- Beim Kochen werden die angepassten Mengen aus dem Vorratsschrank abgezogen

## Kochhistorie

Protokoll, wann welches Rezept zuletzt gekocht wurde. Wird vom Wochenplaner-Algorithmus für die Rotation berücksichtigt.

## Favoriten

Lieblingsrezepte markieren und in der Übersicht filtern.

## Sammlungen

Rezepte in frei erstellbare Sammlungen organisieren:
- Eigener **Name**, **Icon** und **Farbe** pro Sammlung
- Ein Rezept kann **mehreren Sammlungen** angehören
- Als **Filter** in der Rezeptübersicht und im Wochenplaner verwendbar

## Kochmodus

Immersiver Vollbild-Kochmodus mit Schritt-für-Schritt-Anleitung:

- **Swipe-Navigation** — Touch oder Tastatur (←/→) zwischen Kochschritten
- **Zutaten-Seitenleiste** — Desktop: permanent sichtbar, Mobile: ausklappbares Overlay mit Emoji-Icons
- **Farbige Zutatenerkennung** im aktiven Schritt
- **Persistenter Timer** — localStorage-basiert, überlebt Seitenwechsel
- **WakeLock-API** — verhindert Bildschirm-Abdunklung beim Kochen
- **Automatischer Vorratsabzug** beim Abschließen des Kochvorgangs
