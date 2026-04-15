import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { InstagramAdPack, InstagramVariation } from '../instagram-ads/instagram-ads.engine';

/**
 * Refinamento opcional de copy via Gemini (GOOGLE).
 * Sem GEMINI_API_KEY o serviço não altera o pacote.
 */
@Injectable()
export class GeminiCampaignTextService {
  private readonly log = new Logger(GeminiCampaignTextService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('GEMINI_API_KEY')?.trim();
  }

  private modelName(): string {
    return this.config.get<string>('GEMINI_MODEL')?.trim() || 'gemini-2.0-flash';
  }

  async refinePack(pack: InstagramAdPack): Promise<InstagramAdPack | null> {
    const key = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!key) return null;

    const compact = {
      resolvedObjective: pack.resolvedObjective,
      resolvedTone: pack.resolvedTone,
      strategicJustification: pack.strategicJustification,
      variations: pack.variations.map((v) => ({
        label: v.label,
        headline: v.headline,
        feedCaption: v.feedCaption,
        storyText: v.storyText,
        reelScript: v.reelScript,
        carouselSlides: v.carouselSlides,
        sponsoredText: v.sponsoredText,
        whatsappBridge: v.whatsappBridge,
        cta: v.cta,
        hashtags: v.hashtags,
        keyArguments: v.keyArguments,
        shortCaption: v.shortCaption,
        professionalCaption: v.professionalCaption,
        persuasiveCaption: v.persuasiveCaption,
        directCaption: v.directCaption,
      })),
    };

    const prompt = [
      'Você é copywriter imobiliário no Brasil. Receba o JSON abaixo (anúncio para redes sociais).',
      'Reescreva os textos em português do Brasil, mantendo fatos (preços, números, nomes) e melhorando clareza, CTA e tom comercial.',
      'Preserve o número de itens em variations (3) e em carouselSlides onde existir.',
      'Responda APENAS com um JSON válido no mesmo formato recebido (objeto com strategicJustification e variations array).',
      'Não inclua markdown, comentários ou texto fora do JSON.',
      '',
      JSON.stringify(compact),
    ].join('\n');

    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: this.modelName() });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsedRaw = this.parseJsonResponse(text);
      if (parsedRaw == null) {
        this.log.warn('Gemini não retornou JSON válido.');
        return null;
      }
      const parsed = parsedRaw as {
        strategicJustification?: string;
        variations?: Partial<InstagramVariation>[];
      };
      if (!parsed?.variations || parsed.variations.length !== pack.variations.length) {
        this.log.warn('Gemini retornou formato inesperado; usando pacote original.');
        return null;
      }

      const merged: InstagramAdPack = {
        ...pack,
        strategicJustification:
          typeof parsed.strategicJustification === 'string'
            ? parsed.strategicJustification
            : pack.strategicJustification,
        variations: pack.variations.map((orig, i) => this.mergeVariation(orig, parsed.variations![i]!)),
      };
      return merged;
    } catch (e) {
      this.log.warn(`Gemini indisponível ou erro: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }

  private mergeVariation(orig: InstagramVariation, patch: Partial<InstagramVariation>): InstagramVariation {
    return {
      ...orig,
      ...patch,
      reelScript: patch.reelScript ?? orig.reelScript,
      carouselSlides: patch.carouselSlides ?? orig.carouselSlides,
      keyArguments: patch.keyArguments ?? orig.keyArguments,
    };
  }

  private parseJsonResponse(text: string): unknown {
    try {
      const trimmed = text.trim();
      const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      const raw = fence ? fence[1]!.trim() : trimmed;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
