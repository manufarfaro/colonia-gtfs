import { NextResponse } from 'next/server';
import { OtpUnavailableError, queryOtp } from '@/lib/otp/client';
import { LINE_QUERY } from '@/lib/otp/queries';
import {
  type OtpRoutesResponse,
  type RestLineResponse,
  translateLineResponse,
} from '@/lib/otp/translate-line';
import { TtlCache } from '@/lib/util/ttl-cache';

const TTL_MS = 60_000;
const cache = new TtlCache<string, RestLineResponse>(TTL_MS);

function todayInMontevideo(): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montevideo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dtf.format(new Date());
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ lineId: string }> },
): Promise<Response> {
  const { lineId } = await ctx.params;
  const date = todayInMontevideo();
  const cacheKey = `${lineId}|${date}`;

  try {
    const result = await cache.getOrCompute(cacheKey, async () => {
      // The viewer's lineId URL param is the route's *short name* (e.g.
      // "4"), not the feed-namespaced GTFS id ("1:4"). OTP's GraphQL
      // exposes `routes(name:)` for partial-match filtering — the
      // translator narrows to exact shortName.
      const { data } = await queryOtp({
        query: LINE_QUERY,
        variables: { shortName: lineId },
      });
      return translateLineResponse(data as OtpRoutesResponse, lineId, date);
    });

    if (result.line === null) {
      return NextResponse.json({ error: 'line_not_found' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OtpUnavailableError) {
      return NextResponse.json({ error: 'otp_unavailable' }, { status: 502 });
    }
    throw err;
  }
}
