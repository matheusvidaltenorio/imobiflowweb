import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CampaignPublicationOpLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(opts: {
    campaignId: string;
    userId?: string | null;
    action: string;
    channel?: string | null;
    status: string;
    message?: string | null;
    externalPostId?: string | null;
    attemptNumber?: number;
    executedByUserId?: string | null;
    metadataJson?: Prisma.InputJsonValue | null;
  }): Promise<void> {
    await this.prisma.campaignPublicationOpLog.create({
      data: {
        campaignId: opts.campaignId,
        userId: opts.userId ?? undefined,
        action: opts.action,
        channel: opts.channel ?? null,
        status: opts.status,
        message: opts.message?.slice(0, 8000) ?? null,
        externalPostId: opts.externalPostId ?? null,
        attemptNumber: opts.attemptNumber ?? 0,
        executedByUserId: opts.executedByUserId ?? null,
        metadataJson: opts.metadataJson ?? undefined,
      },
    });
  }
}
