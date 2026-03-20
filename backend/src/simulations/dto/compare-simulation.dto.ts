import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
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
}
