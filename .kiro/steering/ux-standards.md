---
inclusion: always
---

# TaxDesk PK — UX & Design Standards

## Breakpoints (mobile-first)

| Token | Min width | Target                            |
| ----- | --------- | --------------------------------- |
| `xs`  | 0         | Small phones (320–374 px)         |
| `sm`  | 375px     | Phones                            |
| `md`  | 640px     | Large phones / small tablets      |
| `lg`  | 768px     | Tablets portrait                  |
| `xl`  | 1024px    | Tablets landscape / small laptops |
| `2xl` | 1280px    | Laptops                           |
| `3xl` | 1536px+   | Desktops / large monitors         |

Use `dvh`/`svh` units instead of `100vh`. Support safe-area insets via `env(safe-area-inset-*)`. Support foldables and
landscape phones with container queries.

## Layout by Device

- **Phone:** bottom tab bar (max 5 items), single-column, sticky primary action above keyboard, full-screen sheets for
  forms, swipe-back, pull-to-refresh.
- **Tablet:** collapsible left rail (icons only) + content area; two-pane master/detail for clients and documents; Tax
  Summary panel as bottom drawer (portrait) or right panel (landscape).
- **Laptop/desktop:** persistent sidebar, top bar with global search, three-pane Tax Year Workspace (stepper | form |
  live summary), resizable panels, keyboard shortcuts.
- **Large screens:** cap content at `max-w-screen-2xl`; use extra space for side-by-side comparisons, not stretched
  forms.

## Responsive Components

- **Tables:** card lists on phones (key fields visible, rest expandable); sticky first column + header on larger
  screens; column chooser; virtualize above 100 rows.
- **Forms:** 1-col on phones, 2–3 cols on desktop. Inputs ≥ 44×44 px touch targets. Use `inputmode="numeric"` for
  amounts, `type="tel"` for phone numbers. Amount fields format as `Rs 1,250,000` and work correctly in RTL.
- **Dialogs:** centered modal on desktop, bottom sheet on phones, full-screen for complex multi-step forms.
- **Charts:** fewer ticks + legend below on mobile; provide a data-table alternative for accessibility.
- **Navigation:** breadcrumbs collapse to a back button on phones.
- **Typography:** fluid scale with `clamp()`; minimum 16px body on mobile (prevents iOS zoom on input focus).

## Internationalization & RTL

- Use **logical CSS properties everywhere:** `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, Tailwind
  `ps-*`/`pe-*`.
- Set `dir="rtl"` on `<html>` for Urdu; `dir="ltr"` for English. Components must not hard-code physical directions.
- Mirror directional icons (arrows, back chevrons); do NOT mirror logos, charts, or numerals.
- Language switcher in header and portal first screen; preference saved per user.
- Numerals: Western digits by default; optional Urdu/Arabic-Indic digits per user preference.
- PKR formatting: `Rs 1,250,000` (standard) with optional lakh/crore grouping toggle.
- Urdu (Noto Nastaliq Urdu) requires `line-height` ≥ 1.9 — verify no text clipping.
- Tax year labels must be explicit: "Tax Year 2026" not "TY26" or "FY26".
- Dates: Gregorian default, optional Hijri display.

## Performance Targets (Pakistani Network Reality)

- LCP < 2.5 s on mid-range Android over 4G.
- Initial JS per route ≤ 170 KB gzipped.
- Code-split by route; lazy-load charts, PDF viewer, and heavy modals.
- Font subsetting (Latin + Urdu subsets only).
- PWA: installable, service worker caches shell + last-viewed data; offline drafts for data entry; queued uploads that
  sync on reconnect; visible offline/online indicator.
- Resumable uploads for large files.
- Optimistic UI with rollback on failure.

## Accessibility (WCAG 2.2 AA)

- Color contrast ≥ 4.5:1. Never rely on color alone — use icons or text labels for status.
- Full keyboard operability; visible 2 px focus ring with offset; logical tab order.
- Focus trapping in dialogs; skip-to-content link at top of every page.
- ARIA: labels on all interactive elements, `aria-live="polite"` for toasts and live tax total updates,
  `aria-describedby` linking error messages to fields.
- Respect `prefers-reduced-motion`, `prefers-contrast`, `prefers-color-scheme`.
- User-selectable text size option in settings.
- Error messages: plain language, tied to the specific field.
- Run `axe-core` in CI on every Storybook story. Manual screen-reader pass per release.

## Design Tokens

Defined in `packages/ui/src/tokens.css` and the Tailwind preset. Never hard-code values in components.

| Category   | Tokens                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| Color      | `--color-primary`, `--color-surface`, `--color-border`, semantic: `success`, `warning`, `error`, `info` |
| Radius     | `--radius-sm` 8px, `--radius-md` 12px, `--radius-lg` 16px                                               |
| Spacing    | 4 pt scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64…)                                                      |
| Shadows    | 3 elevations: `--shadow-sm`, `--shadow-md`, `--shadow-lg`                                               |
| Typography | fluid scale via `clamp()`; Inter (LTR), Noto Nastaliq Urdu (RTL)                                        |
| Z-index    | Named scale: `base`, `dropdown`, `sticky`, `modal`, `toast`, `tooltip`                                  |
| Motion     | See motion tokens below                                                                                 |

**Brand palette:** deep teal/green primary (`#0D6B5E` range), neutral slate greys, amber warnings, red errors, blue
info. Light, dark, and high-contrast themes. 200 ms smooth color transition on theme change (off under reduced motion).

**Density:** comfortable (default) and compact modes via a `data-density` attribute on `<body>`.

## Motion System

### Timing Tokens

| Token                | Duration   | Use                           |
| -------------------- | ---------- | ----------------------------- |
| `--duration-instant` | 100 ms     | Hover color, press feedback   |
| `--duration-fast`    | 150–200 ms | Menus, tooltips, toggles      |
| `--duration-base`    | 250–300 ms | Cards, drawers, tabs          |
| `--duration-slow`    | 400–500 ms | Page transitions, celebration |

Easing: `ease-out` for enter, `ease-in` for exit, spring (stiffness ~300, damping ~30) for drawers and draggable items.
Animate only `transform` and `opacity` for 60 fps — never animate layout properties.

### Key Animations

- **Page transitions:** 200 ms fade + 8 px upward slide.
- **Lists:** staggered fade-in (30 ms step, max 8 items); add/remove with height collapse; drag reorder with spring.
- **Skeleton loaders:** shimmer (no blocking spinners for loads > 300 ms).
- **Tax summary numbers:** count-up roll to new value ≤ 400 ms, highlight pulse on changed line.
- **Upload flow:** progress ring → file chip drop-in → success tick; scanning-line over document preview during OCR.
- **Stepper:** progress bar fills; completed step shows check-mark draw.
- **Toasts:** slide in from top (desktop) / bottom (mobile), auto-dismiss 4–6 s, pause on hover/focus.
- **Confetti/celebration:** filing submitted — short burst ≤ 1.2 s; off by default under reduced motion; optional in
  settings.

All animations must have a `prefers-reduced-motion: reduce` path that uses instant or fade-only changes.

## Interaction States

Every interactive element must implement all of these states:

| State        | Expectation                                                                               |
| ------------ | ----------------------------------------------------------------------------------------- |
| Hover        | Only on `(hover: hover)` devices. Subtle elevation/tint shift, 150 ms.                    |
| Focus        | 2 px ring with offset; matches brand primary; never removed without a styled replacement. |
| Active/Press | `scale(0.98)` + darker shade for 100 ms.                                                  |
| Disabled     | 40% opacity, `cursor: not-allowed`, `aria-disabled`.                                      |
| Loading      | Button shows inline spinner and is `aria-busy`; response within 100 ms of click.          |
| Error        | Red border + inline error message linked via `aria-describedby`.                          |
| Empty        | Illustration + helpful message + primary action.                                          |
| Success      | Check icon or toast; ephemeral confirmation.                                              |

## Keyboard Shortcuts (staff app)

| Shortcut     | Action                              |
| ------------ | ----------------------------------- |
| `Ctrl/Cmd+K` | Open command palette                |
| `/`          | Focus global search                 |
| `N`          | New (contextual)                    |
| `G` then `C` | Go to Clients                       |
| `G` then `D` | Go to Documents                     |
| `G` then `T` | Go to Tasks                         |
| `Ctrl+S`     | Save current form                   |
| `?`          | Open keyboard shortcut help overlay |

Show a `?` help overlay listing all shortcuts. Shortcuts must not conflict with screen reader commands.
