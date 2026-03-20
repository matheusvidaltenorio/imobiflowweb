import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
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
}
