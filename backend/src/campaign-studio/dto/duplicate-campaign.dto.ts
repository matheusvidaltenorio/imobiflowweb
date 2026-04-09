import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DuplicateCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
