import {
  CommercialObjective,
  InstagramAdObjective,
  MarketingCampaignKind,
  MarketingCampaignStatus,
  PublicationPlatform,
} from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsEnum(MarketingCampaignStatus)
  status?: MarketingCampaignStatus;

  @IsOptional()
  @IsEnum(InstagramAdObjective)
  objective?: InstagramAdObjective;

  @IsOptional()
  @IsEnum(MarketingCampaignKind)
  campaignKind?: MarketingCampaignKind;

  @IsOptional()
  @IsEnum(CommercialObjective)
  commercialObjective?: CommercialObjective;

  @IsOptional()
  @IsString()
  internalDescription?: string;

  @IsOptional()
  @IsString()
  audienceNotes?: string;

  @IsOptional()
  @IsString()
  primaryCaption?: string;

  @IsOptional()
  @IsString()
  scheduledPublishAt?: string;

  /** IANA, ex.: America/Sao_Paulo */
  @IsOptional()
  @IsString()
  scheduleTimezone?: string;

  /** Canais automáticos (Instagram feed e/ou Facebook post). */
  @IsOptional()
  @IsArray()
  @IsEnum(PublicationPlatform, { each: true })
  scheduledChannels?: PublicationPlatform[];

  @IsOptional()
  @IsString()
  scheduledSocialConnectionId?: string | null;

  @IsOptional()
  @IsBoolean()
  autoRetryEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  maxRetries?: number;

  @IsOptional()
  @IsString()
  developmentId?: string | null;

  @IsOptional()
  @IsString()
  lotId?: string | null;

  @IsOptional()
  @IsString()
  blockId?: string | null;
}
