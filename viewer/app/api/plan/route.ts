import { NextResponse } from 'next/server';
import { OtpUnavailableError, queryOtp } from '@/lib/otp/client';
import { PLAN_QUERY } from '@/lib/otp/queries';
import { translatePlanResponse } from '@/lib/otp/translate-plan';
import { planRequestSchema } from '@/lib/validation/plan';

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request', details: ['body must be JSON'] }, { status: 400 });
  }

  const parsed = planRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const { data, latencyMs } = await queryOtp({
      query: PLAN_QUERY,
      variables: parsed.data,
    });
    const translated = translatePlanResponse(data as Parameters<typeof translatePlanResponse>[0]);
    return NextResponse.json({
      ...translated,
      meta: { queriedAt: new Date().toISOString(), otpLatencyMs: latencyMs },
    });
  } catch (err) {
    if (err instanceof OtpUnavailableError) {
      return NextResponse.json({ error: 'otp_unavailable' }, { status: 502 });
    }
    throw err;
  }
}
