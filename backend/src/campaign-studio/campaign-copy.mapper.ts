import { PublicationPlatform, Prisma } from '@prisma/client';
import type { InstagramAdPack, InstagramVariation } from '../instagram-ads/instagram-ads.engine';

function pickVariation(pack: InstagramAdPack, index: number): InstagramVariation {
  const v = pack.variations[index];
  if (v) return v;
  return pack.variations[0]!;
}

/** Monta upserts de `CampaignCopy` por plataforma. */
export function buildCampaignCopyUpsertOperations(
  campaignId: string,
  pack: InstagramAdPack,
  platforms: PublicationPlatform[],
  variationIndex: number,
): Prisma.CampaignCopyUpsertArgs[] {
  const v = pickVariation(pack, variationIndex);
  const reelJson = v.reelScript as Prisma.InputJsonValue;

  const base = {
    title: v.headline,
    cta: v.cta,
    hashtags: v.hashtags,
    professionalTone: v.professionalCaption,
    persuasiveTone: v.persuasiveCaption,
    directTone: v.directCaption,
    justification: pack.strategicJustification,
  };

  const body = (
    platform: PublicationPlatform,
  ): Pick<
    Prisma.CampaignCopyUncheckedCreateInput,
    'caption' | 'shortCaption' | 'reelScriptJson'
  > => {
    switch (platform) {
      case 'INSTAGRAM_FEED':
        return { caption: v.feedCaption, shortCaption: v.shortCaption, reelScriptJson: Prisma.DbNull };
      case 'INSTAGRAM_STORY':
        return { caption: v.storyText, shortCaption: v.storyText.slice(0, 220), reelScriptJson: Prisma.DbNull };
      case 'INSTAGRAM_REEL':
        return {
          caption: `${v.reelScript.hook}\n\n${v.reelScript.body}\n\n${v.reelScript.closing}`,
          shortCaption: v.reelScript.hook,
          reelScriptJson: reelJson,
        };
      case 'FACEBOOK_POST':
        return {
          caption: `${v.headline}\n\n${v.feedCaption}\n\n${v.keyArguments.map((k) => `• ${k}`).join('\n')}`,
          shortCaption: v.shortCaption,
          reelScriptJson: Prisma.DbNull,
        };
      case 'WHATSAPP':
        return {
          caption: v.whatsappBridge,
          shortCaption: v.whatsappBridge.slice(0, 300),
          reelScriptJson: Prisma.DbNull,
        };
      case 'EXPORT_PACKAGE':
        return {
          caption: [
            `=== ${v.headline} ===`,
            '',
            '--- Feed ---',
            v.feedCaption,
            '',
            '--- Story ---',
            v.storyText,
            '',
            '--- Reel ---',
            `${v.reelScript.hook} / ${v.reelScript.body} / ${v.reelScript.closing}`,
            '',
            '--- WhatsApp ---',
            v.whatsappBridge,
            '',
            '--- CTA / Hashtags ---',
            v.cta,
            v.hashtags,
          ].join('\n'),
          shortCaption: v.shortCaption,
          reelScriptJson: Prisma.DbNull,
        };
      default:
        return { caption: v.feedCaption, shortCaption: v.shortCaption, reelScriptJson: Prisma.DbNull };
    }
  };

  return platforms.map((platform) => {
    const extra = body(platform);
    return {
      where: {
        campaignId_platform: { campaignId, platform },
      },
      create: {
        campaignId,
        platform,
        ...base,
        ...extra,
      },
      update: {
        ...base,
        ...extra,
      },
    };
  });
}

/** Legenda montada manualmente / templates (sem pack de anúncio Instagram). */
export function buildPlainCopyUpserts(
  campaignId: string,
  platforms: PublicationPlatform[],
  p: {
    headline: string;
    feedCaption: string;
    shortCaption: string;
    storyText: string;
    whatsapp: string;
    cta: string;
    hashtags: string;
  },
): Prisma.CampaignCopyUpsertArgs[] {
  const base = {
    title: p.headline,
    cta: p.cta,
    hashtags: p.hashtags,
    professionalTone: p.feedCaption,
    persuasiveTone: p.feedCaption,
    directTone: p.shortCaption,
    justification: 'Legenda montada com template interno (sem motor de IA).',
  };

  const body = (
    platform: PublicationPlatform,
  ): Pick<
    Prisma.CampaignCopyUncheckedCreateInput,
    'caption' | 'shortCaption' | 'reelScriptJson'
  > => {
    switch (platform) {
      case 'INSTAGRAM_FEED':
        return { caption: p.feedCaption, shortCaption: p.shortCaption, reelScriptJson: Prisma.DbNull };
      case 'INSTAGRAM_STORY':
        return {
          caption: p.storyText,
          shortCaption: p.storyText.slice(0, 220),
          reelScriptJson: Prisma.DbNull,
        };
      case 'INSTAGRAM_REEL':
        return {
          caption: `${p.headline}\n\n${p.feedCaption}\n\n${p.cta}`,
          shortCaption: p.shortCaption,
          reelScriptJson: Prisma.DbNull,
        };
      case 'FACEBOOK_POST':
        return {
          caption: `${p.headline}\n\n${p.feedCaption}`,
          shortCaption: p.shortCaption,
          reelScriptJson: Prisma.DbNull,
        };
      case 'WHATSAPP':
        return {
          caption: p.whatsapp,
          shortCaption: p.whatsapp.slice(0, 300),
          reelScriptJson: Prisma.DbNull,
        };
      case 'EXPORT_PACKAGE':
        return {
          caption: [p.headline, '', p.feedCaption, '', p.storyText, '', p.whatsapp, '', p.cta, p.hashtags].join(
            '\n',
          ),
          shortCaption: p.shortCaption,
          reelScriptJson: Prisma.DbNull,
        };
      default:
        return { caption: p.feedCaption, shortCaption: p.shortCaption, reelScriptJson: Prisma.DbNull };
    }
  };

  return platforms.map((platform) => {
    const extra = body(platform);
    return {
      where: {
        campaignId_platform: { campaignId, platform },
      },
      create: {
        campaignId,
        platform,
        ...base,
        ...extra,
      },
      update: {
        ...base,
        ...extra,
      },
    };
  });
}
