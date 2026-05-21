/**
 * SVG markers for `google.maps.Marker.icon.url`. Lucide icon paths
 * (https://lucide.dev) baked into SVG documents with a single
 * `__FILL__`/`__STROKE__` placeholder so we can tint per line color at
 * runtime via a data URL.
 *
 * Why baked-into-string SVG instead of importing the Lucide React
 * components: `google.maps.Marker` does not accept React nodes — only
 * a path string OR an image URL. The data-URL trick lets us color the
 * Lucide art with the line palette without shipping per-color PNGs.
 */

const BUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="__FILL__" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M2 12h19.6" stroke="#ffffff" stroke-width="0.8"/><circle cx="7" cy="18" r="1.6" fill="#ffffff" stroke="__FILL__" stroke-width="0.6"/><circle cx="17" cy="18" r="1.6" fill="#ffffff" stroke="__FILL__" stroke-width="0.6"/></svg>`;

const STOP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#ffffff" stroke="__STROKE__" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>`;

function dataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function busMarkerIconUrl(lineColor: string): string {
  return dataUrl(BUS_SVG.replaceAll('__FILL__', lineColor));
}

export function stopMarkerIconUrl(lineColor: string): string {
  return dataUrl(STOP_SVG.replaceAll('__STROKE__', lineColor));
}
