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
      useFactory: (): PollerConfig => ({
        originUrl: process.env.ORIGIN_AVL ?? '',
        pollIntervalMs: Number.parseInt(process.env.POLL_INTERVAL_MS ?? '30000', 10),
        timeoutMs: 10_000,
      }),
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
