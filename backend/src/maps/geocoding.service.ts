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
   * Geocodifica endereço livre. Com `GOOGLE_MAPS_API_KEY` usa Google; senão Nominatim (OSM).
   * Renderização de mapa no frontend é MapLibre — geocoding fica desacoplado.
   */
  async geocodeAddress(fullAddress: string): Promise<GeocodeResult> {
    const q = fullAddress.trim();
    if (q.length < 3) {
      throw new BadRequestException('Endereço muito curto para geocodificar.');
    }
    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim();
    if (key) {
      return this.geocodeGoogle(q, key);
    }
    return this.geocodeNominatim(q);
  }

  private async geocodeGoogle(q: string, key: string): Promise<GeocodeResult> {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', q);
    url.searchParams.set('key', key);

    const res = await fetch(url.toString());
    if (!res.ok) {
      this.logger.warn(`Geocode Google HTTP ${res.status}`);
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
      this.logger.debug(`Geocode Google: ${msg}`);
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

  private async geocodeNominatim(q: string): Promise<GeocodeResult> {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'ImobiFlow/1.0 (+https://github.com/matheusvidaltenorio/imobiflowweb)',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });

    if (!res.ok) {
      this.logger.warn(`Geocode Nominatim HTTP ${res.status}`);
      throw new BadRequestException('Falha ao consultar geocodificação (OSM).');
    }

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      osm_id?: number;
    }>;

    if (!data?.length) {
      throw new BadRequestException('Não foi possível localizar este endereço no mapa.');
    }

    const first = data[0];
    return {
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
      formattedAddress: first.display_name,
      placeId: first.osm_id != null ? `osm:${first.osm_id}` : 'nominatim',
    };
  }
}
