import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('maps')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class MapsController {
  constructor(private readonly geocoding: GeocodingService) {}

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
    const parts = [
      body.referenceAddress,
      body.neighborhood,
      body.address,
      body.city,
      body.state,
      body.zipCode,
    ]
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean);
    if (!parts.length) {
      throw new BadRequestException('Informe ao menos endereço, bairro ou cidade.');
    }
    return this.geocoding.geocodeAddress(parts.join(', '));
  }
}
