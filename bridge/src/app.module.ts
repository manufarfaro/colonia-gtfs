import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { GtfsModule } from './gtfs/gtfs.module';
import { MatcherModule } from './matcher/matcher.module';
import { EmitterModule } from './emitter/emitter.module';
import { PollerModule } from './poller/poller.module';
import { RtModule } from './rt/rt.module';
import { HealthzModule } from './healthz/healthz.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    GtfsModule,
    MatcherModule,
    EmitterModule,
    PollerModule,
    RtModule,
    HealthzModule,
  ],
})
export class AppModule {}
