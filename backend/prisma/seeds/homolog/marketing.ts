import {
  AiImageJobStatus,
  CampaignAssetKind,
  CampaignAssetOrigin,
  CommercialObjective,
  InstagramAdObjective,
  InstagramContentType,
  MarketingCampaignKind,
  MarketingCampaignStatus,
  PrismaClient,
  PublicationPlatform,
  PublicationTargetStatus,
  SocialConnectionStatus,
  SocialProvider,
} from '@prisma/client';
import type { HomologSeedContext } from './types';
import { HOMOLOG_SOURCE } from './types';

export async function seedHomologMarketing(prisma: PrismaClient, ctx: HomologSeedContext): Promise<void> {
  console.log('[homolog] marketing / social / campanhas…');

  const broker = ctx.brokers[0]!;
  const lot = await prisma.lot.findFirst({
    where: { block: { developmentId: ctx.vistaVerdeId } },
    select: { id: true },
  });

  type CampSeed = {
    title: string;
    status: MarketingCampaignStatus;
    scheduledPublishAt?: Date;
    publishedAt?: Date;
    failureReason?: string;
  };

  const specs: CampSeed[] = [
    { title: `[${HOMOLOG_SOURCE}] Campanha rascunho`, status: MarketingCampaignStatus.DRAFT },
    {
      title: `[${HOMOLOG_SOURCE}] Pronta para revisão`,
      status: MarketingCampaignStatus.READY,
    },
    {
      title: `[${HOMOLOG_SOURCE}] Agendada`,
      status: MarketingCampaignStatus.SCHEDULED,
      scheduledPublishAt: new Date(Date.now() + 7 * 86400000),
    },
    {
      title: `[${HOMOLOG_SOURCE}] Publicada (simulado)`,
      status: MarketingCampaignStatus.PUBLISHED,
      publishedAt: new Date(Date.now() - 2 * 86400000),
    },
    {
      title: `[${HOMOLOG_SOURCE}] Falha de publicação`,
      status: MarketingCampaignStatus.FAILED,
      failureReason: 'Token expirado (dado fictício homologação).',
    },
  ];

  for (const spec of specs) {
    let c = await prisma.marketingCampaign.findFirst({
      where: { userId: broker.id, title: spec.title },
    });
    if (!c) {
      c = await prisma.marketingCampaign.create({
        data: {
          userId: broker.id,
          developmentId: ctx.vistaVerdeId,
          lotId: lot?.id,
          title: spec.title,
          objective: InstagramAdObjective.LANCAMENTO,
          campaignKind: MarketingCampaignKind.LOTEMENTO,
          commercialObjective: CommercialObjective.DIVULGAR_LOTES,
          internalDescription: `Planejamento homologação (${HOMOLOG_SOURCE})`,
          audienceNotes: 'Perfil investidor / primeira casa.',
          primaryCaption: 'Lotes com infraestrutura — agende visita.',
          status: spec.status,
          primaryContentType: InstagramContentType.FEED,
          scheduledPublishAt: spec.scheduledPublishAt,
          campaignPublishedAt: spec.publishedAt,
          publishFailureReason: spec.failureReason,
        },
      });
    }
    const assetUrl = `https://picsum.photos/seed/${encodeURIComponent(spec.title)}/900/600`;
    const hasAsset = await prisma.campaignAsset.findFirst({
      where: { campaignId: c.id, url: assetUrl },
    });
    if (!hasAsset) {
      await prisma.campaignAsset.create({
        data: {
          campaignId: c.id,
          kind: CampaignAssetKind.IMAGE,
          origin: CampaignAssetOrigin.UPLOAD,
          url: assetUrl,
          fileName: 'homolog-campaign.jpg',
          mimeType: 'image/jpeg',
          isPrimary: true,
          sortOrder: 0,
        },
      });
    }

    await prisma.campaignCopy.upsert({
      where: {
        campaignId_platform: { campaignId: c.id, platform: PublicationPlatform.INSTAGRAM_FEED },
      },
      update: {
        caption: `${spec.title} — legenda homologação. #loteamento #imobiflow`,
        cta: 'Chamar no WhatsApp',
        hashtags: '#lote #casa',
      },
      create: {
        campaignId: c.id,
        platform: PublicationPlatform.INSTAGRAM_FEED,
        caption: `${spec.title} — legenda homologação. #loteamento #imobiflow`,
        cta: 'Chamar no WhatsApp',
        hashtags: '#lote #casa',
      },
    });

    const targetStatus =
      spec.status === MarketingCampaignStatus.PUBLISHED
        ? PublicationTargetStatus.PUBLISHED
        : spec.status === MarketingCampaignStatus.FAILED
          ? PublicationTargetStatus.FAILED
          : PublicationTargetStatus.PREPARED;

    await prisma.campaignPublicationTarget.upsert({
      where: {
        campaignId_platform: { campaignId: c.id, platform: PublicationPlatform.INSTAGRAM_FEED },
      },
      update: {
        status: targetStatus,
        publishError: spec.failureReason,
        publishedAt: spec.publishedAt,
      },
      create: {
        campaignId: c.id,
        platform: PublicationPlatform.INSTAGRAM_FEED,
        status: targetStatus,
        publishError: spec.failureReason,
        publishedAt: spec.publishedAt,
      },
    });

    const logExists = await prisma.campaignPublicationOpLog.findFirst({
      where: { campaignId: c.id, action: `${HOMOLOG_SOURCE}_log` },
    });
    if (!logExists) {
      await prisma.campaignPublicationOpLog.create({
        data: {
          campaignId: c.id,
          userId: broker.id,
          action: `${HOMOLOG_SOURCE}_log`,
          channel: 'INSTAGRAM_FEED',
          status: spec.status === MarketingCampaignStatus.FAILED ? 'ERROR' : 'OK',
          message:
            spec.status === MarketingCampaignStatus.FAILED
              ? 'Falha simulada homologação'
              : 'Evento operacional homologação',
          attemptNumber: 1,
          metadataJson: { source: HOMOLOG_SOURCE },
        },
      });
    }
  }

  /** Job de imagem IA (campanha publicada). */
  const publishedCamp = await prisma.marketingCampaign.findFirst({
    where: { userId: broker.id, title: `[${HOMOLOG_SOURCE}] Publicada (simulado)` },
  });
  if (publishedCamp) {
    const jobExists = await prisma.aiImageGenerationJob.findFirst({
      where: { campaignId: publishedCamp.id, provider: HOMOLOG_SOURCE },
    });
    if (!jobExists) {
      await prisma.aiImageGenerationJob.create({
        data: {
          campaignId: publishedCamp.id,
          provider: HOMOLOG_SOURCE,
          prompt: 'Imagem institucional loteamento, estilo clean',
          status: AiImageJobStatus.COMPLETED,
          resultUrl: 'https://picsum.photos/seed/homolog-ai/1024/1024',
        },
      });
    }
  }

  /** Conexão social fictícia (token sanitizado — não é credencial real). */
  const fakeEnc = `homolog:fake_enc:${broker.id}:v1`;
  await prisma.socialConnection.upsert({
    where: {
      userId_facebookPageId: { userId: broker.id, facebookPageId: `homolog_page_${broker.id.slice(0, 8)}` },
    },
    update: {
      accessTokenEnc: fakeEnc,
      status: SocialConnectionStatus.ACTIVE,
      instagramUsername: 'imobiflow_homolog',
      accountLabel: 'Página demo homologação',
    },
    create: {
      userId: broker.id,
      provider: SocialProvider.META_PAGE,
      facebookPageId: `homolog_page_${broker.id.slice(0, 8)}`,
      facebookPageName: 'ImobiFlow Homolog',
      instagramUserId: `ig_homolog_${broker.id.slice(0, 6)}`,
      instagramUsername: 'imobiflow_homolog',
      accessTokenEnc: fakeEnc,
      status: SocialConnectionStatus.ACTIVE,
      isDefault: true,
      metadataJson: { source: HOMOLOG_SOURCE, note: 'Conexão fictícia para UI' },
    },
  });

  const socLog = await prisma.socialIntegrationLog.findFirst({
    where: { userId: broker.id, action: `${HOMOLOG_SOURCE}_oauth` },
  });
  if (!socLog) {
    await prisma.socialIntegrationLog.create({
      data: {
        userId: broker.id,
        action: `${HOMOLOG_SOURCE}_oauth`,
        channel: 'META',
        status: 'SUCCESS',
        message: 'Callback OAuth simulado (homologação).',
        metadataJson: { source: HOMOLOG_SOURCE },
      },
    });
  }
}
