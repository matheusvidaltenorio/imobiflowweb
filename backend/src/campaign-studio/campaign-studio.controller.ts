import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { multerConfig } from '../common/multer.config';
import { CampaignStudioService } from './campaign-studio.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { GenerateCampaignTextDto } from './dto/generate-campaign-text.dto';
import { AddBankAssetsDto, PatchAssetDto } from './dto/campaign-assets.dto';
import { GenerateAiImageDto, SuggestedImagePromptDto } from './dto/ai-image.dto';
import { DuplicateCampaignDto } from './dto/duplicate-campaign.dto';
import { PublishCampaignDto } from './dto/publish-campaign.dto';

@Controller('campaign-studio')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class CampaignStudioController {
  constructor(private readonly studio: CampaignStudioService) {}

  @Get('capabilities')
  capabilities() {
    return this.studio.getCapabilities();
  }

  @Post('campaigns')
  create(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.studio.create(userId, role, dto);
  }

  @Get('campaigns')
  list(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('developmentId') developmentId?: string,
  ) {
    return this.studio.list(userId, role, developmentId);
  }

  @Get('campaigns/:id')
  getOne(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    return this.studio.getById(userId, role, id);
  }

  @Patch('campaigns/:id')
  update(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.studio.update(userId, role, id, dto);
  }

  @Delete('campaigns/:id')
  archive(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    return this.studio.archive(userId, role, id);
  }

  @Post('campaigns/:id/duplicate')
  duplicate(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Body() dto: DuplicateCampaignDto,
  ) {
    return this.studio.duplicate(userId, role, id, dto.title);
  }

  @Get('available-images')
  availableImages(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('developmentId') developmentId: string,
    @Query('lotId') lotId?: string,
  ) {
    return this.studio.availableImages(userId, role, developmentId, lotId);
  }

  @Post('campaigns/:id/assets/from-bank')
  addFromBank(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Body() dto: AddBankAssetsDto,
  ) {
    return this.studio.addBankAssets(userId, role, id, dto);
  }

  @Post('campaigns/:id/assets/upload')
  @UseInterceptors(FilesInterceptor('files', 12, multerConfig))
  uploadAssets(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.studio.uploadAssets(userId, role, id, files ?? []);
  }

  @Patch('campaigns/:id/assets/:assetId')
  patchAsset(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @Body() dto: PatchAssetDto,
  ) {
    return this.studio.patchAsset(userId, role, id, assetId, dto);
  }

  @Delete('campaigns/:id/assets/:assetId')
  deleteAsset(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Param('assetId') assetId: string,
  ) {
    return this.studio.deleteAsset(userId, role, id, assetId);
  }

  @Post('campaigns/:id/generate-text')
  generateText(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Body() dto: GenerateCampaignTextDto,
  ) {
    return this.studio.generateText(userId, role, id, dto);
  }

  @Post('campaigns/:id/publish')
  publish(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Body() dto: PublishCampaignDto,
  ) {
    return this.studio.publish(userId, role, id, dto);
  }

  @Get('campaigns/:id/whatsapp')
  whatsappPayload(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    return this.studio.whatsappPayload(userId, role, id);
  }

  @Get('campaigns/:id/export')
  exportBundle(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    return this.studio.exportBundle(userId, role, id);
  }

  @Post('campaigns/:id/ai-image/suggested-prompt')
  suggestedPrompt(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Body() dto: SuggestedImagePromptDto,
  ) {
    return this.studio.suggestedImagePrompt(userId, role, id, dto);
  }

  @Post('campaigns/:id/ai-image/generate')
  generateAi(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Body() dto: GenerateAiImageDto,
  ) {
    return this.studio.generateAiImages(userId, role, id, dto);
  }
}
