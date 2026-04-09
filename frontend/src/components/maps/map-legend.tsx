import { NEARBY_CATEGORY_LABEL, nearbyCategoryColor } from '@/lib/maps/nearby-place-styles';
import { cn } from '@/lib/utils';

const DEFAULT_CATEGORIES = [
  'supermarket',
  'pharmacy',
  'fast_food',
  'school',
  'fuel',
  'hospital',
  'gym',
];

export function MapLegend({
  className,
  categories = DEFAULT_CATEGORIES,
  compact = false,
}: {
  className?: string;
  categories?: string[];
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-emerald-200/80 bg-white/95 shadow-sm backdrop-blur-sm',
        compact ? 'p-1.5 text-[9px]' : 'p-2 text-[10px]',
        className,
      )}
    >
      <p className={cn('mb-1.5 font-bold uppercase tracking-wide text-emerald-900', compact && 'mb-1')}>
        Legenda
      </p>
      <ul className={cn('space-y-1 text-gray-700', compact && 'space-y-0.5')}>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-sm bg-emerald-400/60 ring-1 ring-emerald-800" />
          <span>Loteamento exato (verde)</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-sm bg-orange-400/50 ring-1 ring-orange-700 ring-dashed" />
          <span>Loteamento aproximado (laranja)</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-sm bg-slate-300/50 ring-1 ring-slate-600" />
          <span>Loteamento pendente (cinza)</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-0 w-6 border-t-[3px] border-dashed border-emerald-800" />
          <span>Contorno do loteamento (verde tracejado = exato)</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-0 w-6 border-t-2 border-dashed border-orange-700" />
          <span>Contorno laranja = aproximado</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-800 ring-2 ring-white" />
          <span>Pin central do loteamento</span>
        </li>
        {!compact ? (
          <li className="flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-600 bg-white text-[9px] font-bold text-emerald-700">
              ·
            </span>
            <span>Serviços próximos (ícone por tipo)</span>
          </li>
        ) : null}
        {categories.map((c) => (
          <li key={c} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: nearbyCategoryColor(c) }}
            />
            <span>{NEARBY_CATEGORY_LABEL[c] ?? c}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
