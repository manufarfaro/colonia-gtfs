/**
 * Per-stop arrival schedule: take a line's `scheduledDepartures` (HH:MM
 * from the first stop) + a stop's `arrivalOffsetSeconds` and emit one
 * row per departure with the projected arrival time + a "past / future
 * / now" tag relative to the supplied `nowMinutes`.
 *
 * Pure function so it's easy to unit-test; rendering lives in
 * `LineScheduleCard`.
 */

export interface StopArrival {
  /** HH:MM the bus is expected at this stop. */
  arrivalTime: string;
  /** Minutes from now: negative when already passed. */
  diffMinutes: number;
  /** Category for the UI: 'next' is the upcoming arrival; 'future' the
   *  rest; 'past' for arrivals already in the past. */
  status: 'past' | 'next' | 'future';
}

function parseHHMM(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function fmtHHMM(minutes: number): string {
  const safe = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(safe / 60)).padStart(2, '0');
  const mm = String(safe % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Build a list of arrivals at a single stop for a single direction.
 * Sorted by `arrivalTime`. The first future entry is tagged `next`;
 * everything before is `past`, everything after is `future`.
 */
export function computeStopArrivals(
  departures: string[],
  arrivalOffsetSeconds: number,
  nowMinutes: number,
): StopArrival[] {
  const offset = Math.round(arrivalOffsetSeconds / 60);
  const rows: { absMin: number; arrivalTime: string }[] = [];
  for (const dep of departures) {
    const m = parseHHMM(dep);
    if (m === null) continue;
    const absMin = m + offset;
    rows.push({ absMin, arrivalTime: fmtHHMM(absMin) });
  }
  rows.sort((a, b) => a.absMin - b.absMin);

  const out: StopArrival[] = [];
  let nextTagged = false;
  for (const r of rows) {
    const diff = r.absMin - nowMinutes;
    let status: StopArrival['status'];
    if (diff < 0) {
      status = 'past';
    } else if (!nextTagged) {
      status = 'next';
      nextTagged = true;
    } else {
      status = 'future';
    }
    out.push({ arrivalTime: r.arrivalTime, diffMinutes: diff, status });
  }
  return out;
}
