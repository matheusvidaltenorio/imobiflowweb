import { IsOptional, IsString } from 'class-validator';

/** Query string para analytics comercial (período e filtros opcionais). */
export class CommercialAnalyticsQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  /** Filtra por loteamento (lead.developmentId ou lote vinculado). */
  @IsOptional()
  @IsString()
  developmentId?: string;

  /** Apenas ADMIN: filtra por corretor (userId do lead / visita / venda). */
  @IsOptional()
  @IsString()
  brokerId?: string;

  /** Campanha de marketing (atribuição em Lead.marketingCampaignId). */
  @IsOptional()
  @IsString()
  campaignId?: string;

  /** leadSource ou source (quando iguais). */
  @IsOptional()
  @IsString()
  leadSource?: string;
}
