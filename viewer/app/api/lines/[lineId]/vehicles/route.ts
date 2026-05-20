import { NextResponse } from 'next/server';
import { BridgeUnavailableError, fetchVehiclePositions } from '@/lib/bridge/client';
import { decodeVehicleFeed, filterByLine } from '@/lib/bridge/decode-vehicles';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ lineId: string }> },
): Promise<Response> {
  const { lineId } = await ctx.params;

  try {
    const bytes = await fetchVehiclePositions();
    const feed = decodeVehicleFeed(bytes);
    const vehicles = filterByLine(feed.entities, lineId);
    return NextResponse.json({
      lineId,
      vehicles,
      meta: {
        realtime_available: true,
        feed_timestamp: feed.header.timestamp,
      },
    });
  } catch (err) {
    if (err instanceof BridgeUnavailableError) {
      return NextResponse.json({
        lineId,
        vehicles: [],
        meta: { realtime_available: false, feed_timestamp: null },
      });
    }
    return NextResponse.json({
      lineId,
      vehicles: [],
      meta: { realtime_available: false, feed_timestamp: null },
    });
  }
}
