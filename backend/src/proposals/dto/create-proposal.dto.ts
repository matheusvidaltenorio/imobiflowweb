import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value;

export class CreateProposalDto {
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  clientId?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  bank: string;

  @IsNumber()
  @Min(0.01)
  installment: number;

  @IsInt()
  @Min(1)
  months: number;

  @IsNumber()
  @Min(0)
  downPayment: number;
}
