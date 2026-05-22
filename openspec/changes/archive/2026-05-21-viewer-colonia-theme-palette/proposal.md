## Why

The viewer today renders with shadcn's default **neutral** palette and the OS-default sans-serif stack. It works, but it carries no identity: anyone landing on the demo could mistake it for any other transit dashboard built by a generic SaaS team. For the v0 demo audience (Intendencia de Colonia, Sol Antigua, owner), the viewer should **feel like a Colonia product** — institutional, trustworthy, with a quiet editorial warmth that nods to the city's UNESCO World Heritage character.

The Intendencia's official logo (`https://colonia.gub.uy/?x=logosDescargas&p=overall`) gives us a clear palette to derive from:

| Hex | Role in logo | Source pixel share |
|---|---|---|
| `#0077b5` | Institutional cobalt — the dominant blue | 10.8% |
| `#c8dff3` | Sky-blue tint | 15.2% |
| `#e20a15` | Bright red — small flag/badge accent | 0.4% |

This change commits the viewer to a full Colonia-branded theme: a coherent light + dark palette derived from those three colors, paired with **distinctive typography** (Fraunces for display, IBM Plex Sans for body, IBM Plex Mono for line codes and stop IDs). The default radius shrinks from 8px to 6px to feel more institutional than consumer-trendy. The red is reserved exclusively for destructive/critical states — never for decoration — so when it appears the user reads it as "this is important".

We are NOT going maximalist. The aesthetic direction is "modern Uruguay institutional with editorial warmth": restrained motion (one staggered fade-in on shell mount, smooth theme-toggle transitions), generous spacing, refined typography, and a single dominant blue. No gradients, no glassmorphism, no scroll-triggered effects. The work this UI does — helping a tourist find a bus — demands trust, not spectacle.

## What Changes

- **Color tokens** in `viewer/app/globals.css` rewrite both `:root` (light) and `.dark` from the shadcn `neutral` defaults to a **Colonia palette** derived from the logo:
  - Light: warm paper background (`#fbfaf6`), pure-white cards, cobalt primary, sky-blue accent, red destructive.
  - Dark: deep navy background (`#0a1721` — referencing the Río de la Plata at night), slightly lifted card surface, lighter cobalt primary (so it stays visible against the dark BG), sky-blue accent-foreground for emphasis chips.
  - All color pairings WCAG AA validated against text-on-surface contrast ratios.
  - `--radius` shrinks from `0.5rem` (8px) to `0.375rem` (6px).
- **Typography** introduces three Google Fonts via `next/font` (no external network dependency at runtime — fonts are self-hosted by Next.js after build):
  - **Fraunces** (variable serif) bound to a `--font-display` CSS variable for headings, the chrome title, and large numeric labels.
  - **IBM Plex Sans** (variable sans) bound to `--font-body` and set as the default body font.
  - **IBM Plex Mono** bound to `--font-mono` for line codes (`Línea 3`), stop IDs in dev/debug, and any tabular numbers.
- **Tailwind config** maps the new font variables to `font-display`, `font-body`, `font-mono` utility classes, so existing components can opt-in via `className="font-display"` without touching globals.
- **Chrome subtle polish** (`components/chrome/Header.tsx`): the title `"Colonia GTFS"` (i18n key) renders in `font-display` with optical sizing tuned for ~14px UI use. The disclaimer banner keeps `font-body` but its copy gains a tiny capital-letter spacing adjustment for the institutional read.
- **Motion**: a single page-load fade-in animation on the OD shell's main slots (search slot, map, bottom sheet) — staggered 60ms apart, total 240ms. Implemented via Tailwind's animation utilities; respects `prefers-reduced-motion`.

## Capabilities

### New Capabilities
(none — this change refactors the viewer's chrome and tokens)

### Modified Capabilities
- `viewer-shell-and-api`: R-02 ("The viewer SHALL be a Next.js App Router app with chrome persistente and i18n infra") implicitly assumed the shadcn neutral defaults. R-02 is MODIFIED to require the Colonia-branded theme (palette + typography + radius), with WCAG AA contrast guarantees on the canonical text-on-surface pairings.

## Impact

- **Code**:
  - `viewer/app/globals.css` — full rewrite of the `:root` and `.dark` token blocks; new `:root` keeps the same token NAMES (so shadcn components and Tailwind utilities like `bg-card` keep working) but with new VALUES.
  - `viewer/app/layout.tsx` — wire `next/font` imports for Fraunces, IBM Plex Sans, IBM Plex Mono; thread the resulting CSS variable class names onto the `<html>` element.
  - `viewer/tailwind.config.ts` (or `tailwind.config.js`) — extend `theme.fontFamily` with `display`, `body`, `mono` references to the new variables.
  - `viewer/components/chrome/Header.tsx` — apply `font-display` to the title; no structural change beyond that.
  - `viewer/app/globals.css` — add `@keyframes` for `fadeInUp` (the staggered shell mount); apply `animate-fade-in-up` to the shell slots with `animation-delay` Tailwind arbitrary values; gate behind `motion-safe:` so reduced-motion users see no animation.
- **Tests**:
  - `viewer/components/theme/ThemeProvider.test.tsx` — add an assertion that the active palette returns the Colonia primary (`#0077b5` in light, `#3aa8d8` in dark) when read via `getComputedStyle`.
  - `viewer/components/chrome/Header.test.tsx` — confirm the title carries the `font-display` class (or its resolved value from a CSS custom property).
- **Coverage**: maintain the 100/100/100/100 thresholds in `vitest.config.ts`. The token rewrite itself is CSS so it does not move coverage; the font wiring in `layout.tsx` is covered by the existing layout tests.
- **Bundle**: three fonts via `next/font` add ~70 KB gzipped to the initial payload (subset to `latin` + `latin-ext` for Spanish accents). Acceptable for a mobile-first demo where the first paint already costs ~80 KB JS for the OD shell.
- **No breaking changes** to APIs or to the existing modes' specs. The token NAMES (`--primary`, `--card`, etc.) are preserved — only values change. Components that read `bg-card`, `text-foreground`, `border-border` rerender with new colors automatically.
- **Accessibility**: every canonical pairing (e.g., `foreground` on `background`, `primary-foreground` on `primary`) MUST pass WCAG AA contrast (4.5:1 for normal text, 3:1 for large text and UI components). The design document records the audited pairings.
