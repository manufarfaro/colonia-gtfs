/**
 * Helpers for the line-schedule card: compute "now" in Montevideo
 * local time + find the closest scheduled departure + the next arrival
 * at a given stop. Pure functions so they're easy to test.
 */

/** Minutes-from-midnight for the given Date interpreted in America/Montevideo. */
export function minutesSinceMidnightMVD(now: Date): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Montevideo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  /* v8 ignore start */
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  /* v8 ignore stop */
  return h * 60 + m;
}

function parseHHMM(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Find the index in `departures` (each "HH:MM") whose minute value is
 * closest to `nowMinutes`. Returns -1 when the list is empty.
 */
export function closestDepartureIndex(departures: string[], nowMinutes: number): number {
  if (departures.length === 0) return -1;
  let bestIdx = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < departures.length; i++) {
    const m = parseHHMM(departures[i]);
    if (m === null) continue;
    const d = Math.abs(m - nowMinutes);
    if (d < bestDistance) {
      bestDistance = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Given a list of HH:MM departures + an arrival offset (seconds), find
 * the next time the bus arrives at the corresponding stop. Searches
 * for the FIRST departure whose `departure + offset` is ≥ nowMinutes.
 * Returns an HH:MM string OR null when no future arrival fits.
 */
export function nextArrivalAtStop(
  departures: string[],
  arrivalOffsetSeconds: number,
  nowMinutes: number,
): string | null {
  const offsetMinutes = Math.round(arrivalOffsetSeconds / 60);
  for (const dep of departures) {
    const m = parseHHMM(dep);
    if (m === null) continue;
    const arrivalMin = m + offsetMinutes;
    if (arrivalMin >= nowMinutes) {
      const hh = String(Math.floor(arrivalMin / 60) % 24).padStart(2, '0');
      const mm = String(arrivalMin % 60).padStart(2, '0');
      return `${hh}:${mm}`;
    }
  }
  return null;
}
