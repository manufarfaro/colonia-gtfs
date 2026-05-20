import { Module } from '@nestjs/common';
import { GtfsStaticService } from './gtfs-static.service';

const DEFAULT_GTFS_DIR = '/var/bridge/gtfs';

@Module({
  providers: [
    {
      provide: GtfsStaticService,
      useFactory: (): GtfsStaticService => {
        const dir = process.env.GTFS_DIR ?? DEFAULT_GTFS_DIR;
        return new GtfsStaticService(dir);
      },
    },
  ],
  exports: [GtfsStaticService],
})
export class GtfsModule {}
