import { IsNotEmpty, IsString } from 'class-validator';

export class MetaDisconnectDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;
}
