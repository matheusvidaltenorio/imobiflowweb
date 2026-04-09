import { Layer, Source } from '@/components/maps/map-view';
import type { FeatureCollection } from 'geojson';

/**
 * Área do loteamento no MapLibre: preenchimento e contorno conforme `areaStyle` em cada feature.
 * Contorno sempre tracejado (verde exato, laranja aproximado, cinza pendente).
 */
export function LoteamentoAreaLayer({
  data,
  sourceId = 'development-area',
  highlighted = false,
}: {
  data: FeatureCollection;
  sourceId?: string;
  highlighted?: boolean;
}) {
  if (!data.features.length) return null;

  const wExact = highlighted ? 4 : 3;
  const wApprox = highlighted ? 3.5 : 2.5;
  const wPending = highlighted ? 3 : 2;
  const fillExact = highlighted ? 0.34 : 0.28;
  const fillApprox = highlighted ? 0.26 : 0.2;
  const fillPend = highlighted ? 0.2 : 0.14;

  return (
    <Source id={sourceId} type="geojson" data={data}>
      <Layer
        id="dev-fill"
        type="fill"
        paint={{
          'fill-color': [
            'match',
            ['get', 'areaStyle'],
            'EXATA',
            '#22c55e',
            'APROXIMADA',
            '#fb923c',
            'PENDENTE',
            '#94a3b8',
            '#94a3b8',
          ],
          'fill-opacity': [
            'match',
            ['get', 'areaStyle'],
            'EXATA',
            fillExact,
            'APROXIMADA',
            fillApprox,
            'PENDENTE',
            fillPend,
            fillPend,
          ],
        }}
      />
      <Layer
        id="dev-outline"
        type="line"
        paint={{
          'line-color': [
            'match',
            ['get', 'areaStyle'],
            'EXATA',
            '#166534',
            'APROXIMADA',
            '#c2410c',
            'PENDENTE',
            '#475569',
            '#64748b',
          ],
          'line-width': [
            'match',
            ['get', 'areaStyle'],
            'EXATA',
            wExact,
            'APROXIMADA',
            wApprox,
            'PENDENTE',
            wPending,
            wApprox,
          ],
          'line-dasharray': [3, 2],
        }}
      />
    </Source>
  );
}
