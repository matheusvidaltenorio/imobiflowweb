import { cn } from '@/lib/utils';

export type DevelopmentLocationPrecision = 'EXATA' | 'APROXIMADA' | 'PENDENTE';

const LABELS: Record<DevelopmentLocationPrecision, string> = {
  EXATA: 'Localização exata',
  APROXIMADA: 'Localização aproximada',
  PENDENTE: 'Localização pendente',
};

const STYLES: Record<DevelopmentLocationPrecision, string> = {
  EXATA: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  APROXIMADA: 'border-amber-200 bg-amber-50 text-amber-950',
  PENDENTE: 'border-slate-300 bg-slate-100 text-slate-800',
};

export function LocationPrecisionBadge({
  precision,
  className,
}: {
  precision: DevelopmentLocationPrecision;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        STYLES[precision],
        className,
      )}
      title={LABELS[precision]}
    >
      {precision}
    </span>
  );
}
