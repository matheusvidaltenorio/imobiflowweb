import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AuditModule } from '../audit/audit.module';
import { AudioIngestionController } from './audio-ingestion.controller';
import { AudioIngestionService } from './audio-ingestion.service';
import { SPEECH_TO_TEXT } from './speech-to-text.provider';
import { OpenAiSpeechToTextProvider } from './openai-speech-to-text.provider';
import { StubSpeechToTextProvider } from './stub-speech-to-text.provider';
import { TranscriptExtractionService } from './transcript-extraction.service';

@Module({
  imports: [PrismaModule, CloudinaryModule, AuditModule, ConfigModule],
  controllers: [AudioIngestionController],
  providers: [
    TranscriptExtractionService,
    OpenAiSpeechToTextProvider,
    StubSpeechToTextProvider,
    {
      provide: SPEECH_TO_TEXT,
      useFactory: (cfg: ConfigService, openai: OpenAiSpeechToTextProvider, stub: StubSpeechToTextProvider) =>
        cfg.get<string>('OPENAI_API_KEY') ? openai : stub,
      inject: [ConfigService, OpenAiSpeechToTextProvider, StubSpeechToTextProvider],
    },
    AudioIngestionService,
  ],
  exports: [AudioIngestionService],
})
export class AudioIngestionModule {}
