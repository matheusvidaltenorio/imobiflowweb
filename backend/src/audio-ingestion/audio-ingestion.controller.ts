import { Body, Controller, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { multerAudioConfig } from '../common/multer.audio.config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AudioIngestionService } from './audio-ingestion.service';
import type { ExtractedProfileDraft } from './transcript-extraction.service';

@Controller('audio-ingestion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class AudioIngestionController {
  constructor(private readonly service: AudioIngestionService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', multerAudioConfig))
  upload(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { leadId?: string; clientId?: string },
  ) {
    return this.service.uploadAndProcess(userId, role, file, {
      leadId: body.leadId,
      clientId: body.clientId,
    });
  }

  @Post(':id/apply')
  apply(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Body()
    body: ExtractedProfileDraft & { confirmLeadName?: string; confirmLeadEmail?: string },
  ) {
    return this.service.applyDraft(userId, role, id, body);
  }

  @Post(':id/reprocess')
  @UseInterceptors(FileInterceptor('file', multerAudioConfig))
  reprocess(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.reprocess(userId, role, id, file);
  }
}
