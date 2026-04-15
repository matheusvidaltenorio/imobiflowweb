import {
  CommercialObjective,
  InstagramAdObjective,
  MarketingCampaignKind,
  PublicationPlatform,
} from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, MinLength, ArrayMinSize } from 'class-validator';

export class CreateCampaignDto {
  /** Obrigatório exceto para `campaignKind === INSTITUCIONAL`. */
  @IsOptional()
  @IsString()
  developmentId?: string;

  @IsOptional()
  @IsString()
  lotId?: string;

  @IsOptional()
  @IsString()
  blockId?: string;

  @IsString()
  @MinLength(2)
  title!: string;

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

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(PublicationPlatform, { each: true })
  platforms!: PublicationPlatform[];
}
