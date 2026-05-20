import { NextResponse } from 'next/server';
import { OtpUnavailableError, queryOtp } from '@/lib/otp/client';
import { ARRIVALS_QUERY } from '@/lib/otp/queries';
import { translateArrivalsResponse } from '@/lib/otp/translate-arrivals';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function todayInMontevideo(): string {
  // Operator-local YYYY-MM-DD for the arrivals timestamp anchoring.
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montevideo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dtf.format(new Date());
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ stopId: string }> },
): Promise<Response> {
  const { stopId } = await ctx.params;
  const url = new URL(req.url);
  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT, 1), MAX_LIMIT);

  try {
    const { data } = await queryOtp({
      query: ARRIVALS_QUERY,
      variables: { stopId, limit },
    });
    const translated = translateArrivalsResponse(
      data as Parameters<typeof translateArrivalsResponse>[0],
      todayInMontevideo(),
    );
    if (translated.stop === null) {
      return NextResponse.json({ error: 'stop_not_found' }, { status: 404 });
    }
    return NextResponse.json(translated);
  } catch (err) {
    if (err instanceof OtpUnavailableError) {
      return NextResponse.json({ error: 'otp_unavailable' }, { status: 502 });
    }
    throw err;
  }
}
