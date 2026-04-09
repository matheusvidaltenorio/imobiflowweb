import { Injectable } from '@nestjs/common';
import {
  type CampaignImageGenerateInput,
  type CampaignImageGenerateResult,
  type ICampaignImageGenerationProvider,
} from './campaign-image-provider.token';

/**
 * Provider padrão: imagens placeholder (picsum) — sem API externa.
 * Troque `CAMPAIGN_IMAGE_PROVIDER` por um provider real (ex.: API de imagem) quando integrar.
 */
@Injectable()
export class MockCampaignImageProvider implements ICampaignImageGenerationProvider {
  readonly name: string = 'mock';

  async generate(input: CampaignImageGenerateInput): Promise<CampaignImageGenerateResult[]> {
    const seed = Math.abs(this.hashPrompt(input.prompt));
    const out: CampaignImageGenerateResult[] = [];
    for (let i = 0; i < input.count; i++) {
      const w = Math.min(Math.max(input.width, 320), 1200);
      const h = Math.min(Math.max(input.height, 320), 1200);
      out.push({
        url: `https://picsum.photos/seed/${seed + i}/${w}/${h}`,
        publicId: null,
      });
    }
    return out;
  }

  private hashPrompt(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h;
  }
}
