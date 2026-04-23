import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AudioIngestionStatus,
  Prisma,
  PropertyIntent,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AuditService } from '../audit/audit.service';
import { SPEECH_TO_TEXT, type SpeechToTextProvider } from './speech-to-text.provider';
import { TranscriptExtractionService, type ExtractedProfileDraft } from './transcript-extraction.service';

@Injectable()
export class AudioIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly extraction: TranscriptExtractionService,
    private readonly audit: AuditService,
    @Inject(SPEECH_TO_TEXT) private readonly stt: SpeechToTextProvider,
  ) {}

  private async assertLeadAccess(userId: string, role: UserRole, leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    if (role === UserRole.ADMIN) return lead;
    if (lead.userId === userId) return lead;
    throw new ForbiddenException();
  }

  private async assertClientAccess(userId: string, role: UserRole, clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    if (role === UserRole.ADMIN) return client;
    if (client.brokerId === userId) return client;
    throw new ForbiddenException();
  }

  async uploadAndProcess(
    userId: string,
    role: UserRole,
    file: Express.Multer.File,
    opts: { leadId?: string; clientId?: string },
  ) {
    if (opts.leadId) await this.assertLeadAccess(userId, role, opts.leadId);
    if (opts.clientId) await this.assertClientAccess(userId, role, opts.clientId);
    if (!opts.leadId && !opts.clientId) throw new BadRequestException('Informe leadId ou clientId');

    const { url, publicId } = await this.cloudinary.uploadAudio(file);

    const row = await this.prisma.audioIngestion.create({
      data: {
        userId,
        leadId: opts.leadId,
        clientId: opts.clientId,
        sourceUrl: url,
        publicId,
        mimeType: file.mimetype,
        durationMs: null,
        status: AudioIngestionStatus.TRANSCRIBING,
      },
    });

    try {
      const tr = await this.stt.transcribe(file.buffer, file.mimetype, file.originalname || 'audio.webm');
      const draft = this.extraction.extractHeuristic(tr.text);
      const updated = await this.prisma.audioIngestion.update({
        where: { id: row.id },
        data: {
          status: AudioIngestionStatus.EXTRACTED,
          transcriptRaw: tr.text,
          transcriptConfidence: tr.confidence ?? null,
          extractionJson: draft as unknown as Prisma.InputJsonValue,
        },
      });
      await this.audit.log({
        userId,
        action: 'AUDIO_INGESTION_PROCESSED',
        entity: 'AudioIngestion',
        entityId: row.id,
        metadata: { leadId: opts.leadId, clientId: opts.clientId },
      });
      return updated;
    } catch (e) {
      await this.prisma.audioIngestion.update({
        where: { id: row.id },
        data: {
          status: AudioIngestionStatus.FAILED,
          extractionError: e instanceof Error ? e.message : String(e),
        },
      });
      throw e;
    }
  }

  async applyDraft(
    userId: string,
    role: UserRole,
    audioId: string,
    draft: ExtractedProfileDraft & { confirmLeadEmail?: string; confirmLeadName?: string },
  ) {
    const audio = await this.prisma.audioIngestion.findUnique({ where: { id: audioId } });
    if (!audio || audio.userId !== userId) {
      if (role !== UserRole.ADMIN) throw new ForbiddenException();
    }
    if (!audio) throw new NotFoundException();
    if (audio.leadId) await this.assertLeadAccess(userId, role, audio.leadId);
    if (audio.clientId) await this.assertClientAccess(userId, role, audio.clientId);

    if (audio.leadId) {
      const prevLead = await this.prisma.lead.findUnique({ where: { id: audio.leadId } });
      await this.prisma.lead.update({
        where: { id: audio.leadId },
        data: {
          name: draft.confirmLeadName ?? draft.clientName ?? undefined,
          email: draft.confirmLeadEmail ?? draft.email ?? undefined,
          phone: draft.phone ?? undefined,
          notes: draft.notes
            ? [prevLead?.notes, `[Áudio] ${draft.notes}`].filter(Boolean).join('\n\n')
            : undefined,
        },
      });

      await this.prisma.interestProfile.upsert({
        where: { leadId: audio.leadId },
        create: {
          leadId: audio.leadId,
          budgetMin: draft.budgetMin != null ? new Prisma.Decimal(draft.budgetMin) : undefined,
          budgetMax: draft.budgetMax != null ? new Prisma.Decimal(draft.budgetMax) : undefined,
          minArea: draft.minAreaM2 != null ? new Prisma.Decimal(draft.minAreaM2) : undefined,
          maxArea: draft.maxAreaM2 != null ? new Prisma.Decimal(draft.maxAreaM2) : undefined,
          propertyIntent: draft.intent ?? PropertyIntent.OUTRO,
          extraJson: { fromAudioIngestionId: audioId } as Prisma.InputJsonValue,
        },
        update: {
          budgetMin: draft.budgetMin != null ? new Prisma.Decimal(draft.budgetMin) : undefined,
          budgetMax: draft.budgetMax != null ? new Prisma.Decimal(draft.budgetMax) : undefined,
          minArea: draft.minAreaM2 != null ? new Prisma.Decimal(draft.minAreaM2) : undefined,
          maxArea: draft.maxAreaM2 != null ? new Prisma.Decimal(draft.maxAreaM2) : undefined,
          propertyIntent: draft.intent ?? undefined,
        },
      });
    }

    if (audio.clientId) {
      await this.prisma.client.update({
        where: { id: audio.clientId },
        data: {
          name: draft.confirmLeadName ?? draft.clientName ?? undefined,
          email: draft.confirmLeadEmail ?? draft.email ?? undefined,
          phone: draft.phone ?? undefined,
          notes: draft.notes ?? undefined,
        },
      });
      await this.prisma.interestProfile.upsert({
        where: { clientId: audio.clientId },
        create: {
          clientId: audio.clientId,
          budgetMin: draft.budgetMin != null ? new Prisma.Decimal(draft.budgetMin) : undefined,
          budgetMax: draft.budgetMax != null ? new Prisma.Decimal(draft.budgetMax) : undefined,
          minArea: draft.minAreaM2 != null ? new Prisma.Decimal(draft.minAreaM2) : undefined,
          maxArea: draft.maxAreaM2 != null ? new Prisma.Decimal(draft.maxAreaM2) : undefined,
          propertyIntent: draft.intent ?? PropertyIntent.OUTRO,
          extraJson: { fromAudioIngestionId: audioId } as Prisma.InputJsonValue,
        },
        update: {
          budgetMin: draft.budgetMin != null ? new Prisma.Decimal(draft.budgetMin) : undefined,
          budgetMax: draft.budgetMax != null ? new Prisma.Decimal(draft.budgetMax) : undefined,
          minArea: draft.minAreaM2 != null ? new Prisma.Decimal(draft.minAreaM2) : undefined,
          maxArea: draft.maxAreaM2 != null ? new Prisma.Decimal(draft.maxAreaM2) : undefined,
          propertyIntent: draft.intent ?? undefined,
        },
      });
    }

    const applied = await this.prisma.audioIngestion.update({
      where: { id: audioId },
      data: { status: AudioIngestionStatus.APPLIED, appliedAt: new Date() },
    });

    await this.audit.log({
      userId,
      action: 'AUDIO_INGESTION_APPLIED',
      entity: 'AudioIngestion',
      entityId: audioId,
      metadata: { leadId: audio.leadId, clientId: audio.clientId },
    });

    return applied;
  }

  async reprocess(userId: string, role: UserRole, audioId: string, file: Express.Multer.File) {
    const audio = await this.prisma.audioIngestion.findUnique({ where: { id: audioId } });
    if (!audio) throw new NotFoundException();
    if (role !== UserRole.ADMIN && audio.userId !== userId) throw new ForbiddenException();
    if (audio.leadId) await this.assertLeadAccess(userId, role, audio.leadId);
    if (audio.clientId) await this.assertClientAccess(userId, role, audio.clientId);

    const tr = await this.stt.transcribe(file.buffer, file.mimetype, file.originalname || 'audio.webm');
    const draft = this.extraction.extractHeuristic(tr.text);
    return this.prisma.audioIngestion.update({
      where: { id: audioId },
      data: {
        status: AudioIngestionStatus.EXTRACTED,
        transcriptRaw: tr.text,
        transcriptConfidence: tr.confidence ?? null,
        extractionJson: draft as unknown as Prisma.InputJsonValue,
        extractionError: null,
      },
    });
  }
}
