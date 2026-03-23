---
title: REST-API
description: Vollständige API-Referenz aller Endpunkte.
---

## Auth (`/api/auth`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/setup-status` | Prüft ob Ersteinrichtung nötig ist (öffentlich) |
| `POST` | `/register` | Neuen Benutzer registrieren (erster User → Admin) |
| `POST` | `/login` | Anmelden, JWT erhalten |
| `GET` | `/me` | Aktuellen Benutzer abrufen |
| `GET` | `/api-key` | Aktuellen API-Key abrufen (oder `null`) |
| `POST` | `/api-key` | Neuen API-Key generieren (Rate-Limit: 5/h) |
| `DELETE` | `/api-key` | API-Key widerrufen (Rate-Limit: 5/h) |

## Rezepte (`/api/recipes`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/` | Alle Rezepte (Filter, Suche, Pagination) |
| `GET` | `/:id` | Rezeptdetails mit Zutaten, Schritten, Historie |
| `POST` | `/` | Neues Rezept erstellen (inkl. optionaler Nährwerte) |
| `PUT` | `/:id` | Rezept bearbeiten (inkl. optionaler Nährwerte) |
| `DELETE` | `/:id` | Rezept löschen (inkl. Bild-Cleanup) |
| `POST` | `/import-photo` | KI-Foto-Import (Multi-Bild) |
| `POST` | `/import-text` | KI-Text-Import |
| `POST` | `/:id/image` | Bild hochladen/ersetzen |
| `POST` | `/:id/favorite` | Favorit togglen |
| `POST` | `/:id/cooked` | Als gekocht markieren (mit Vorratsabzug) |
| `POST` | `/:id/share` | Share-Link erstellen |
| `GET` | `/:id/revision-check` | Prüft Wochenplan-Konflikte vor KI-Überarbeitung |
| `POST` | `/:id/revise` | Rezept per KI überarbeiten (Rate-Limit: 5/15min) |
| `GET` | `/export` | Eigene Rezepte als JSON exportieren |
| `POST` | `/import` | Rezepte aus JSON importieren (max. 100) |

## Kategorien (`/api/categories`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/` | Alle Kategorien |
| `POST` | `/` | Kategorie erstellen |
| `PUT` | `/:id` | Kategorie bearbeiten |
| `DELETE` | `/:id` | Kategorie löschen |

## Sammlungen (`/api/collections`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/` | Alle Sammlungen mit Rezeptanzahl |
| `POST` | `/` | Neue Sammlung erstellen (Name, Icon, Farbe) |
| `PUT` | `/:id` | Sammlung bearbeiten |
| `DELETE` | `/:id` | Sammlung löschen (Rezepte bleiben) |
| `POST` | `/:id/recipes` | Rezepte zur Sammlung hinzufügen |
| `DELETE` | `/:id/recipes/:recipeId` | Rezept aus Sammlung entfernen |
| `GET` | `/for-recipe/:recipeId` | Sammlungen eines Rezepts abrufen |

## Wochenplaner (`/api/mealplan`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/generate` | Wochenplan generieren |
| `GET` | `/` | Aktuellen Plan abrufen (`?weekStart=YYYY-MM-DD`) |
| `GET` | `/history` | Vergangene Pläne |
| `GET` | `/available-weeks` | Wochen mit Plänen + Rezept-Thumbnails |
| `GET` | `/reasoning/:planId` | KI-Reasoning für einen Plan abrufen (Polling) |
| `GET` | `/suggestions` | Rezeptvorschläge für einen Slot (`?dayIdx&mealType&limit`) |
| `GET` | `/last-week-recipes` | Rezepte der letzten Kalenderwoche |
| `GET` | `/past-week-recipes` | Rezepte einer vergangenen Woche (`?weekStart=YYYY-MM-DD` oder `?offset=N`) |
| `POST` | `/add-recipe` | Rezept manuell hinzufügen (erstellt Plan automatisch) |
| `POST` | `/:planId/entry` | Neuen Eintrag in einen Slot hinzufügen |
| `PUT` | `/:planId/entry/:entryId` | Eintrag bearbeiten (Rezept tauschen, Portionen) |
| `POST` | `/:planId/entry/:entryId/move` | Eintrag per Drag & Drop verschieben |
| `POST` | `/:planId/entry/:entryId/cooked` | Mahlzeit als gekocht markieren |
| `DELETE` | `/:planId/entry/:entryId` | Einzelnen Eintrag entfernen |
| `POST` | `/:planId/lock` | Plan sperren/entsperren (Toggle) |
| `POST` | `/:planId/duplicate` | Plan auf eine andere Woche kopieren |
| `DELETE` | `/:id` | Plan löschen |
| `GET` | `/export` | Wochenpläne als JSON exportieren |
| `POST` | `/import` | Wochenpläne aus JSON importieren |

## Einkaufsliste (`/api/shopping`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/generate` | Liste aus Wochenplan generieren |
| `GET` | `/list` | Aktive Einkaufsliste |
| `GET` | `/lists` | Alle Listen (auch vergangene) |
| `PUT` | `/item/:id/check` | Artikel abhaken/entabhaken |
| `POST` | `/item/add` | Artikel manuell hinzufügen |
| `DELETE` | `/item/:id` | Artikel löschen |
| `PUT` | `/item/:id/rewe-product` | REWE-Produkt zuordnen |
| `POST` | `/item/:id/to-pantry` | Artikel in Vorratsschrank verschieben |
| `POST` | `/:listId/complete` | Einkauf abschließen → Pantry + Auto-Lock |

## Vorratsschrank (`/api/pantry`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/` | Alle Vorräte (Filter: `?category=X`, `?expiring=true`) |
| `POST` | `/` | Vorrat hinzufügen (Duplikat: Menge addieren) |
| `PUT` | `/:id` | Vorrat bearbeiten |
| `DELETE` | `/:id` | Vorrat entfernen |
| `POST` | `/:id/use` | Menge verbrauchen |
| `POST` | `/check` | Vorratsmengen für Zutatenliste prüfen |
| `POST` | `/import` | Vorräte aus CSV/JSON importieren |

## REWE (`/api/rewe`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/search-ingredient` | Produktsuche (`?q=Butter&limit=8`) |
| `POST` | `/match-shopping-list` | Gesamte Liste matchen (SSE-Stream) |
| `GET` | `/markets` | Marktsuche nach PLZ |
| `GET` | `/preferences` | Gespeicherte Produkt-Präferenzen |
| `DELETE` | `/preferences/:id` | Einzelne Präferenz löschen |
| `DELETE` | `/preferences` | Alle Präferenzen löschen |
| `GET` | `/cart-script` | Warenkorb-Script generieren |
| `GET` | `/userscript` | Tampermonkey-Userscript herunterladen |
| `GET` | `/settings` | Eigene REWE-Markt-Einstellungen |
| `PUT` | `/settings` | Eigenen REWE-Markt speichern |
| `DELETE` | `/settings` | Eigenen REWE-Markt entfernen |

## Bring! (`/api/bring`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/connect` | Account verbinden |
| `GET` | `/status` | Verbindungsstatus prüfen |
| `GET` | `/lists` | Verfügbare Bring!-Listen |
| `PUT` | `/list` | Aktive Liste wechseln |
| `POST` | `/send` | Einkaufsartikel an Bring! senden |
| `DELETE` | `/disconnect` | Verbindung trennen |

## Zutaten-Icons (`/api/ingredient-icons`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/` | Alle Keyword→Emoji-Mappings |
| `POST` | `/` | Neues Mapping erstellen 🔒 |
| `PUT` | `/:id` | Mapping bearbeiten 🔒 |
| `DELETE` | `/:id` | Mapping löschen 🔒 |

## Zutaten-Einstellungen (`/api/ingredient-aliases`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/` | Alle Aliase des Benutzers |
| `POST` | `/` | Neuen Alias erstellen |
| `POST` | `/merge` | Mehrere Zutaten zusammenführen |
| `DELETE` | `/:id` | Alias löschen |
| `GET` | `/blocked` | Blockierte Zutaten |
| `POST` | `/blocked` | Zutat(en) blockieren |
| `DELETE` | `/blocked/:id` | Blockierung aufheben |
| `GET` | `/export` | Aliase + Blockierungen exportieren |
| `POST` | `/import` | Aliase + Blockierungen importieren |

## Haushalte (`/api/households`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/` | Alle Haushalte des Benutzers |
| `POST` | `/` | Neuen Haushalt erstellen |
| `GET` | `/:id` | Haushalt-Details mit Mitgliedern |
| `PUT` | `/:id` | Haushalt umbenennen |
| `DELETE` | `/:id` | Haushalt auflösen (nur letztes Mitglied) |
| `POST` | `/:id/invite` | Einladungscode generieren (48h gültig) |
| `POST` | `/join` | Per Einladungscode beitreten |
| `DELETE` | `/:id/leave` | Haushalt verlassen |
| `DELETE` | `/:id/members/:userId` | Mitglied entfernen |
| `PUT` | `/:id/default` | Als Standard-Haushalt setzen |
| `GET` | `/:id/activity` | Aktivitätsprotokoll |
| `GET` | `/:id/suggestions` | Rezeptvorschläge basierend auf Haushalt-Daten |
| `POST` | `/:id/migrate` | Persönliche Daten in Haushalt migrieren |
| `GET` | `/:id/export` | Haushalt-Daten als JSON exportieren |

## Rezept-Sharing (`/api/recipes` + `/api/shared-recipes`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/api/recipes/:id/share` | Share-Link erstellen (7 Tage gültig) |
| `GET` | `/api/recipes/:id/shares` | Aktive Share-Links eines Rezepts |
| `DELETE` | `/api/recipes/share/:token` | Share-Link widerrufen |
| `GET` | `/api/shared-recipes/:token` | Geteiltes Rezept ansehen (öffentlich, kein Login) |
| `POST` | `/api/recipes/shared/:token/import` | Geteiltes Rezept importieren (Kopie erstellen) |

## Haushalt-Events (`/api/household-events`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/:householdId` | SSE-Stream für Echtzeit-Updates |
| `GET` | `/:householdId/online` | Online-Status der Haushaltsmitglieder |

## Admin (`/api/admin`) 🔒

Alle Routen erfordern `role=admin`.

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/stats` | Dashboard-Statistiken |
| `GET` | `/users` | Alle Benutzer |
| `PUT` | `/users/:id` | Rolle/Status ändern |
| `DELETE` | `/users/:id` | Benutzer löschen |
| `POST` | `/users/:id/reset-password` | Passwort zurücksetzen |
| `GET` | `/categories` | Kategorien mit Nutzungsanzahl |
| `GET` | `/settings` | Systemeinstellungen |
| `PUT` | `/settings` | Einstellungen aktualisieren |
| `GET` | `/logs` | Aktivitätslog (paginiert) |
| `POST` | `/cleanup` | Verwaiste Dateien entfernen |
| `GET` | `/export` | Rezepte exportieren |
| `POST` | `/import` | Rezepte importieren (max. 500) |
| `GET` | `/export/pantry` | Vorräte exportieren |
| `POST` | `/import/pantry` | Vorräte importieren |
| `GET` | `/households` | Alle Haushalte auflisten |
| `DELETE` | `/households/:id` | Haushalt löschen |
