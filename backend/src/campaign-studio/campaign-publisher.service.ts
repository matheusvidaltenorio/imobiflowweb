import { Injectable } from '@nestjs/common';
import { PublicationPlatform, PublicationTargetStatus } from '@prisma/client';
import { MetaOAuthService } from '../social/meta-oauth.service';

/**
 * Fachada de capacidades de publicação (Meta, etc.).
 * Publicação real é feita em InstagramPublisherService / FacebookPublisherService.
 */
@Injectable()
export class CampaignPublisherService {
  constructor(private readonly metaOAuth: MetaOAuthService) {}

  autoPublishSupported(platform: PublicationPlatform): boolean {
    if (!this.metaOAuth.isConfigured()) return false;
    return platform === 'INSTAGRAM_FEED' || platform === 'FACEBOOK_POST';
  }

  defaultTargetStatus(): PublicationTargetStatus {
    return PublicationTargetStatus.EXPORT_PENDING;
  }

  readinessNote(): string {
    if (this.metaOAuth.isConfigured()) {
      return 'Meta configurada: publicação direta para Instagram (feed com imagem) e Facebook (foto + texto na página). Story, Reel e WhatsApp seguem fluxo assistido no app.';
    }
    return 'Para publicar direto no Instagram/Facebook, configure META_APP_ID, META_APP_SECRET e META_OAUTH_REDIRECT_URI no servidor e conecte sua página em Integrações.';
  }
}
