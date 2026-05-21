// Tagged-union ETA result: the caller (the stop-info card) maps each kind
// to the corresponding i18n key (`now`, `minutes`, `passed`, `absolute`).
// Keeping the formatting + the i18n separate makes the helper pure +
// trivially testable.

export type EtaResult =
  | { kind: 'now' }
  | { kind: 'minutes'; minutes: number }
  | { kind: 'passed'; minutes: number }
  | { kind: 'absolute'; time: string };

const TZ = 'America/Montevideo';
const NOW_TOLERANCE_SECONDS = 30;
const RELATIVE_HORIZON_SECONDS = 30 * 60;

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatEta(arrivalIso: string, now: Date = new Date()): EtaResult {
  const arrival = new Date(arrivalIso);
  const deltaSec = Math.round((arrival.getTime() - now.getTime()) / 1000);
  if (deltaSec >= -NOW_TOLERANCE_SECONDS && deltaSec <= 0) {
    return { kind: 'now' };
  }
  if (deltaSec < -NOW_TOLERANCE_SECONDS) {
    return { kind: 'passed', minutes: Math.ceil(-deltaSec / 60) };
  }
  if (deltaSec <= RELATIVE_HORIZON_SECONDS) {
    return { kind: 'minutes', minutes: Math.ceil(deltaSec / 60) };
  }
  return { kind: 'absolute', time: timeFmt.format(arrival).slice(0, 5) };
}
