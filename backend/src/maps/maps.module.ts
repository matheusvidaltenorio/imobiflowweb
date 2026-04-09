import { Module } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { MapsController } from './maps.controller';
import { RoutingService } from './routing.service';
import { OverpassNearbyService } from './overpass-nearby.service';
import { NearbyPlacesService } from './nearby-places.service';
import { LoteamentoLocationService } from './loteamento-location.service';
import { MapDataService } from './map-data.service';

@Module({
  controllers: [MapsController],
  providers: [
    GeocodingService,
    RoutingService,
    OverpassNearbyService,
    NearbyPlacesService,
    LoteamentoLocationService,
    MapDataService,
  ],
  exports: [
    GeocodingService,
    RoutingService,
    NearbyPlacesService,
    LoteamentoLocationService,
    MapDataService,
  ],
})
export class MapsModule {}
