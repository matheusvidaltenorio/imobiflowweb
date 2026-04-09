import { Injectable } from '@nestjs/common';
import { MockCampaignImageProvider } from './mock-campaign-image.provider';

/**
 * Alias do mock de imagem (“nano banana”) — troque por provider real no módulo.
 * Mantém o mesmo comportamento do Mock até integrar API de geração de imagem.
 */
@Injectable()
export class NanoBananaImageProvider extends MockCampaignImageProvider {
  override readonly name = 'nano-banana';
}
