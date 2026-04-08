import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value;

export class CompareSimulationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  clientName: string;

  @IsString()
  @MinLength(11)
  @MaxLength(20)
  cpf: string;

  @IsNumber()
  @Min(0.01)
  income: number;

  @IsNumber()
  @Min(0.01)
  propertyValue: number;

  @IsNumber()
  @Min(0)
  downPayment: number;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  clientPhone?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  clientId?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsBoolean()
  save?: boolean;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(120)
  age?: number;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @IsIn(['SOLTEIRO', 'CASADO', 'DIVORCIADO', 'VIUVO'])
  maritalStatus?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  dependents?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasFGTS?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fgtsAmount?: number;

  /** Quando true, exige entrada ≥ 10% do valor do imóvel (LTV máx. 90%). */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  enforceMinDownPercent?: boolean;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  lotId?: string;

  /** Prazo único da simulação (12–420). Quando informado, a comparação por banco usa só este prazo. */
  @IsOptional()
  @IsInt()
  @Min(12)
  @Max(420)
  chosenTermMonths?: number;

  @IsOptional()
  @IsIn(['TR', 'FIXA'])
  indexer?: 'TR' | 'FIXA';

  @IsOptional()
  @IsIn(['SBPE', 'PADRAO'])
  productLine?: 'SBPE' | 'PADRAO';

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeMortgageAnalysis?: boolean;

  /** Snapshot do assistente (etapas Caixa) para histórico. */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
