import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { LoteamentoLocationService } from './loteamento-location.service';
import { NearbyPlacesService } from './nearby-places.service';
import type { NearbyCategory } from './overpass-nearby.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('maps')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class MapsController {
  constructor(
    private readonly geocoding: GeocodingService,
    private readonly nearby: NearbyPlacesService,
    private readonly loteamentoLocation: LoteamentoLocationService,
  ) {}

  /** Geocodifica endereço (Google com API key, ou Nominatim/OSM). Independente do mapa MapLibre no frontend. */
  @Post('geocode')
  @HttpCode(200)
  geocode(
    @Body()
    body: {
      referenceAddress?: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      neighborhood?: string;
    },
  ) {
    const q = this.loteamentoLocation.composeGeocodeQuery(body);
    return this.geocoding.geocodeAddress(q);
  }

  /** Lista POIs em cache (banco) para o loteamento. */
  @Get('developments/:developmentId/nearby')
  listNearby(
    @Param('developmentId') developmentId: string,
    @Query('radius') radius?: string,
    @Query('mode') mode?: string,
    @Query('category') category?: string,
  ) {
    const r = radius ? parseInt(radius, 10) : 3000;
    const travelMode = mode === 'walking' ? 'walking' : 'driving';
    return this.nearby.listCached(
      developmentId,
      Number.isFinite(r) && r > 0 ? r : 3000,
      travelMode,
      category,
    );
  }

  /**
   * Atualiza POIs via Overpass (OSM) e persiste distância/tempo (OSRM ou fallback).
   * Uso moderado: respeite políticas públicas; produção: Overpass/OSRM próprios.
   */
  @Post('developments/:developmentId/nearby/refresh')
  @HttpCode(200)
  refreshNearby(
    @Param('developmentId') developmentId: string,
    @Body()
    body: {
      radiusMeters?: number;
      travelMode?: 'driving' | 'walking';
      categories?: NearbyCategory[];
    },
  ) {
    const radius = body.radiusMeters ?? 3000;
    const travelMode = body.travelMode === 'walking' ? 'walking' : 'driving';
    return this.nearby.refreshFromOsm(developmentId, radius, travelMode, body.categories);
  }
}
