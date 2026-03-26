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

## KI-Überprüfung (KI-Check)

Eine KI-gestützte Überprüfung der Einkaufsliste, die automatisch oder manuell ausgelöst werden kann:

### Prüfungen

| Typ | Beschreibung | Farbe |
|-----|-------------|-------|
| **Fehlende Zutaten** | Zutaten aus Rezepten, die weder auf der Liste noch im Vorrat sind | Orange |
| **Mengen-Logik** | Stückzahlen vs. Packungseinheiten (z.B. „4 Tortillas“ ≠ 4 Packungen) | Amber |
| **Vorrats-Abdeckung** | Artikel die der Vorrat bereits abdeckt | Grün |
| **Plausibilität** | Ungewöhnlich hohe/niedrige Mengen | Amber |
| **Duplikate** | Semantisch gleiche Zutaten als separate Einträge | Amber |
| **REWE-Zuordnungsfehler** | Falsches REWE-Produkt zugewiesen (z.B. „Bohnen“ → „Bohnenaufstrich“) | Rot |
| **Fehlende REWE-Artikel** | Zutaten ohne REWE-Produktzuordnung | Rot |

### Features

- **Manueller KI-Check** — violetter Button in der Kopfzeile mit Badge-Counter für offene Hinweise
- **Automatischer KI-Check** — optional beim Generieren der Einkaufsliste (User-Setting)
- **KI-Check nach REWE-Abgleich** — optional nach dem REWE-Produktmatching automatisch einen KI-Check durchführen (User-Setting)
- **Inline-Hinweise** — farbcodierte Hinweise direkt am betroffenen Artikel mit Rezept-Verlinkung
- **Globale Hinweise** — für Issues ohne Artikelbezug (z.B. fehlende Zutaten)
- **Vorschläge anwenden** — Ein-Klick-Aktionen: Entfernen, Abhaken, Hinzufügen, Menge anpassen, Zusammenführen
- **Intelligentes Zusammenführen** — Duplikate werden KI-gestützt zusammengeführt (Mengen-Berechnung, Einheiten-Konvertierung, z.B. 1 Pkg + 200g → 1 Pkg)
- **Auto-Resolve** — hohe Vorrats-Abdeckung (Konfidenz ≥ 90%) wird automatisch abgehakt
- **Vergangene Tage beachtet** — übersprungene Wochentage werden nicht als fehlend gemeldet
- **Semantische Zutatenerkennung** — Wortreihenfolge, Singular/Plural und Varianten werden erkannt (z.B. „Zwiebel rot" = „Rote Zwiebel")
- **REWE-Prüfungen optional** — REWE-spezifische Checks (6 + 7) nur wenn ein REWE-Abgleich durchgeführt wurde
- **Admin-Toggle** — zwischen Thinking-Modus (gründlicher) und Instant-Modus (schneller) umschaltbar

## Mengen bearbeiten

Artikel-Mengen direkt in der Einkaufsliste bearbeiten:

- **Klick auf Menge** — öffnet einen Inline-Editor zum Anpassen von Menge und Einheit
- **Pflichtmenge** — zeigt die Mindestmenge basierend auf den Rezepten an
- **Warnung** — wenn die eingegebene Menge unter der benötigten Pflichtmenge liegt

## Intelligente Duplikat-Erkennung

Optionale KI-gestützte Zusammenführung ähnlicher Zutaten beim Generieren der Einkaufsliste:

- **Synonyme** — „Butter“ und „Frische Butter“
- **Singular/Plural** — „Tomate“ und „Tomaten“
- **Wortreihenfolge** — „Paprika rot“ und „rote Paprika“
- **Schreibvarianten** — „Joghurt“ und „Jogurt“
- **Dedup-Hinweis** — zusammengeführte Artikel zeigen einen blauen Info-Hinweis mit der Merge-Erklärung
- Aktivierbar über **⚙️ Einstellungen → 🤖 KI → Intelligente Duplikat-Erkennung**

## Offline-Modus

Die Einkaufsliste funktioniert auch **ohne Netzwerkverbindung**:

- **Artikel abhaken** — optimistisches UI-Update, Aktion wird in IndexedDB-Queue gespeichert
- **Artikel hinzufügen/löschen** — ebenfalls offline verfügbar, automatisch synchronisiert
- **Sync-Indikator** — Wolken-Icon an Artikeln mit ausstehender Synchronisation
- **Offline-Banner** — zeigt Status und Anzahl ausstehender Änderungen
- **Automatische Synchronisation** — Queue wird bei Netzwerkrückkehr automatisch abgearbeitet (FIFO)
- **Idempotente API** — Backend-Endpunkte sind idempotent, sodass doppelte Syncs keine Probleme verursachen
- **Online-only Features** — REWE-Abgleich, Wochenplan-Generierung und Bring!-Senden werden offline deaktiviert
