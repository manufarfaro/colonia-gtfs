## 1. Tailwind config: bind font variables to utilities

- [x] 1.1 In `viewer/tailwind.config.ts` (or `tailwind.config.js`), extend `theme.fontFamily` with:
  ```ts
  fontFamily: {
    display: ['var(--font-display)', 'ui-serif', 'Georgia', 'serif'],
    body: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
  }
  ```
- [x] 1.2 Confirm Tailwind's `font-sans` default still resolves (we keep it pointed at the same value as `font-body` so existing utility usage does not regress).

## 2. Fonts: wire next/font in layout

- [x] 2.1 In `viewer/app/layout.tsx`, import the three Google Fonts via `next/font/google`:
  ```ts
  import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
  const fontDisplay = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-display', axes: ['opsz', 'SOFT'] });
  const fontBody = IBM_Plex_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-body' });
  const fontMono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '500'], variable: '--font-mono' });
  ```
- [x] 2.2 Apply the three variable className strings to the `<html>` (or `<body>`) element of the root layout: `className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable} font-body antialiased`}`.
- [x] 2.3 Confirm the build does NOT fetch fonts at runtime (run `next build` and inspect the network tab on the production server — no `fonts.googleapis.com` requests).

## 3. globals.css: rewrite token values for both modes

- [x] 3.1 In `viewer/app/globals.css`, replace the entire `:root { ... }` token block with the Colonia light palette per design D-09 (every variable in HSL space; comment each line with its hex equivalent and contrast-ratio status):
  ```css
  :root {
    --background: 45 30% 97%;          /* #fbfaf6 — warm cream */
    --foreground: 215 65% 11%;         /* #0a1a2e — deep navy ink */
    --card: 0 0% 100%;                 /* #ffffff */
    --card-foreground: 215 65% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 215 65% 11%;
    --primary: 200 100% 35.5%;         /* #0077b5 — Colonia cobalt */
    --primary-foreground: 0 0% 100%;
    --secondary: 205 50% 94%;          /* #e8f1f7 */
    --secondary-foreground: 215 65% 11%;
    --muted: 215 25% 95%;              /* #f0f3f7 */
    --muted-foreground: 213 14% 42%;   /* #5b6b7a */
    --accent: 209 75% 86.5%;           /* #c8dff3 — logo sky blue */
    --accent-foreground: 215 65% 11%;
    --destructive: 357 92% 46%;        /* #e20a15 — logo red */
    --destructive-foreground: 0 0% 100%;
    --border: 213 24% 88%;             /* #d8e1ea */
    --input: 213 24% 88%;
    --ring: 200 100% 35.5%;            /* same as --primary */
    --radius: 0.375rem;
  }
  ```
- [x] 3.2 Replace the entire `.dark { ... }` token block with the Colonia dark palette:
  ```css
  .dark {
    --background: 210 53% 8%;          /* #0a1721 — navy night */
    --foreground: 205 50% 94%;         /* #e8f1f7 */
    --card: 211 53% 12%;               /* #0f2030 */
    --card-foreground: 205 50% 94%;
    --popover: 211 53% 12%;
    --popover-foreground: 205 50% 94%;
    --primary: 198 67% 54%;            /* #3aa8d8 — lifted cobalt */
    --primary-foreground: 210 53% 8%;
    --secondary: 211 44% 16%;          /* #16293a */
    --secondary-foreground: 205 50% 94%;
    --muted: 211 44% 13%;              /* #13212e */
    --muted-foreground: 212 14% 60%;   /* #8898a8 */
    --accent: 211 56% 23%;             /* #1a3b5c */
    --accent-foreground: 209 75% 86.5%;
    --destructive: 356 81% 42%;        /* #c41420 */
    --destructive-foreground: 0 0% 100%;
    --border: 212 41% 20%;             /* #1e3346 */
    --input: 212 41% 20%;
    --ring: 198 67% 54%;
  }
  ```
- [x] 3.3 Add a `@keyframes fadeInUp` block in `globals.css`:
  ```css
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  ```
- [x] 3.4 Inside `@layer utilities` (or a `@layer base` motion block), declare an animation utility class `.animate-fade-in-up` that applies `fadeInUp 240ms ease-out both` AND respects `prefers-reduced-motion`:
  ```css
  @media (prefers-reduced-motion: no-preference) {
    .animate-fade-in-up { animation: fadeInUp 240ms ease-out both; }
  }
  ```

## 4. Page-load motion: stagger the shell slots

- [x] 4.1 In `viewer/components/od/OdModeShell.tsx`, add `className="animate-fade-in-up"` to the search slot (or sidebar — both variants get the class), the map container, and the bottom region.
- [x] 4.2 Add `animation-delay` via Tailwind arbitrary value: search/sidebar = `[animation-delay:0ms]`, map = `[animation-delay:60ms]`, bottom region = `[animation-delay:120ms]`. Wrap with `motion-safe:` prefix if Tailwind v4 supports it; otherwise the `@media (prefers-reduced-motion)` guard in globals.css covers it.
- [x] 4.3 Confirm the chrome (`Header`, `DisclaimerBanner`) does NOT animate — keep it solid from the first paint so the user has stable anchor points.

## 5. Header chrome: opt the title into display font

- [x] 5.1 In `viewer/components/chrome/Header.tsx`, add `font-display` to the title element. Set its weight to `font-semibold` and adjust `tracking` (e.g., `tracking-tight`) so Fraunces' optical sizing reads correctly at small UI sizes.
- [x] 5.2 Confirm the title's computed color resolves to `hsl(var(--foreground))` — not a hardcoded color value.

## 6. theme-color meta tag

- [x] 6.1 In `viewer/app/layout.tsx`, add a `<meta name="theme-color" content="#0077b5">` tag (the light-mode primary cobalt). Future follow-up: dynamic per-mode via `next-themes` resolved on the client.

## 7. Tests

- [x] 7.1 Update `viewer/components/theme/ThemeProvider.test.tsx` to add two assertions: after mounting the provider with the default (light) theme, `getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()` SHALL include `200 100%` (the light cobalt). Toggle to dark, assert it includes `198 67%`.
- [x] 7.2 Update `viewer/components/chrome/Header.test.tsx`: assert the title element has the `font-display` class in its className.
- [x] 7.3 Add a contrast test in `viewer/test/theme-contrast.test.ts` (NEW): for each canonical pairing in D-09's audit table, parse the HSL values from `globals.css`, convert to sRGB, and compute the WCAG contrast ratio. Assert each ratio meets its floor. (Uses a small helper — pure-TS, no DOM, runs in Node.)
- [x] 7.4 No existing tests should regress — the token NAMES are preserved, so component tests that assert `class="bg-card"` etc. still pass.

## 8. Coverage + lint + build

- [x] 8.1 Run `cd viewer && npx vitest run --coverage`. Confirm 100/100/100/100 thresholds hold. The new contrast test contributes new code; ensure it is fully covered (it is pure logic — easy to cover).
- [x] 8.2 Run `cd viewer && npm run lint`. Confirm green.
- [x] 8.3 Run `cd viewer && npx next build`. Confirm green. Inspect the production bundle's font subset output (`.next/static/media/` should contain `.woff2` files for `Fraunces`, `IBM Plex Sans`, `IBM Plex Mono`).

## 9. Manual visual smoke

- [ ] 9.1 Boot the stack locally (`docker compose up -d`). Open `http://localhost:8080` on a desktop browser. Confirm:
  - Background is faint cream (`#fbfaf6`), not pure white.
  - Header title reads in Fraunces serif; body copy in IBM Plex Sans.
  - Hovering / clicking the theme toggle smoothly transitions to dark mode (navy background, lifted cobalt primary).
  - The disclaimer banner is fully readable in both modes.
- [ ] 9.2 On a real phone (or DevTools mobile emulation), confirm:
  - The `theme-color` meta tag tints the iOS Safari / Android Chrome status bar cobalt blue in light mode.
  - Fonts have snapped in within ~150ms of first paint (no extended FOUT).
  - The shell mount animation plays once on hard reload and does NOT replay on theme toggle.
- [ ] 9.3 Toggle `prefers-reduced-motion: reduce` (DevTools → Rendering → Emulate CSS media features). Confirm the shell appears statically; theme-toggle transition still plays (theme transition is on user input, not on mount).
- [ ] 9.4 Run a Chrome DevTools Lighthouse accessibility audit on a key view (`/`). Confirm contrast checks pass.

## 10. PR + CI

- [ ] 10.1 Open a PR from `feature/apply-viewer-colonia-theme-palette` to `main`. Title: `feat(viewer): apply viewer-colonia-theme-palette (logo-derived light+dark theme, Fraunces + IBM Plex)`. Body summarizes the palette derivation, typography rationale, WCAG audit results; links the design.md D-09 table.
- [ ] 10.2 Confirm CI workflows pass: lint + vitest + next build, viewer smoke, CodeQL.
- [ ] 10.3 After merge, run `/opsx:archive viewer-colonia-theme-palette` to promote the MODIFIED requirement into `openspec/specs/viewer-shell-and-api/spec.md` and archive the change directory.
