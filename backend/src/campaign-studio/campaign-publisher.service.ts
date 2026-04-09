import { Injectable } from '@nestjs/common';
import { PublicationPlatform, PublicationTargetStatus } from '@prisma/client';

/**
 * Fachada para publicação oficial (Meta, etc.). V1: apenas exportação / manual.
 * Futuro: InstagramPublisherService / FacebookPublisherService injetados aqui.
 */
@Injectable()
export class CampaignPublisherService {
  /** Plataformas com publicação automática ainda indisponível. */
  autoPublishSupported(_platform: PublicationPlatform): boolean {
    return false;
  }

  defaultTargetStatus(): PublicationTargetStatus {
    return PublicationTargetStatus.EXPORT_PENDING;
  }

  readinessNote(): string {
    return 'Publicação automática não está ativa. Gere o conteúdo, use preview e exporte/copie. Integração Meta (Instagram/Facebook) ficará neste serviço.';
  }
}
