---
title: CSS-Konventionen
description: Tailwind CSS 4 Regeln und Patterns im Projekt.
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
