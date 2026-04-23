import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DailyAvailabilitySourceType, LotDailySnapshotStatus } from '@prisma/client';

export class LotSnapshotItemDto {
  @IsString()
  @MinLength(1)
  lotId!: string;

  @IsEnum(LotDailySnapshotStatus)
  status!: LotDailySnapshotStatus;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSnapshotDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date deve ser YYYY-MM-DD' })
  date!: string;

  @IsEnum(DailyAvailabilitySourceType)
  sourceType!: DailyAvailabilitySourceType;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  rawText?: string;

  @IsOptional()
  @IsString()
  sourceFileUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LotSnapshotItemDto)
  snapshots?: LotSnapshotItemDto[];

  /** Metadados do fluxo assistido (imagem, confirmação, totais). */
  @IsOptional()
  @IsObject()
  assistedMetadata?: Record<string, unknown>;

  /** Quando true, registra auditoria de confirmação humana. */
  @IsOptional()
  @IsBoolean()
  assistedConfirmed?: boolean;

  /** Metadados de importação por planilha (arquivo, template, contagens). */
  @IsOptional()
  @IsObject()
  importMetadata?: Record<string, unknown>;
}

export class BulkSnapshotDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date deve ser YYYY-MM-DD' })
  date!: string;

  @IsEnum(DailyAvailabilitySourceType)
  sourceType!: DailyAvailabilitySourceType;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Se informado, aplica apenas aos lotes desta quadra. */
  @IsOptional()
  @IsString()
  blockId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lotIds?: string[];

  @IsEnum(LotDailySnapshotStatus)
  status!: LotDailySnapshotStatus;
}

export class ResetDayDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date deve ser YYYY-MM-DD' })
  date!: string;

  @IsEnum(DailyAvailabilitySourceType)
  sourceType!: DailyAvailabilitySourceType;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ParseCsvDto {
  @IsString()
  @MinLength(1)
  csvText!: string;
}
