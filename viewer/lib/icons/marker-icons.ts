/**
 * SVG markers for `google.maps.Marker.icon.url`. All glyphs are
 * verbatim Lucide icon paths (https://lucide.dev) baked into SVG
 * documents with a single `__FILL__` placeholder so we can tint per
 * line / endpoint color at runtime via a data URL.
 *
 * Why baked-into-string SVG instead of importing the Lucide React
 * components: `google.maps.Marker` does not accept React nodes — only
 * a path string OR an image URL. The data-URL trick lets us color the
 * Lucide art at runtime without shipping per-color PNGs.
 */

// Lucide `bus` — body + window line + two wheels. Filled with the line
// color, white stroke to lift the silhouette off the basemap.
const BUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="__FILL__" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2" fill="#ffffff" stroke="__FILL__"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2" fill="#ffffff" stroke="__FILL__"/></svg>`;

// Lucide `circle` — a hollow circle. Used as the small stop dot on the
// line route: white inside, line-colored stroke.
const STOP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#ffffff" stroke="__STROKE__" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>`;

// Lucide `circle` — the same glyph the OD origin input shows, this time
// filled solid so it reads as a "you are here" dot on the basemap.
const ORIGIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="__FILL__" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;

// Lucide `map-pin` — teardrop with an inset circle. Same icon the OD
// destination input shows.
const DESTINATION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="__FILL__" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3" fill="#ffffff" stroke="__FILL__"/></svg>`;

function dataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function busMarkerIconUrl(lineColor: string): string {
  return dataUrl(BUS_SVG.replaceAll('__FILL__', lineColor));
}

export function stopMarkerIconUrl(lineColor: string): string {
  return dataUrl(STOP_SVG.replaceAll('__STROKE__', lineColor));
}

export function originMarkerIconUrl(color: string): string {
  return dataUrl(ORIGIN_SVG.replaceAll('__FILL__', color));
}

export function destinationMarkerIconUrl(color: string): string {
  return dataUrl(DESTINATION_SVG.replaceAll('__FILL__', color));
}
