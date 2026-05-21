import { describe, expect, it } from 'vitest';

/*
 * WCAG 2.1 contrast audit for the Colonia theme palette.
 *
 * The hex values mirror the HSL declarations in `viewer/app/globals.css`
 * `:root` and `.dark` blocks. If the palette is retuned, update both
 * places — this test does NOT auto-parse globals.css (the syntax with
 * HSL components without `hsl()` wrappers is brittle to regex). The
 * design source-of-truth lives in
 * `openspec/changes/viewer-colonia-theme-palette/design.md` (D-09).
 *
 * Floors (per WCAG 2.1 AA):
 *   - body text  (`AA_TEXT`): 4.5:1
 *   - large text / UI components (`AA_UI`): 3.0:1
 *
 * Decorative separators (e.g. `--border` against `--card`) are NOT
 * WCAG-graded — visual reviewers confirm them by eye, not by the
 * audit. They are NOT included here.
 */

const AA_TEXT = 4.5;
const AA_UI = 3.0;

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexToRgb(hexA));
  const lb = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

/* Canonical pairings from design.md D-09. Each tuple is
   [label, foreground hex, background hex, minimum ratio]. */
const LIGHT_PAIRS: Array<[string, string, string, number]> = [
  ['foreground on background', '#0a1a2e', '#fbfaf6', AA_TEXT],
  ['foreground on card', '#0a1a2e', '#ffffff', AA_TEXT],
  ['primary-foreground on primary', '#ffffff', '#0077b5', AA_TEXT],
  ['secondary-foreground on secondary', '#0a1a2e', '#e8f1f7', AA_TEXT],
  ['muted-foreground on muted', '#5b6b7a', '#f0f3f7', AA_TEXT],
  ['destructive-foreground on destructive', '#ffffff', '#e20a15', AA_TEXT],
  ['ring on background (UI focus ring)', '#0077b5', '#fbfaf6', AA_UI],
];

const DARK_PAIRS: Array<[string, string, string, number]> = [
  ['foreground on background', '#e8f1f7', '#0a1721', AA_TEXT],
  ['foreground on card', '#e8f1f7', '#0f2030', AA_TEXT],
  ['primary-foreground on primary', '#0a1721', '#3aa8d8', AA_TEXT],
  ['secondary-foreground on secondary', '#e8f1f7', '#16293a', AA_TEXT],
  ['muted-foreground on muted', '#8898a8', '#13212e', AA_TEXT],
  ['destructive-foreground on destructive', '#ffffff', '#c41420', AA_TEXT],
  ['ring on background (UI focus ring)', '#3aa8d8', '#0a1721', AA_UI],
];

describe('Colonia theme — WCAG contrast audit (light mode)', () => {
  for (const [label, fg, bg, floor] of LIGHT_PAIRS) {
    it(`${label} meets ${floor}:1`, () => {
      const ratio = contrastRatio(fg, bg);
      expect(ratio).toBeGreaterThanOrEqual(floor);
    });
  }
});

describe('Colonia theme — WCAG contrast audit (dark mode)', () => {
  for (const [label, fg, bg, floor] of DARK_PAIRS) {
    it(`${label} meets ${floor}:1`, () => {
      const ratio = contrastRatio(fg, bg);
      expect(ratio).toBeGreaterThanOrEqual(floor);
    });
  }
});
