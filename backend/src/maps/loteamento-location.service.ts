import { BadRequestException, Injectable } from '@nestjs/common';

/**
 * Montagem de endereço para geocodificação (Nominatim / Google no GeocodingService).
 * Mantém ordem estável e compatível com o frontend (`buildNominatimStyleGeocodeQuery`).
 */
@Injectable()
export class LoteamentoLocationService {
  composeGeocodeQuery(body: {
    referenceAddress?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    neighborhood?: string;
  }): string {
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
    return parts.join(', ');
  }
}
