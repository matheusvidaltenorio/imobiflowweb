import type { PortalCode, PortalListingLifecycleStatus } from '@prisma/client';

export type PortalPublishContext = {
  listingId: string;
  portal: PortalCode;
  title?: string | null;
  description?: string | null;
  price?: number | null;
  imagesSnapshot?: unknown;
  lotId?: string | null;
  propertyId?: string | null;
};

export type PortalPublishResult = {
  externalListingId?: string | null;
  publicationStatus: PortalListingLifecycleStatus;
  message?: string;
};

/** Contrato desacoplado — cada portal implementa seu fluxo (REST, XML, fila, etc.). */
export interface PortalConnector {
  readonly portal: PortalCode;
  publish(ctx: PortalPublishContext): Promise<PortalPublishResult>;
  sync(ctx: PortalPublishContext & { externalListingId: string }): Promise<PortalPublishResult>;
  unpublish?(externalListingId: string): Promise<void>;
}
