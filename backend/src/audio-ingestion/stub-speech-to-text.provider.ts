import { Injectable } from '@nestjs/common';
import type { SpeechToTextProvider, TranscriptionResult } from './speech-to-text.provider';

/** Desenvolvimento / fallback quando não há API de STT. */
@Injectable()
export class StubSpeechToTextProvider implements SpeechToTextProvider {
  async transcribe(): Promise<TranscriptionResult> {
    return {
      text:
        '[Transcrição simulada] Configure OPENAI_API_KEY para usar Whisper. ' +
        'Descreva aqui manualmente o que o cliente pediu no áudio.',
      confidence: 0.2,
    };
  }
}
