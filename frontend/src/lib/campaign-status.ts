/**
 * Rótulos amigáveis para status operacional de campanhas (alinhado ao backend).
 */
export function labelCampaignStatus(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Rascunho',
    READY: 'Pronta',
    SCHEDULED: 'Agendada',
    QUEUED: 'Na fila',
    PROCESSING: 'Processando',
    PUBLISHED: 'Publicada',
    FAILED: 'Falhou',
    RETRYING: 'Nova tentativa',
    CANCELED: 'Cancelada',
    ARCHIVED: 'Arquivada',
  };
  return map[status] ?? status;
}

export function campaignStatusBadgeClass(status: string): string {
  switch (status) {
    case 'PUBLISHED':
      return 'bg-emerald-100 text-emerald-950';
    case 'FAILED':
      return 'bg-red-100 text-red-900';
    case 'SCHEDULED':
    case 'QUEUED':
      return 'bg-sky-100 text-sky-950';
    case 'PROCESSING':
      return 'bg-amber-100 text-amber-950';
    case 'RETRYING':
      return 'bg-orange-100 text-orange-950';
    case 'CANCELED':
      return 'bg-slate-200 text-slate-800';
    case 'ARCHIVED':
      return 'bg-slate-100 text-slate-600';
    default:
      return 'bg-primary-100 text-primary-900';
  }
}
