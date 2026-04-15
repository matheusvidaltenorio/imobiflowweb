import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MarketingCampaignStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduledPublicationOrchestratorService } from './scheduled-publication-orchestrator.service';

const STALE_LOCK_MS = 15 * 60 * 1000;
const LOCK_MS = 10 * 60 * 1000;
const BATCH = 8;

/**
 * Processa fila (QUEUED) e retries (RETRYING) com lock para evitar execução duplicada.
 */
@Injectable()
export class PublicationWorkerService {
  private readonly log = new Logger(PublicationWorkerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: ScheduledPublicationOrchestratorService,
  ) {}

  @Cron('*/30 * * * * *')
  async processQueue(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runBatch();
    } finally {
      this.running = false;
    }
  }

  private async runBatch(): Promise<void> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);

    const candidates = await this.prisma.marketingCampaign.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                status: MarketingCampaignStatus.QUEUED,
                OR: [{ scheduledPublishAt: null }, { scheduledPublishAt: { lte: now } }],
              },
              {
                status: MarketingCampaignStatus.RETRYING,
                nextRetryAt: { lte: now },
                autoRetryEnabled: true,
              },
            ],
          },
          {
            OR: [
              { publicationLockUntil: null },
              { publicationLockUntil: { lt: staleBefore } },
            ],
          },
        ],
      },
      orderBy: [{ scheduledPublishAt: 'asc' }, { createdAt: 'asc' }],
      take: BATCH,
    });

    for (const c of candidates) {
      const lockUntil = new Date(now.getTime() + LOCK_MS);
      const updated = await this.prisma.marketingCampaign.updateMany({
        where: {
          id: c.id,
          status: { in: [MarketingCampaignStatus.QUEUED, MarketingCampaignStatus.RETRYING] },
          OR: [
            { publicationLockUntil: null },
            { publicationLockUntil: { lt: staleBefore } },
          ],
        },
        data: {
          status: MarketingCampaignStatus.PROCESSING,
          publicationLockUntil: lockUntil,
          lastPublishAttemptAt: now,
        },
      });

      if (updated.count === 0) {
        continue;
      }

      try {
        await this.orchestrator.execute(c.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log.error(`Falha no orquestrador para campanha ${c.id}: ${msg}`);
        await this.prisma.marketingCampaign.update({
          where: { id: c.id },
          data: {
            status: MarketingCampaignStatus.FAILED,
            publicationLockUntil: null,
            publishFailureReason: `Erro interno ao publicar: ${msg}`.slice(0, 4000),
          },
        });
      }
    }
  }
}
