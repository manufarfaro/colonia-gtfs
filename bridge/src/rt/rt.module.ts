import { Module } from '@nestjs/common';
import { EmitterModule } from '../emitter/emitter.module';
import { PollerModule } from '../poller/poller.module';
import { CLOCK_TOKEN, SystemClock } from './clock';
import { RtController } from './rt.controller';

@Module({
  imports: [PollerModule, EmitterModule],
  controllers: [RtController],
  providers: [{ provide: CLOCK_TOKEN, useClass: SystemClock }],
})
export class RtModule {}
