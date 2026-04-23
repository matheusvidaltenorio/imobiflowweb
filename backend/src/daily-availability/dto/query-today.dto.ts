import { IsOptional, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryTodayDto {
  @IsOptional()
  @IsString()
  developmentId?: string;

  @IsOptional()
  @IsString()
  blockId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @Type(() => Number)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  minArea?: number;

  @IsOptional()
  @Type(() => Number)
  maxArea?: number;
}

export class QueryHistoryDto {
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
