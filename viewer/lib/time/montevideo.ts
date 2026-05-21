// Builds the `date` + `time` strings that the /api/plan body expects, in
// the operator's local timezone, rounded up to the next minute (so OTP
// doesn't exclude departures at exactly `now`).

const TZ = 'America/Montevideo';

export function nowInMontevideoPlusOneMinute(): { date: string; time: string } {
  // Round up to the next minute by adding 60 s before formatting.
  const t = new Date(Date.now() + 60_000);
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return {
    date: dateFmt.format(t),
    // en-GB returns HH:mm but in some hosts the 24h hour "24" can leak —
    // normalise via a regex slice to the first 5 chars.
    time: timeFmt.format(t).slice(0, 5),
  };
}
