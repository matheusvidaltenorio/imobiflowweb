import { PublicationPlatform } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class SuggestedImagePromptDto {
  @IsOptional()
  @IsString()
  style?: string;

  @IsOptional()
  @IsEnum(PublicationPlatform)
  platform?: PublicationPlatform;

  @IsOptional()
  @IsString()
  referenceAssetId?: string;
}

export class GenerateAiImageDto {
  @IsString()
  @MinLength(8)
  prompt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  variationCount?: number;

  @IsOptional()
  @IsString()
  referenceAssetId?: string;
}
