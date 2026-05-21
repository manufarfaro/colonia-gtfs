// Per-line colors used by the OD-mode map polylines (design D-07).
// Hardcoded paleta hasta que `data/routes.txt` declare `route_color` — el
// helper se actualizará entonces para preferir el valor del feed antes que
// el fallback de esta tabla.

const PALETTE: Record<string, string> = {
  '3': '#ef4444',
  '4': '#3b82f6',
  '5': '#22c55e',
  '8': '#f59e0b',
};

const FALLBACK = '#6366f1';

export const WALK_COLOR = '#6b7280';

export function getLineColor(shortName: string): string {
  return PALETTE[shortName] ?? FALLBACK;
}
