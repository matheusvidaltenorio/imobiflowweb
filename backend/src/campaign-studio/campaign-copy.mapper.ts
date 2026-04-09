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
