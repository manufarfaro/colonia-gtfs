import { promises as fs } from 'node:fs';
import { firstValueFrom, type Observable } from 'rxjs';
import type { MatcherService } from '../matcher/matcher.service';
import type { AvlMarker, MatchResult } from '../matcher/types';
import { parseAvlXml } from './avl-parser';

export class HttpPollError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP poll failed with status ${status}`);
    this.name = 'HttpPollError';
  }
}

export class PollTimeoutError extends Error {
  constructor() {
    super('AVL upstream timed out');
    this.name = 'PollTimeoutError';
  }
}

export class PollNetworkError extends Error {
  constructor(public readonly code: string) {
    super(`AVL upstream network error: ${code}`);
    this.name = 'PollNetworkError';
  }
}

export interface PollerConfig {
  originUrl: string;
  pollIntervalMs: number;
  timeoutMs: number;
}

export interface Snapshot {
  /** Time of the last poll attempt (success or failure). */
  lastPollTs: Date | null;
  /** Time of the last successful poll. */
  lastSuccessTs: Date | null;
  /** Parsed markers from the last successful poll. */
  markers: AvlMarker[];
  /** Match results aligned with markers. */
  matches: MatchResult[];
  markersCount: number;
  matchedCount: number;
  unmatchedCount: number;
  consecutiveFailures: number;
  /** Ring buffer history of recent poll outcomes (newest last). Max 50. */
  recentOutcomes: ReadonlyArray<{ ts: Date; ok: boolean }>;
}

export type PollResult =
  | { ok: true; markersCount: number; matchedCount: number; unmatchedCount: number }
  | { ok: false; error: Error };

// Backoff schedule per design D-06. Index 0 is unused (failure count 0
// means "still on the base interval"); failure counts 1..4 step through the
// schedule; counts ≥5 cap at index 4.
const BACKOFF_SCHEDULE_MS = [30_000, 60_000, 120_000, 240_000, 300_000];
const HISTORY_LIMIT = 50;

/**
 * Minimal HTTP client shape we depend on. NestJS HttpService satisfies this.
 */
interface HttpLike {
  get: (
    url: string,
    config?: { responseType?: 'arraybuffer'; timeout?: number },
  ) => Observable<{ data: ArrayBuffer | ArrayBufferLike | Buffer }>;
}

export class PollerService {
  private snapshot: Snapshot = {
    lastPollTs: null,
    lastSuccessTs: null,
    markers: [],
    matches: [],
    markersCount: 0,
    matchedCount: 0,
    unmatchedCount: 0,
    consecutiveFailures: 0,
    recentOutcomes: [],
  };

  // Scheduling state — set by onModuleInit, cleared by onModuleDestroy.
  // `@nestjs/schedule`'s `@Interval` is static; the backoff per D-06 is
  // dynamic (next delay depends on consecutiveFailures), so we self-chain
  // with setTimeout instead.
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly http: HttpLike,
    private readonly matcher: MatcherService,
    private readonly config: PollerConfig,
  ) {}

  onModuleInit(): void {
    if (!this.config.originUrl) return; // No URL configured (e.g. unit tests) — don't auto-start.
    this.scheduleNext();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private scheduleNext(): void {
    if (this.stopped) return;
    const delay = this.computeNextDelayMs(this.snapshot.consecutiveFailures);
    this.timer = setTimeout(() => {
      void this.pollOnce().finally(() => this.scheduleNext());
    }, delay);
  }

  computeNextDelayMs(consecutiveFailures: number): number {
    if (consecutiveFailures <= 0) return this.config.pollIntervalMs;
    const idx = Math.min(consecutiveFailures, BACKOFF_SCHEDULE_MS.length - 1);
    return BACKOFF_SCHEDULE_MS[idx];
  }

  getSnapshot(): Snapshot {
    return this.snapshot;
  }

  async pollOnce(now: Date = new Date()): Promise<PollResult> {
    let buf: Buffer;
    try {
      buf = await this.fetchBytes(this.config.originUrl);
    } catch (err) {
      const error = this.wrapHttpError(err);
      this.recordFailure(now);
      return { ok: false, error };
    }
    let markers: AvlMarker[];
    try {
      markers = parseAvlXml(buf);
    } catch (err) {
      this.recordFailure(now);
      return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
    const matches = markers.map((m) => this.matcher.match(m, now));
    const matched = matches.filter((m) => m.kind === 'matched').length;
    const unmatched = matches.length - matched;
    this.snapshot = {
      lastPollTs: now,
      lastSuccessTs: now,
      markers,
      matches,
      markersCount: markers.length,
      matchedCount: matched,
      unmatchedCount: unmatched,
      consecutiveFailures: 0,
      recentOutcomes: this.appendOutcome(now, true),
    };
    return { ok: true, markersCount: markers.length, matchedCount: matched, unmatchedCount: unmatched };
  }

  private async fetchBytes(url: string): Promise<Buffer> {
    if (url.startsWith('file://')) {
      return fs.readFile(url.slice('file://'.length));
    }
    const response = await firstValueFrom(
      this.http.get(url, { responseType: 'arraybuffer', timeout: this.config.timeoutMs }),
    );
    return Buffer.from(response.data as ArrayBuffer);
  }

  private wrapHttpError(err: unknown): Error {
    const e = err as {
      isAxiosError?: boolean;
      code?: string;
      response?: { status: number };
    };
    if (e?.isAxiosError) {
      if (e.code === 'ECONNABORTED') return new PollTimeoutError();
      if (e.response?.status !== undefined) return new HttpPollError(e.response.status);
      return new PollNetworkError(e.code ?? 'unknown');
    }
    // Non-axios — bubble a safe wrapper without echoing the original message
    // (which might include the URL via toString of axios-shaped errors).
    return new PollNetworkError('unknown');
  }

  private recordFailure(now: Date): void {
    this.snapshot = {
      ...this.snapshot,
      lastPollTs: now,
      consecutiveFailures: this.snapshot.consecutiveFailures + 1,
      recentOutcomes: this.appendOutcome(now, false),
    };
  }

  private appendOutcome(ts: Date, ok: boolean): ReadonlyArray<{ ts: Date; ok: boolean }> {
    const next = [...this.snapshot.recentOutcomes, { ts, ok }];
    return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
  }
}
