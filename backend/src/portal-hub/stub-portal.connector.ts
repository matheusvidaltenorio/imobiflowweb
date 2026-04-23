import { PortalCode, PortalListingLifecycleStatus } from '@prisma/client';
import type { PortalConnector, PortalPublishContext, PortalPublishResult } from './portal-connector.types';

/** Placeholder seguro: não chama rede; marca PENDING_SYNC para processamento futuro. */
export class StubPortalConnector implements PortalConnector {
  constructor(readonly portal: PortalCode) {}

  async publish(ctx: PortalPublishContext): Promise<PortalPublishResult> {
    return {
      externalListingId: `stub-${ctx.listingId.slice(0, 8)}`,
      publicationStatus: PortalListingLifecycleStatus.PENDING_SYNC,
      message: `Conector ${this.portal} em modo placeholder — configure integração real.`,
    };
  }

  async sync(ctx: PortalPublishContext & { externalListingId: string }): Promise<PortalPublishResult> {
    return {
      externalListingId: ctx.externalListingId,
      publicationStatus: PortalListingLifecycleStatus.PUBLISHED,
      message: 'Sincronização simulada (stub).',
    };
  }
}
