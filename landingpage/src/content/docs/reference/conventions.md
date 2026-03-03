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
