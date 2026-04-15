import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class BankImageItemDto {
  @IsString()
  @MinLength(4)
  url!: string;

  @IsOptional()
  @IsString()
  publicId?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  /** ID da `PropertyImage` de origem (galeria do imóvel), quando aplicável. */
  @IsOptional()
  @IsString()
  sourcePropertyImageId?: string;
}

export class AddBankAssetsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankImageItemDto)
  items!: BankImageItemDto[];
}

export class PatchAssetDto {
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
