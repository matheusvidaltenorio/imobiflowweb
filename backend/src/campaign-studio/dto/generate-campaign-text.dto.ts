import {
  InstagramAdObjective,
  InstagramAdTone,
  InstagramContentType,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

function toOptionalBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  if (v === 'false' || v === 0 || v === '0') return false;
  return undefined;
}

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
  @Transform(({ value }) => toOptionalBool(value))
  @IsBoolean()
  saveInstagramHistory?: boolean;

  /** Se true e GEMINI_API_KEY estiver configurada, refina textos com Google Gemini. */
  @IsOptional()
  @Transform(({ value }) => toOptionalBool(value))
  @IsBoolean()
  useGeminiLlm?: boolean;
}
