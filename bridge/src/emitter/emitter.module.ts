import { Module } from '@nestjs/common';
import { GtfsModule } from '../gtfs/gtfs.module';
import { EmitterService } from './emitter.service';

@Module({
  imports: [GtfsModule],
  providers: [EmitterService],
  exports: [EmitterService],
})
export class EmitterModule {}
