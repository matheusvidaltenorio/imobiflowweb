import { IsNotEmpty, IsString } from 'class-validator';

export class SelectMetaPageDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;
}
