import { Injectable } from '@nestjs/common';

/**
 * Camada reservada para publicação via Instagram Graph API (Meta).
 * Hoje: apenas readiness; futuro: upload de mídia, container e publish.
 */
@Injectable()
export class InstagramPublishingService {
  getReadiness(): { ready: false; note: string } {
    return {
      ready: false,
      note:
        'Integração com Instagram Graph API não habilitada. Use cópia manual. Fluxo futuro: OAuth Business, creation_id, containers de imagem/vídeo/reels/carrossel.',
    };
  }
}
