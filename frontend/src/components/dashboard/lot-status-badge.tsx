import { Badge } from '@/components/ui/badge';
import { lotStatusLabel } from '@/lib/lot-status';

type LotStatus = 'DISPONIVEL' | 'RESERVADO' | 'VENDIDO' | 'INDISPONIVEL' | string;

function variantForStatus(status: LotStatus): 'success' | 'warning' | 'danger' | 'muted' {
  switch (status) {
    case 'DISPONIVEL':
      return 'success';
    case 'RESERVADO':
      return 'warning';
    case 'VENDIDO':
      return 'danger';
    case 'INDISPONIVEL':
      return 'muted';
    default:
      return 'muted';
  }
}

export function LotStatusBadge({ status, className }: { status: LotStatus; className?: string }) {
  return (
    <Badge variant={variantForStatus(status)} className={className}>
      {lotStatusLabel(status)}
    </Badge>
  );
}
