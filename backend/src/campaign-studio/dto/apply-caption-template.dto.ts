import { IsString, MinLength } from 'class-validator';

export class ApplyCaptionTemplateDto {
  @IsString()
  @MinLength(2)
  templateId!: string;
}
