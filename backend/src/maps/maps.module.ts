import { Module } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { MapsController } from './maps.controller';

@Module({
  controllers: [MapsController],
  providers: [GeocodingService],
  exports: [GeocodingService],
})
export class MapsModule {}
