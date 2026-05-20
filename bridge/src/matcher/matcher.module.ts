import { Module } from '@nestjs/common';
import { GtfsModule } from '../gtfs/gtfs.module';
import { MatcherService } from './matcher.service';

@Module({
  imports: [GtfsModule],
  providers: [MatcherService],
  exports: [MatcherService],
})
export class MatcherModule {}
