import { NextResponse } from 'next/server';
import axios from 'axios';
import nextPkg from 'next/package.json';

const PROBE_TIMEOUT_MS = 1_000;
const startedAt = Date.now();

const probeClient = axios.create({ timeout: PROBE_TIMEOUT_MS });

async function probeOtp(): Promise<{ reachable: boolean; status_code: number | null }> {
  const base = process.env.OTP_BASE_URL ?? 'http://otp:8080';
  try {
    const res = await probeClient.get(`${base}/otp/actuators/health`);
    return { reachable: true, status_code: res.status };
  } catch {
    return { reachable: false, status_code: null };
  }
}

async function probeBridge(): Promise<{ reachable: boolean; status_code: number | null }> {
  const base = process.env.BRIDGE_BASE_URL ?? 'http://bridge:3001';
  try {
    const res = await probeClient.get(`${base}/healthz`);
    return { reachable: true, status_code: res.status };
  } catch {
    return { reachable: false, status_code: null };
  }
}

export async function GET(): Promise<Response> {
  const [otp, bridge] = await Promise.all([probeOtp(), probeBridge()]);

  let status: 'ok' | 'degraded' | 'down';
  if (!otp.reachable) status = 'down';
  else if (!bridge.reachable) status = 'degraded';
  else status = 'ok';

  return NextResponse.json({
    status,
    otp,
    bridge,
    viewer: {
      uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
      next_version: (nextPkg as { version: string }).version,
    },
  });
}
