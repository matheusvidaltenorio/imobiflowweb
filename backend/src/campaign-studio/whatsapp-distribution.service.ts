import { Injectable } from '@nestjs/common';
import { PublicationPlatform } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * WhatsApp não é feed social: mensagem pronta + link wa.me + (opcional) imagem pública.
 * Evolução futura: WhatsApp Business Platform (templates / mensageria).
 */
@Injectable()
export class WhatsAppDistributionService {
  constructor(private readonly prisma: PrismaService) {}

  buildWaMeUrl(text: string, phoneE164?: string): string {
    const base = phoneE164
      ? `https://wa.me/${phoneE164.replace(/\D/g, '')}`
      : 'https://wa.me/';
    const q = new URLSearchParams();
    if (text.trim()) q.set('text', text.slice(0, 4096));
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  }

  async buildPayloadForCampaign(campaignId: string) {
    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      include: {
        assets: { orderBy: { sortOrder: 'asc' } },
        copies: true,
      },
    });
    if (!campaign) return null;

    const copy = campaign.copies.find((c) => c.platform === PublicationPlatform.WHATSAPP);
    const caption = copy?.caption?.trim() ?? '';
    const primary = campaign.assets.find((a) => a.isPrimary) ?? campaign.assets[0];
    return {
      caption,
      imageUrl: primary?.url ?? null,
      waUrl: this.buildWaMeUrl(caption),
    };
  }
}
