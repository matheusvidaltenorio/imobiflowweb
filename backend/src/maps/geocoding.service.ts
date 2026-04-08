import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type GeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
};

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Geocodifica um endereço livre (Google Geocoding API).
   * Requer GOOGLE_MAPS_API_KEY no backend (restrita por IP em produção).
   */
  async geocodeAddress(fullAddress: string): Promise<GeocodeResult> {
    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim();
    if (!key) {
      throw new BadRequestException(
        'Geocodificação não configurada. Defina GOOGLE_MAPS_API_KEY no servidor.',
      );
    }
    const q = fullAddress.trim();
    if (q.length < 3) {
      throw new BadRequestException('Endereço muito curto para geocodificar.');
    }

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', q);
    url.searchParams.set('key', key);

    const res = await fetch(url.toString());
    if (!res.ok) {
      this.logger.warn(`Geocode HTTP ${res.status}`);
      throw new BadRequestException('Falha ao consultar o serviço de geocodificação.');
    }

    const data = (await res.json()) as {
      status: string;
      error_message?: string;
      results?: Array<{
        formatted_address: string;
        place_id: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };

    if (data.status !== 'OK' || !data.results?.length) {
      const msg = data.error_message || data.status || 'ZERO_RESULTS';
      this.logger.debug(`Geocode: ${msg}`);
      throw new BadRequestException(
        data.status === 'ZERO_RESULTS'
          ? 'Não foi possível localizar este endereço no mapa.'
          : 'Geocodificação indisponível ou endereço inválido.',
      );
    }

    const first = data.results[0];
    const { lat, lng } = first.geometry.location;
    return {
      lat,
      lng,
      formattedAddress: first.formatted_address,
      placeId: first.place_id,
    };
  }
}
