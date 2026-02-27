---
title: REWE-Integration
description: Automatisches Produktmatching, Preisoptimierung, Produkt-Picker und Tampermonkey-Userscript.
---

## Übersicht

Die REWE-Integration ordnet alle Einkaufslisteneinträge automatisch REWE-Produkten zu — mit Preisoptimierung, Live-Fortschritt und der Möglichkeit, den Warenkorb direkt zu füllen.

:::note
Die REWE-Integration nutzt eine inoffizielle API und kann vom Admin zentral aktiviert/deaktiviert werden.
:::

## Automatisches Produkt-Matching

Alle Zutaten werden per **SSE-Stream** mit Live-Fortschrittsanzeige REWE-Produkten zugeordnet.

### Relevanz-Scoring

Intelligenter Algorithmus mit:
- **Compound-Wort-Erkennung** (z. B. „Knoblauch" in „Knoblauchzehe")
- **Flavor-Filter** — filtert irrelevante Produkte (Saft, Bonbon, Duschgel etc.)
- **Grundpreis-Sortierung** — günstigstes Produkt zuerst

### Grundpreis-Optimierung

- Grammage-Parsing aus REWE-API (€/kg, €/l, €/Stück)
- Fallback auf Packungsgrößen-Berechnung
- **KI-gestützte Produktauswahl**: 12 Kandidaten aus 15 Suchergebnissen

### Intelligente Mengenberechnung

- Packungsgrößen-Parsing (g, kg, ml, l, Stück)
- Stückzahl-Erkennung aus Produktnamen (Duo, Trio, 6er-Pack, etc.)
- Automatische Einheiten-Konvertierung

## Produkt-Picker

Alternatives REWE-Produkt suchen und auswählen:
- Suchfeld mit Vorschlägen
- Relevanz-Badge
- Preis-Anzeige

## Produkt-Präferenzen

Manuell gewählte Produkte werden gespeichert und beim nächsten Matching **automatisch bevorzugt** (mit Preisaktualität).

## Preisübersicht

Geschätzte Gesamtkosten und Einzelpreise pro Artikel — direkt in der Einkaufsliste.

## REWE-Bestell-Panel

Alle zugeordneten Produkte auf einen Blick, mit Link zum REWE-Onlineshop.

## Warenkorb-Script

Generiert ein **Browser-Konsolenscript**, das alle gematchten Produkte automatisch in den REWE-Warenkorb legt (Listing-ID-basiert, mit Fortschrittsanzeige).

## Tampermonkey-Userscript

Installiert sich als **Browser-Extension** auf rewe.de:

- **Floating Action Button** (🍳) auf rewe.de
- **Panel** mit Produktliste und Status pro Artikel (✅/❌/⚠️)
- **Automatisches Einfügen** in den Warenkorb
- Kommuniziert per `GM_xmlhttpRequest` **CORS-frei** mit der API

### Dauerhafter API-Key

- Key wird beim Installieren automatisch eingebettet
- Kann **jederzeit ohne Neuinstallation** über einen Eingabe-Dialog im Userscript aktualisiert werden
- Kein Token-Ablauf

## API-Key-Management

Im Frontend:
- API-Key **generieren**, anzeigen, kopieren und widerrufen
- Das Userscript-Panel auf rewe.de zeigt bei ungültigem Key automatisch einen Eingabe-Dialog

## Marktsuche

REWE-Markt per **PLZ** finden. Jeder Benutzer wählt seinen eigenen Markt in den REWE-Einstellungen der Einkaufsliste.
