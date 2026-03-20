import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value;

export class UpdateProposalLinksDto {
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  clientId?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  propertyId?: string;
}
