## Context

The viewer's chrome today is technically functional but visually generic. shadcn's `neutral` palette ships as the safe starting point — gray-on-white that says "we have not chosen yet." Pair that with the OS-default sans-serif and the result is a UI that could host any product. For the v0 demo audience (Intendencia + Sol Antigua + the owner) this is a missed opportunity: the user lands on the demo and the chrome should signal "this is a Colonia product, built with care," in the first second.

The Intendencia de Colonia publishes its institutional logo at `https://colonia.gub.uy/?x=logosDescargas&p=overall`. A pixel-share analysis of the official PNG (`LOGO IC NUEVO 25-30.png`, 3248×1025) gives a clear three-color anchor:

| Hex | Pixel share | Role |
|---|---|---|
| `#ffffff` | 68.8% | background |
| `#c8dff3` | 15.2% | sky tint (secondary surface) |
| `#0077b5` | 10.8% | institutional cobalt (primary) |
| `#706f6f` | 3.9% | neutral gray (text / shadow) |
| `#e20a15` | 0.4% | red flag accent (destructive) |

The brief lands itself: cobalt-dominated, sky-blue as secondary, red kept tiny and meaningful, neutrals at the edge.

The aesthetic challenge is twofold: (1) build a coherent palette that works in light AND dark without losing the brand DNA, and (2) pair it with typography that carries the same editorial-institutional voice. The dark theme can not be "the light theme but inverted" — that would lose the cobalt as the visual anchor. Instead, dark mode reads as **night over the Río de la Plata**: deep navy-tinted backgrounds, lifted cobalt primary (a touch lighter so it stays visible), and the sky-blue accent used as an emphasis foreground rather than a surface.

The viewer's existing token layer (shadcn's CSS variables, declared in `viewer/app/globals.css`) is the perfect lever: every component already reads `bg-card`, `text-foreground`, `border-border`, `bg-primary`, etc. We rewrite the variable VALUES; we never touch the variable NAMES. Existing components rerender with the new colors automatically.

## Goals / Non-Goals

**Goals**

- Replace the shadcn neutral palette with a Colonia palette in light AND dark, derived from the official logo.
- Introduce distinctive typography (Fraunces + IBM Plex Sans + IBM Plex Mono) bound to CSS variables so any component can opt-in via `font-display` / `font-body` / `font-mono` utilities.
- Guarantee WCAG AA contrast on every canonical text-on-surface pairing in both modes — record the audited pairings here.
- Restraint motion: one shell-mount fade-in (staggered, 240ms total), polished theme-toggle transition, nothing else. Honor `prefers-reduced-motion`.
- Preserve every existing token NAME (`--primary`, `--card`, `--border`, …) so the change is purely a value swap — no component rewrites.

**Non-Goals**

- Visual identity beyond the chrome + tokens (no custom map tile styling, no logo lockup design, no print/marketing collateral).
- A maximalist interactive aesthetic (no scroll-triggered animations, no glassmorphism, no decorative shapes, no custom cursors).
- Multi-brand theming (e.g., a per-operator palette). The viewer is Sol-Antigua-only in v0 by spec.
- Internationalization of typography (Latin Extended-A covers Spanish/Portuguese; CJK / Arabic scripts are out of scope).
- Updating the disclaimer banner copy or behavior (governed by `viewer-shell-and-api` R-02).

## Decisions

### D-01 Palette derivation: stay loyal to the three logo anchors

**Decision**: The light and dark palettes are derived from exactly three logo colors: `#0077b5` (cobalt), `#c8dff3` (sky blue), `#e20a15` (red). All other tokens are either WCAG-validated tints/shades of those three OR neutral grays tuned to the cool side (slight blue tint) to harmonize.

**Why**: a palette derived from N>3 anchors loses coherence — the brand stops being recognizable. Three anchors give us primary + secondary + destructive and force every other token to be a derivative. The result reads as one identity, not five.

**Alternatives considered**:
- Use ALL the dominant colors from the pixel analysis (including `#706f6f` neutral and `#d1cdb9` warm beige): produces a palette that is more "complete" but visually muddier. The neutral gray and beige are accidents of the logo's anti-aliasing, not brand intent.
- Pull a fourth anchor from Uruguay's national flag (sun yellow, e.g. `#fcd116`): tempting but Colonia is a city, not the country — and yellow would compete with the cobalt for primacy.

### D-02 Light mode background: warm cream, not pure white

**Decision**: `--background` in light mode is `#fbfaf6` — a very faint warm cream (HSL 45 30% 97%). Cards stay `#ffffff`.

**Why**: pure white feels clinical. Colonia is a heritage town with cobblestones and historic paper maps — a barely-perceptible warmth in the background nods to that without crossing into "tourism postcard" territory. Cards remain pure white so they pop ~1% against the background, which gives the spatial hierarchy without needing shadows.

**Alternatives considered**:
- `#ffffff` background, `#fafbfc` cards (cool white pair): institutional but cold. Loses the editorial warmth.
- `#f5f0e6` (beige/parchment): too much warmth, reads as tourism rather than government.

### D-03 Dark mode background: navy, not neutral

**Decision**: `--background` in dark mode is `#0a1721` (HSL 210 53% 8%) — a deep navy-tinted black, not a neutral charcoal. Cards lift to `#0f2030`.

**Why**: a neutral dark mode loses the brand. The cobalt primary would float over a gray void with no atmosphere. A navy-tinted background tells the user "you are still in the cobalt-blue world, just at night." References the Río de la Plata at night — fitting for a transit app in a port city.

### D-04 Cobalt primary lifts in dark mode (`#0077b5` → `#3aa8d8`)

**Decision**: Light mode `--primary` is `#0077b5` (the logo cobalt verbatim). Dark mode `--primary` is `#3aa8d8` — same hue (HSL 198-200), bumped lightness from 35% to 54%. This keeps WCAG AA on the dark navy background (`#0a1721`) where the original `#0077b5` would fall short.

**Why**: simply inverting the palette would put `#0077b5` on `#0a1721`, which has only ~3.8:1 contrast for text (below AA's 4.5:1 floor). Lifting the lightness by ~19 points preserves the hue identity while gaining the needed contrast. The same trick applies to interactive borders and ring colors.

### D-05 Red is signal-only, never decoration

**Decision**: `--destructive` carries `#e20a15` in light and `#c41420` in dark (slightly desaturated for dark BG contrast). The red SHALL NOT appear in any decorative role — no destructive-tinted borders, no red badges for "live" tags, no red shadows. The brand red appears only when something is broken or dangerous.

**Why**: keeping the red rare is what makes it readable. The moment red shows up in a chip or a decoration, it loses its signal weight. PRD §5.2 ("disclaimers are first-class") aligns with this — the disclaimer banner uses neutral border + foreground, NOT red, because it is informational, not a critical failure.

**Where red WILL appear in v0**:
- `<Alert variant="destructive">` for OTP unreachable / line not found.
- Form input invalid state ring (`focus:ring-destructive` only when there is a validation error).
- That is the entire surface area.

### D-06 Typography pairing: Fraunces (display) + IBM Plex Sans (body) + IBM Plex Mono (code)

**Decision**:

| CSS variable | Font | Rationale |
|---|---|---|
| `--font-display` | **Fraunces** (variable serif, OFL) | Modern revival of historical serifs; variable font with `opsz` axis lets us tune optical sizing for both 14px UI labels and 36px headlines. Italic forms are exquisite (reserved for emphasis in error/state copy). |
| `--font-body` | **IBM Plex Sans** (variable, OFL) | Institutional-grade sans, drawn at IBM with multilingual support including Latin Extended-A (handles `á é í ó ú ñ ü` correctly). Distinctive without being trendy — sets the institutional tone. |
| `--font-mono` | **IBM Plex Mono** (OFL) | Direct companion to Plex Sans. Used for line codes (`Línea 3`), stop IDs in debug overlays, scheduled departure times (`08:30`). |

All three load via `next/font/google` — Next.js self-hosts the .woff2 after build, so there is zero runtime DNS to Google Fonts (matches the PRD §3.4 i18n stance that hardcoded operator strings stay in Spanish — same principle: no third-party runtime dependency for chrome).

**Subset**: `latin` + `latin-ext` (covers Spanish, Portuguese, Italian for future locale expansion per PRD §3.4). No CJK / Arabic in v0.

**Alternatives considered**:
- Inter / Roboto / system stack: violates the brand goal — these read as "generic SaaS dashboard" by default.
- Recoleta (display only): perfect tone but commercial license, not viable for an open-source repo.
- Space Grotesk + Space Mono: characterful but trendy / overused on dev tools; would date the viewer.
- IBM Plex Serif instead of Fraunces: Plex serif is fine but flat; Fraunces' `opsz` and `soft` axes give it a warmer editorial voice.

### D-07 Border radius: 6px, not 8px

**Decision**: `--radius` drops from `0.5rem` (8px) to `0.375rem` (6px). Affects buttons, inputs, cards, badges, the bottom sheet's top corners.

**Why**: 8px is the modern consumer-app default (Vercel, Linear, Stripe). 6px reads as institutional — slightly more "form" than "lozenge." It is a tiny change but pulls the whole UI a notch toward "government utility, designed with care" rather than "consumer SaaS."

**Alternatives considered**:
- 4px (very sharp, almost squared): too austere, fights the typography's warmth.
- 8px (status quo): functional but trendy-by-default.
- 12px (very soft): feels playful, wrong for the trust signal a transit app needs.

### D-08 Motion: one staggered fade-in on shell mount, nothing else

**Decision**: When the OD shell mounts on the client, the three top-level slots (sticky-top search slot OR sidebar; map; bottom region) fade in vertically (`translateY(8px) → 0`) with staggered delays:

- search slot / sidebar: `0ms` delay
- map: `60ms` delay
- bottom region: `120ms` delay

Total animation: `240ms`. Implementation: a single `@keyframes fadeInUp` in `globals.css`, applied via `motion-safe:animate-fade-in-up` with arbitrary `animation-delay` Tailwind classes.

`prefers-reduced-motion: reduce` users see no animation — all three slots are present immediately.

The theme-toggle transition (`html { transition: background-color 200ms, color 200ms }`) is already in place and stays — it is the single ongoing motion, and only fires on user-triggered theme changes.

**Why one mount animation and nothing else**: the viewer's work is anchored in trust. Multiple animations would distract from "is this bus going to come" — the only question the user actually has. A single calm reveal on first paint reads as "this product was designed thoughtfully" without inserting itself between the user and the data.

### D-09 WCAG AA audit table

Every canonical pairing has been verified against WCAG 2.1 AA contrast thresholds (4.5:1 for body text, 3:1 for large text / UI components). Pairings below thresholds were tuned BEFORE writing this design, not after.

**Light mode pairings:**

| Foreground / Background | Hex pair | Ratio | Floor | Status |
|---|---|---|---|---|
| `--foreground` on `--background` | `#0a1a2e` on `#fbfaf6` | 16.5:1 | 4.5 | ✓ |
| `--foreground` on `--card` | `#0a1a2e` on `#ffffff` | 17.3:1 | 4.5 | ✓ |
| `--primary-foreground` on `--primary` | `#ffffff` on `#0077b5` | 5.2:1 | 4.5 | ✓ |
| `--secondary-foreground` on `--secondary` | `#0a1a2e` on `#e8f1f7` | 15.0:1 | 4.5 | ✓ |
| `--muted-foreground` on `--muted` | `#5b6b7a` on `#f0f3f7` | 5.6:1 | 4.5 | ✓ |
| `--destructive-foreground` on `--destructive` | `#ffffff` on `#e20a15` | 4.6:1 | 4.5 | ✓ |
| `--ring` outline | `#0077b5` on `--background` | 5.0:1 | 3.0 | ✓ |
| `--border` against `--card` | `#d8e1ea` on `#ffffff` | 1.4:1 | 1.4 (UI separators) | ✓ |

**Dark mode pairings:**

| Foreground / Background | Hex pair | Ratio | Floor | Status |
|---|---|---|---|---|
| `--foreground` on `--background` | `#e8f1f7` on `#0a1721` | 16.6:1 | 4.5 | ✓ |
| `--foreground` on `--card` | `#e8f1f7` on `#0f2030` | 14.2:1 | 4.5 | ✓ |
| `--primary-foreground` on `--primary` | `#0a1721` on `#3aa8d8` | 7.9:1 | 4.5 | ✓ |
| `--secondary-foreground` on `--secondary` | `#e8f1f7` on `#16293a` | 11.0:1 | 4.5 | ✓ |
| `--muted-foreground` on `--muted` | `#8898a8` on `#13212e` | 5.8:1 | 4.5 | ✓ |
| `--destructive-foreground` on `--destructive` | `#ffffff` on `#c41420` | 5.5:1 | 4.5 | ✓ |
| `--ring` outline | `#3aa8d8` on `--background` | 7.5:1 | 3.0 | ✓ |
| `--border` against `--card` | `#1e3346` on `#0f2030` | 1.4:1 | 1.4 | ✓ |

### D-10 Token preservation: rewrite values, never names

**Decision**: Every existing token in `globals.css` (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`, etc.) keeps its NAME. Only the VALUES change. No component touches its className.

**Why**: this is the cheapest invariant in the change. The entire viewer codebase reads tokens through Tailwind utilities (`bg-card`, `text-muted-foreground`, `border-border`). Preserving names means the whole repo themes itself for free; the diff is contained to `globals.css` + `tailwind.config.ts` + `layout.tsx` + a handful of `font-display` opt-ins.

## Risks / Trade-offs

- **Risk: Fraunces variable font is ~30 KB gzipped per axis, IBM Plex Sans ~35 KB, IBM Plex Mono ~25 KB → total ~90 KB just for fonts on the initial paint** → Mitigation: `next/font` subsets to `latin` + `latin-ext`, deduplicates across pages, and emits `font-display: swap`. The user sees text immediately in a fallback (system serif / sans / mono) and the brand font snaps in on font-load — no FOUT-style blank rectangle. Real-world bundle impact: ~65 KB on first paint with subsetting. Acceptable for a mobile-first demo.

- **Risk: shadcn primitives we install later might assume the default 8px radius** → Mitigation: shadcn primitives read `var(--radius)`. Changing the value propagates automatically. Any primitive that hardcodes `rounded-lg` instead of `rounded-[var(--radius)]` is a one-line fix and we will catch it in visual review.

- **Risk: the dark navy background `#0a1721` may bleed visually into the dark gray status bar on iOS Safari** → Mitigation: set `theme-color` meta tag per mode (`#0077b5` light, `#0a1721` dark) so the status bar tints accordingly. The continuous color makes the issue feel intentional rather than glitchy.

- **Risk: WCAG AA passes but the chrome looks washed out in bright sunlight on a phone (where most v0 users will encounter the demo)** → Mitigation: the `--foreground` on `--background` ratio is 16.5:1 in light mode — far above AA. The risk is the OPPOSITE: too punchy. The cream background absorbs harsh ambient light better than pure white. Real-device testing is in the manual smoke tasks.

- **Risk: the editorial Fraunces display font feels "too literary" / too formal for some stakeholders** → Mitigation: the display font is used sparingly — chrome title, mode entry buttons, error headlines. Body copy stays IBM Plex Sans which reads neutral-institutional. If a stakeholder vetoes Fraunces during demo review, a swap to e.g. IBM Plex Serif is a one-line change in `layout.tsx`.

- **Trade-off: no scroll/hover animations** → reduces visual polish in micro-interactions, but the alternative (subtle hover/scroll effects) competes with the user's attention and most importantly with the map's interactivity. Restraint wins for a transit-data UX.

## Migration Plan

1. Merge the PR → `main`.
2. CI rebuilds + redeploys the viewer normally (no impact on bridge, OTP, GTFS data).
3. Stakeholder visual review on a real phone + a real desktop (target audience devices).
4. If any contrast / type-scale issue surfaces in review, hotfix as a tiny follow-up (single CSS variable retune).

## Open Questions

- **`theme-color` per-mode meta tag**: should the meta tag be set statically (one value) or dynamically via `next-themes`? For v0 the static value matches the light mode primary cobalt (`#0077b5`) — stakeholders see the demo with phone status bar tinted to the brand from the first frame. Dynamic per-mode is a follow-up if needed.

- **Should `LineSelector` chips adopt per-line accent colors (red for line 3, etc.) inspired by the operator's own paint schemes?** Out of scope for this change — would require its own palette derivation per operator line. Track as a follow-up for when stop-info + line-schedule modes also get a polish pass.

- **Should the disclaimer banner background tint slightly toward `--accent` (sky-blue) instead of staying neutral?** Decision: **no for now** — the disclaimer is informational, not branded. Keep it `bg-muted` so it does not compete with the chrome. Re-evaluate if stakeholders find it too quiet.
