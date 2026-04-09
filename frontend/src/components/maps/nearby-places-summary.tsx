'use client';

import { nearbyCategoryLabel } from '@/lib/maps/nearby-place-styles';
import { Card } from '@/components/ui/card';

type Row = {
  id: string;
  name: string;
  category: string;
  travelTimeMinutes: number | null;
};

export function NearbyPlacesSummary({
  places,
  travelMode,
  maxItems = 8,
}: {
  places: Row[];
  travelMode: 'driving' | 'walking';
  maxItems?: number;
}) {
  if (!places.length) {
    return (
      <Card className="border-dashed border-surface-muted bg-surface/40 p-4 text-sm text-gray-600">
        Nenhum serviço próximo em cache. Use &quot;Atualizar (OSM)&quot; no mapa para buscar e gravar pontos com tempo
        estimado.
      </Card>
    );
  }

  const sorted = [...places]
    .filter((p) => p.travelTimeMinutes != null)
    .sort((a, b) => (a.travelTimeMinutes ?? 999) - (b.travelTimeMinutes ?? 999))
    .slice(0, maxItems);

  const modeLabel = travelMode === 'driving' ? 'carro' : 'a pé';

  return (
    <Card className="border-surface-muted p-4">
      <p className="text-sm font-bold text-primary-950">Serviços próximos (estimativa — {modeLabel})</p>
      <p className="mt-1 text-xs text-gray-500">
        Tempos gravados no banco (OSRM quando disponível; senão estimativa por distância). Atualize pelo mapa abaixo.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {sorted.map((p) => (
          <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-surface-muted/80 pb-2 last:border-0 last:pb-0">
            <span className="font-medium text-gray-900">{p.name}</span>
            <span className="text-xs text-gray-600">
              {nearbyCategoryLabel(p.category)}
              {p.travelTimeMinutes != null ? (
                <span className="ml-2 font-bold text-emerald-800">— {p.travelTimeMinutes} min</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {sorted.length < places.length ? (
        <p className="mt-2 text-[11px] text-gray-500">Mostrando os {sorted.length} mais rápidos entre {places.length} em cache.</p>
      ) : null}
    </Card>
  );
}
