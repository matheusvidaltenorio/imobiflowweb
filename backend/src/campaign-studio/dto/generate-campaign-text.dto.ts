import {
  InstagramAdObjective,
  InstagramAdTone,
  InstagramContentType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class GenerateCampaignTextDto {
  @IsOptional()
  @IsEnum(InstagramContentType)
  contentType?: InstagramContentType;

  @IsOptional()
  @IsEnum(InstagramAdObjective)
  objective?: InstagramAdObjective;

  @IsOptional()
  @IsEnum(InstagramAdTone)
  tone?: InstagramAdTone;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2)
  variationIndex?: number;

  @IsOptional()
  @IsBoolean()
  saveInstagramHistory?: boolean;

  /** Se true e GEMINI_API_KEY estiver configurada, refina textos com Google Gemini. */
  @IsOptional()
  @IsBoolean()
  useGeminiLlm?: boolean;
}
