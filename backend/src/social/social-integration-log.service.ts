import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Auditoria de OAuth, seleção de página e publicações Meta.
 * Não armazenar tokens nem payloads completos com segredos.
 */
@Injectable()
export class SocialIntegrationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(opts: {
    userId: string;
    action: string;
    channel?: string | null;
    campaignId?: string | null;
    socialConnectionId?: string | null;
    status: string;
    message?: string | null;
    externalId?: string | null;
    metadataJson?: Prisma.InputJsonValue | null;
  }): Promise<void> {
    await this.prisma.socialIntegrationLog.create({
      data: {
        userId: opts.userId,
        action: opts.action,
        channel: opts.channel ?? null,
        campaignId: opts.campaignId ?? null,
        socialConnectionId: opts.socialConnectionId ?? null,
        status: opts.status,
        message: opts.message?.slice(0, 4000) ?? null,
        externalId: opts.externalId ?? null,
        metadataJson: opts.metadataJson ?? undefined,
      },
    });
  }
}
