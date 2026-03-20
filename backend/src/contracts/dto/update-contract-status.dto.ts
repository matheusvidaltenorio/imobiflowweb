import { IsEnum } from 'class-validator';
import { ContractStatus } from '@prisma/client';

export class UpdateContractStatusDto {
  @IsEnum(ContractStatus)
  status: ContractStatus;
}
