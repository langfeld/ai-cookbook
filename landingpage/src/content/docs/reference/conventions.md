---
title: Konventionen
description: Tailwind CSS 4, Offline-Patterns und Code-Konventionen im Projekt.
---

Dieses Projekt verwendet **Tailwind CSS 4** mit CSS-basierter Konfiguration.

## Theme

Custom Tokens in `main.css`:

```css
@theme {
  --color-primary-*: ...;
  --color-accent-*: ...;
}
```

## Dark Mode

Klassenbasiert über Custom Variant:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

## Kein `@apply`

Alle Custom-Klassen verwenden **native CSS** mit CSS Custom Properties:

```css
.my-class {
  color: var(--color-primary-500);
  padding: var(--spacing);
  border-radius: var(--radius-lg);
}
```

## Dark-Mode in Scoped Styles

```css
:is(.dark .my-class) {
  color: var(--color-primary-300);
}
```

## Wichtig

- **Kein** `@apply` verwenden — das ist ein Tailwind 3 Pattern
- Alle Views müssen **genau ein Root-Element** haben (wegen `<Transition mode="out-in">` in `App.vue`)

## Offline-Fähige Store-Methoden

Methoden, die offline funktionieren sollen, folgen einem einheitlichen Pattern:

1. **`apiRaw` statt `api.put/post/del`** verwenden — verhindert automatische Fehler-Toasts
2. **Optimistisches UI-Update** vor dem API-Call — lokalen State sofort ändern
3. **catch-Block** mit `offlineQueue.isOfflineError(err)` — bei Netzwerkfehler in die Queue einreihen
4. **Rollback** bei nicht-offline Fehlern — lokalen State zurücksetzen

```js
// Pattern für offline-fähige Store-Methode
async toggleItem(itemId, newState) {
  // 1. Optimistisch updaten
  const previous = item.is_checked;
  item.is_checked = newState;

  try {
    // 2. apiRaw statt api.put (kein Auto-Toast)
    await apiRaw(`/shopping/item/${itemId}/check`, {
      method: 'PUT',
      body: { is_checked: newState },
    });
  } catch (err) {
    if (offlineQueue.isOfflineError(err)) {
      // 3. In Queue einreihen
      await offlineQueue.enqueue({
        type: 'shopping:toggleItem',
        payload: { itemId, is_checked: newState },
        storeName: 'shopping',
      });
    } else {
      // 4. Rollback bei echtem Fehler
      item.is_checked = previous;
    }
  }
}
```

## Idempotente Backend-Endpunkte

Offline-fähige Endpunkte müssen **idempotent** sein — derselbe Call mit denselben Daten darf nicht zu inkonsistentem State führen. Statt Toggles (`!current`) einen **expliziten Zielwert** akzeptieren (`is_checked: 1`).

## Haushalt-Awareness (resolveHousehold)

Routen, die haushaltsbezogene Daten verarbeiten, verwenden den `resolveHousehold`-Decorator statt `authenticate`:

1. Authentifiziert den Benutzer (JWT oder API-Key)
2. Liest `X-Household-Id` aus dem Request-Header
3. Validiert die Mitgliedschaft — bei ungültigem Haushalt: `403 Forbidden`
4. Setzt `request.householdId` (oder `null` wenn kein Haushalt gewählt)

Queries nutzen `householdWhereClause(userId, householdId)` — gibt eine `{ clause, params }`-Struktur zurück, die sowohl private als auch geteilte Daten erfasst.

## X-Household-Id Header

Der Frontend-API-Client (`useApi.js`) sendet automatisch den `X-Household-Id`-Header aus `localStorage`, wenn ein aktiver Haushalt gesetzt ist. Dadurch sind keine View-Änderungen nötig — die Datenfilterung erfolgt transparent im Backend.

## SSE-Verbindungen

Für Echtzeit-Updates im Haushalt wird `EventSource` verwendet. Da `EventSource` keine Custom-Header unterstützt, wird das JWT als Query-Parameter übergeben:

```js
const url = `/api/household-events/${householdId}?token=${jwt}`;
const es = new EventSource(url);
```
