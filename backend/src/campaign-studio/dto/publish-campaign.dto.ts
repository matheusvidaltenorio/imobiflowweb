import { PublicationPlatform } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class PublishCampaignDto {
  @IsEnum(PublicationPlatform)
  platform!: PublicationPlatform;

  /** Obrigatório para Instagram Feed e Facebook Post (página Meta conectada). */
  @IsOptional()
  @IsString()
  socialConnectionId?: string;
}
