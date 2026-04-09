'use client';

import { useMemo } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { nearbyCategoryLabel } from '@/lib/maps/nearby-place-styles';
import { cn } from '@/lib/utils';

export type NearbyPlaceRow = {
  id: string;
  name: string;
  category: string;
  travelTimeMinutes: number | null;
  routeSource?: string | null;
  shortAddress?: string | null;
};

export function NearbyPlacesPanel({
  id,
  places,
  travelMode,
  onTravelModeChange,
  onRefresh,
  refreshing,
  blockedCategories,
  onToggleCategory,
  className,
}: {
  id?: string;
  places: NearbyPlaceRow[];
  travelMode: 'driving' | 'walking';
  onTravelModeChange: (m: 'driving' | 'walking') => void;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  blockedCategories: Set<string>;
  onToggleCategory: (category: string, visible: boolean) => void;
  className?: string;
}) {
  const categories = useMemo(() => {
    const s = new Set<string>();
    places.forEach((p) => s.add(p.category));
    return Array.from(s).sort();
  }, [places]);

  const filtered = useMemo(
    () => places.filter((p) => !blockedCategories.has(p.category)),
    [places, blockedCategories],
  );

  return (
    <div
      id={id}
      className={cn('space-y-3 rounded-lg border border-surface-muted bg-white p-3 text-sm', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-primary-950">Serviços próximos</p>
        {onRefresh ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            disabled={refreshing}
            onClick={() => void onRefresh()}
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar (OSM)
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-gray-500">Deslocamento:</span>
        <button
          type="button"
          className={cn(
            'rounded-md px-2 py-0.5 text-xs font-semibold',
            travelMode === 'driving' ? 'bg-primary-100 text-primary-900' : 'text-gray-600 hover:bg-gray-100',
          )}
          onClick={() => onTravelModeChange('driving')}
        >
          Carro
        </button>
        <button
          type="button"
          className={cn(
            'rounded-md px-2 py-0.5 text-xs font-semibold',
            travelMode === 'walking' ? 'bg-primary-100 text-primary-900' : 'text-gray-600 hover:bg-gray-100',
          )}
          onClick={() => onTravelModeChange('walking')}
        >
          A pé
        </button>
      </div>

      <p className="text-[10px] leading-snug text-gray-500">
        Tempos: OSRM quando disponível; senão estimativa por distância (velocidade média). Dados em cache no banco.
      </p>

      {categories.length ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase text-gray-500">Filtrar categorias</p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <label key={c} className="flex cursor-pointer items-center gap-1 text-[10px]">
                <input
                  type="checkbox"
                  checked={!blockedCategories.has(c)}
                  onChange={(e) => onToggleCategory(c, e.target.checked)}
                  className="rounded border-gray-300"
                />
                {nearbyCategoryLabel(c)}
              </label>
            ))}
          </div>
        </div>
      ) : places.length === 0 ? (
        <p className="rounded-md border border-amber-100 bg-amber-50/90 px-2 py-1.5 text-[11px] leading-snug text-amber-950">
          Ainda não há pontos em cache para <strong>{travelMode === 'walking' ? 'a pé' : 'carro'}</strong>. Use
          &quot;Atualizar (OSM)&quot; neste modo para buscar e gravar tempos; ou volte ao modo em que você já
          atualizou antes.
        </p>
      ) : null}

      <ul className="max-h-52 space-y-2 overflow-y-auto text-xs">
        {filtered.length === 0 ? (
          <li className="text-gray-500">
            {places.length === 0
              ? 'Sem locais neste modo de deslocamento.'
              : 'Nenhum POI visível com os filtros atuais — reative categorias acima.'}
          </li>
        ) : (
          filtered.map((p) => (
            <li key={p.id} className="rounded-md border border-surface-muted/80 px-2 py-1.5">
              <span className="font-semibold text-gray-900">{p.name}</span>
              <span className="text-gray-500"> — {nearbyCategoryLabel(p.category)}</span>
              {p.travelTimeMinutes != null ? (
                <span className="ml-1 font-bold text-emerald-800">· {p.travelTimeMinutes} min</span>
              ) : null}
              {p.routeSource === 'haversine_speed_estimate' ? (
                <span className="block text-[9px] text-amber-700">Estimativa (sem rota detalhada)</span>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
