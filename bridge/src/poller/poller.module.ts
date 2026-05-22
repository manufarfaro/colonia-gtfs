import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { MatcherModule } from '../matcher/matcher.module';
import { MatcherService } from '../matcher/matcher.service';
import { PollerService, type PollerConfig } from './poller.service';

const POLLER_CONFIG = 'POLLER_CONFIG';

@Module({
  imports: [HttpModule, MatcherModule],
  providers: [
    {
      provide: POLLER_CONFIG,
      useFactory: (): PollerConfig => {
        const headers: Record<string, string> = {};
        if (process.env.ORIGIN_AVL_REFERER) headers.Referer = process.env.ORIGIN_AVL_REFERER;
        if (process.env.ORIGIN_AVL_USER_AGENT)
          headers['User-Agent'] = process.env.ORIGIN_AVL_USER_AGENT;
        return {
          originUrl: process.env.ORIGIN_AVL ?? '',
          pollIntervalMs: Number.parseInt(process.env.POLL_INTERVAL_MS ?? '30000', 10),
          timeoutMs: 10_000,
          originHeaders: Object.keys(headers).length > 0 ? headers : undefined,
        };
      },
    },
    {
      provide: PollerService,
      useFactory: (http: HttpService, matcher: MatcherService, config: PollerConfig) =>
        new PollerService(http, matcher, config),
      inject: [HttpService, MatcherService, POLLER_CONFIG],
    },
  ],
  exports: [PollerService],
})
export class PollerModule {}
