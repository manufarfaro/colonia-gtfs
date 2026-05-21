## MODIFIED Requirements

### Requirement: The viewer SHALL be a Next.js App Router app with chrome persistente and i18n infra

The `viewer/` workspace SHALL be a Next.js application using the App Router, React 19, and TypeScript. The root `app/layout.tsx` SHALL render chrome persistente across every page: a branded header and a disclaimer banner. The disclaimer banner SHALL be present on every page rendered by the app (it is not a dismissible overlay; per PRD §5.2 disclaimers are first-class).

The banner copy SHALL match the PRD §5.2 wording: "Datos preliminares · operador no oficial · tarifas a confirmar" (or an i18n key resolving to that string in Spanish).

The chrome SHALL render with the **Colonia institutional theme** — a coherent palette and typography pairing derived from the Intendencia de Colonia logo (`https://colonia.gub.uy/?x=logosDescargas&p=overall`), with both light and dark variants:

- **Primary anchor**: cobalt `#0077b5` (light) / lifted cobalt `#3aa8d8` (dark) — used for `--primary`, `--ring`, and the chrome title color when its `font-display` weight is active.
- **Secondary surface**: sky blue `#c8dff3` (light) / deep blue `#1a3b5c` (dark) — used for `--accent` and emphasis chips.
- **Destructive signal**: red `#e20a15` (light) / `#c41420` (dark) — reserved EXCLUSIVELY for destructive/critical states. The red SHALL NOT appear in decorative roles (no red shadows, no red borders for non-error states, no red badges for "live" / "active" indicators).
- **Light background**: warm cream `#fbfaf6` (a faint paper warmth) — cards lift to pure white `#ffffff`.
- **Dark background**: deep navy `#0a1721` (referencing the Río de la Plata at night) — cards lift to `#0f2030`.
- **Border radius**: `0.375rem` (6px) — institutional, not consumer-trendy.

Typography SHALL be wired via `next/font/google` (self-hosted at build, no runtime third-party DNS):

- `--font-display`: **Fraunces** (variable serif, OFL) — chrome title, headings, large numeric labels.
- `--font-body`: **IBM Plex Sans** (variable sans, OFL) — default body text.
- `--font-mono`: **IBM Plex Mono** (OFL) — line codes (`Línea 3`), stop IDs, scheduled departure times.

All three SHALL be subsetted to `latin` + `latin-ext` (covers Spanish accents and Portuguese for future locale expansion per PRD §3.4).

Every text-on-surface pairing in the theme SHALL pass WCAG 2.1 AA contrast (4.5:1 for body text, 3:1 for large text / UI components) in BOTH light and dark modes. The pairings audited at theme-palette adoption are recorded in the design document (see `design.md` D-09).

#### Scenario: Root layout includes chrome on every rendered page
- **WHEN** any page produced by the app is server-rendered
- **THEN** the HTML response includes the branded header and the disclaimer banner

#### Scenario: Disclaimer banner is not dismissible
- **WHEN** the rendered HTML or hydrated client view is inspected
- **THEN** the disclaimer banner has no close button, no `display: none` toggle, and persists across navigation

#### Scenario: Theme tokens carry the Colonia palette in light mode
- **WHEN** the chrome renders with the `light` theme active (no `.dark` class on `<html>`)
- **THEN** `getComputedStyle(document.documentElement).getPropertyValue('--primary')` SHALL resolve to the cobalt brand HSL (`200 100% 35.5%` or visually equivalent), AND `--background` SHALL resolve to the warm cream HSL (`45 30% 97%` or equivalent)

#### Scenario: Theme tokens carry the Colonia palette in dark mode
- **WHEN** the chrome renders with the `dark` theme active (`.dark` on `<html>`)
- **THEN** `--primary` SHALL resolve to the lifted cobalt HSL (`198 67% 54%` or equivalent), AND `--background` SHALL resolve to the deep navy HSL (`210 53% 8%` or equivalent)

#### Scenario: Typography variables are bound on the html element
- **WHEN** the layout renders
- **THEN** the `<html>` (or `<body>`) element SHALL carry CSS class names binding `--font-display`, `--font-body`, `--font-mono` to the Fraunces / IBM Plex Sans / IBM Plex Mono `next/font` instances respectively

#### Scenario: Chrome title uses the display font
- **WHEN** the header renders
- **THEN** the title element SHALL have the `font-display` Tailwind utility applied (or its computed `font-family` SHALL be `Fraunces, …`), differentiating it from the body copy

#### Scenario: Red is reserved for destructive states
- **WHEN** the viewer is in any state OTHER than an error / destructive condition
- **THEN** no element in the rendered DOM SHALL use `var(--destructive)` for `color`, `background-color`, `border-color`, or `box-shadow`

#### Scenario: WCAG AA contrast holds in both modes
- **WHEN** the chrome is rendered in either theme
- **THEN** each of the canonical text-on-surface pairings recorded in `design.md` D-09 SHALL pass WCAG AA (4.5:1 for body text, 3:1 for UI components) when measured via any standard contrast tool (e.g., `getContrast()` from `polished` or the browser DevTools accessibility audit)

#### Scenario: Reduced motion is honored
- **WHEN** the user has `prefers-reduced-motion: reduce` set
- **THEN** the staggered shell-mount fade-in SHALL NOT play; the chrome and OD shell slots SHALL appear in their final position immediately
