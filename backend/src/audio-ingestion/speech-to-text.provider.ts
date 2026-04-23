export const SPEECH_TO_TEXT = Symbol('SPEECH_TO_TEXT');

export type TranscriptionResult = {
  text: string;
  confidence?: number;
};

export interface SpeechToTextProvider {
  transcribe(buffer: Buffer, mimeType: string, filename: string): Promise<TranscriptionResult>;
}
