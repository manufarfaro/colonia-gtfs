import { Module } from '@nestjs/common';
import { PollerModule } from '../poller/poller.module';
import { CLOCK_TOKEN, SystemClock } from '../rt/clock';
import { HealthzController } from './healthz.controller';

@Module({
  imports: [PollerModule],
  controllers: [HealthzController],
  providers: [{ provide: CLOCK_TOKEN, useClass: SystemClock }],
})
export class HealthzModule {}
