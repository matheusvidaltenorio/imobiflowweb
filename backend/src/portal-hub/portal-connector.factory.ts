import { Injectable } from '@nestjs/common';
import { PortalCode } from '@prisma/client';
import type { PortalConnector } from './portal-connector.types';
import { StubPortalConnector } from './stub-portal.connector';

@Injectable()
export class PortalConnectorFactory {
  private readonly stubs = new Map<PortalCode, PortalConnector>();

  constructor() {
    for (const p of Object.values(PortalCode)) {
      this.stubs.set(p as PortalCode, new StubPortalConnector(p as PortalCode));
    }
  }

  get(portal: PortalCode): PortalConnector {
    return this.stubs.get(portal) ?? new StubPortalConnector(portal);
  }
}
