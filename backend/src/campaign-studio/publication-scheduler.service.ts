import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MarketingCampaignStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignPublicationOpLogService } from './campaign-publication-op-log.service';

/**
 * Promove campanhas agendadas (SCHEDULED) para a fila (QUEUED) quando o horário chega.
 */
@Injectable()
export class PublicationSchedulerService {
  private readonly log = new Logger(PublicationSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opLog: CampaignPublicationOpLogService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async promoteDueSchedules(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.marketingCampaign.findMany({
      where: {
        status: MarketingCampaignStatus.SCHEDULED,
        scheduledPublishAt: { lte: now },
      },
      select: { id: true, userId: true, title: true },
    });

    for (const row of due) {
      await this.prisma.marketingCampaign.update({
        where: { id: row.id },
        data: { status: MarketingCampaignStatus.QUEUED },
      });
      await this.opLog.log({
        campaignId: row.id,
        userId: row.userId,
        action: 'QUEUED',
        status: 'OK',
        message: `Campanha "${row.title}" entrou na fila de publicação.`,
        metadataJson: { from: 'SCHEDULED' },
      });
    }

    if (due.length) {
      this.log.log(`Promovidas ${due.length} campanha(s) SCHEDULED → QUEUED`);
    }
  }
}
