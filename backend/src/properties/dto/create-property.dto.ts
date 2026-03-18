import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { PropertyType, PropertyStatus } from '@prisma/client';

export class CreatePropertyDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PropertyType)
  type: PropertyType;

  @IsEnum(PropertyStatus)
  @IsOptional()
  status?: PropertyStatus;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  area?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bedrooms?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bathrooms?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  garageSpaces?: number;

  @IsString()
  city: string;

  @IsString()
  neighborhood: string;

  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsOptional()
  number?: string;

  @IsString()
  @IsOptional()
  complement?: string;

  @IsString()
  @IsOptional()
  zipCode?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  developmentId?: string;
}
