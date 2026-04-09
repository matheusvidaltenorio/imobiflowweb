import { InstagramAdObjective, PublicationPlatform } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, MinLength, ArrayMinSize } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  developmentId!: string;

  @IsOptional()
  @IsString()
  lotId?: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsEnum(InstagramAdObjective)
  objective?: InstagramAdObjective;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(PublicationPlatform, { each: true })
  platforms!: PublicationPlatform[];
}
