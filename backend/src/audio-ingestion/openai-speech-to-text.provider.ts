import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SpeechToTextProvider, TranscriptionResult } from './speech-to-text.provider';

@Injectable()
export class OpenAiSpeechToTextProvider implements SpeechToTextProvider {
  private readonly log = new Logger(OpenAiSpeechToTextProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('OPENAI_API_KEY');
  }

  async transcribe(buffer: Buffer, mimeType: string, filename: string): Promise<TranscriptionResult> {
    const key = this.config.get<string>('OPENAI_API_KEY');
    if (!key) throw new Error('OPENAI_API_KEY não configurada');

    const fd = new FormData();
    fd.append('model', 'whisper-1');
    fd.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename || 'audio.webm');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
    });

    if (!res.ok) {
      const err = await res.text();
      this.log.warn(`Whisper falhou: ${res.status} ${err}`);
      throw new Error('Falha na transcrição (Whisper)');
    }

    const data = (await res.json()) as { text?: string };
    const text = data.text?.trim() ?? '';
    return { text, confidence: 0.85 };
  }
}
