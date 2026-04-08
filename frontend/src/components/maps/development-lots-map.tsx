'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  GoogleMap,
  InfoWindow,
  Marker,
  Polygon,
  useJsApiLoader,
} from '@react-google-maps/api';
import { Maximize2, Minimize2, Navigation, Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getDefaultMapCenter, getGoogleMapsApiKey, getGoogleMapsMapId } from '@/lib/maps/config';
import { googleDirectionsUrl, lotStatusMapStyle, championAccent } from '@/lib/maps/lot-map-styles';
import { parsePolygonCoordinates, toGooglePath } from '@/lib/maps/polygon';
import { cn, formatPrice } from '@/lib/utils';

export type GeoMapDevelopment = {
  id: string;
  name: string;
  city: string;
  state?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  zipCode?: string | null;
  latitude: number | null;
  longitude: number | null;
  polygonCoordinates?: unknown;
};

export type GeoMapLot = {
  id: string;
  number: string;
  status: string;
  area: number | null;
  price: number | null;
  blockId: string;
  blockName: string;
  latitude: number | null;
  longitude: number | null;
  polygonCoordinates?: unknown;
  geoStatus?: string;
  isChampion?: boolean;
  isStalled?: boolean;
  saleScore?: number | null;
  saleClassification?: string | null;
  mapLabel?: string | null;
  referencePoint?: string | null;
  streetFront?: string | null;
};

const LIBRARIES: ('geometry')[] = ['geometry'];

function hasPlottablePosition(lot: GeoMapLot): boolean {
  const poly = parsePolygonCoordinates(lot.polygonCoordinates);
  if (poly && poly.length >= 3) return true;
  return lot.latitude != null && lot.longitude != null;
}

type FilterState = {
  DISPONIVEL: boolean;
  RESERVADO: boolean;
  VENDIDO: boolean;
  INDISPONIVEL: boolean;
  championOnly: boolean;
  stalledOnly: boolean;
  blockId: string;
  minPrice: string;
  maxPrice: string;
};

const defaultFilters: FilterState = {
  DISPONIVEL: true,
  RESERVADO: true,
  VENDIDO: true,
  INDISPONIVEL: true,
  championOnly: false,
  stalledOnly: false,
  blockId: '',
  minPrice: '',
  maxPrice: '',
};

export function DevelopmentLotsMap({
  development,
  lots,
  highlightLotId,
  initialPresentation = false,
  compact = false,
  className,
}: {
  development: GeoMapDevelopment;
  lots: GeoMapLot[];
  highlightLotId?: string | null;
  initialPresentation?: boolean;
  /** Mapa menor, sem painel de filtros (ex.: pré-visualização na edição do lote). */
  compact?: boolean;
  className?: string;
}) {
  const apiKey = getGoogleMapsApiKey();
  const mapIdOpt = getGoogleMapsMapId();
  const [presentation, setPresentation] = useState(initialPresentation);
  const [fullscreen, setFullscreen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [activeLotId, setActiveLotId] = useState<string | null>(highlightLotId ?? null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'imobflow-google-maps',
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
    mapIds: mapIdOpt ? [mapIdOpt] : undefined,
  });

  useEffect(() => {
    if (highlightLotId) setActiveLotId(highlightLotId);
  }, [highlightLotId]);

  const filteredLots = useMemo(() => {
    return lots.filter((l) => {
      if (l.status === 'DISPONIVEL' && !filters.DISPONIVEL) return false;
      if (l.status === 'RESERVADO' && !filters.RESERVADO) return false;
      if (l.status === 'VENDIDO' && !filters.VENDIDO) return false;
      if (l.status === 'INDISPONIVEL' && !filters.INDISPONIVEL) return false;
      if (filters.championOnly && !l.isChampion) return false;
      if (filters.stalledOnly && !l.isStalled) return false;
      if (filters.blockId && l.blockId !== filters.blockId) return false;
      const min = filters.minPrice ? Number(filters.minPrice) : null;
      const max = filters.maxPrice ? Number(filters.maxPrice) : null;
      if (min != null && Number.isFinite(min) && l.price != null && l.price < min) return false;
      if (max != null && Number.isFinite(max) && l.price != null && l.price > max) return false;
      return true;
    });
  }, [lots, filters]);

  const plottableLots = useMemo(
    () => filteredLots.filter(hasPlottablePosition),
    [filteredLots],
  );

  const devCenter = useMemo(() => {
    if (development.latitude != null && development.longitude != null) {
      return { lat: development.latitude, lng: development.longitude };
    }
    return getDefaultMapCenter();
  }, [development.latitude, development.longitude]);

  const devPolygonPath = useMemo(() => {
    const p = parsePolygonCoordinates(development.polygonCoordinates);
    return p ? toGooglePath(p) : null;
  }, [development.polygonCoordinates]);

  const fitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    const bounds = new google.maps.LatLngBounds();
    let n = 0;
    if (development.latitude != null && development.longitude != null) {
      bounds.extend({ lat: development.latitude, lng: development.longitude });
      n++;
    }
    if (devPolygonPath?.length) {
      devPolygonPath.forEach((pt) => bounds.extend(pt));
      n++;
    }
    plottableLots.forEach((lot) => {
      const poly = parsePolygonCoordinates(lot.polygonCoordinates);
      if (poly?.length) {
        poly.forEach((pt) => bounds.extend(pt));
        n++;
      } else if (lot.latitude != null && lot.longitude != null) {
        bounds.extend({ lat: lot.latitude, lng: lot.longitude });
        n++;
      }
    });
    if (n === 0) {
      map.setCenter(devCenter);
      map.setZoom(5);
      return;
    }
    map.fitBounds(bounds, 72);
  }, [development.latitude, development.longitude, devPolygonPath, plottableLots, devCenter]);

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      fitBounds();
    },
    [fitBounds],
  );

  const plotKey = useMemo(() => plottableLots.map((l) => l.id).join(','), [plottableLots]);

  useEffect(() => {
    fitBounds();
  }, [plotKey, development.latitude, development.longitude, devPolygonPath, fitBounds]);

  const activeLot = activeLotId ? lots.find((l) => l.id === activeLotId) : null;
  const unlocatedCount = filteredLots.length - plottableLots.length;

  if (!apiKey) {
    return (
      <Card className={cn('border-dashed border-amber-300 bg-amber-50/50 p-6', className)}>
        <p className="font-bold text-amber-900">Google Maps não configurado</p>
        <p className="mt-2 text-sm text-gray-700">
          Defina <code className="rounded bg-white px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> em{' '}
          <code className="rounded bg-white px-1">frontend/.env.local</code> e reinicie o servidor. Use uma chave
          restrita por referenciador HTTP (localhost e seu domínio de produção).
        </p>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="border-red-200 bg-red-50/60 p-6 text-sm text-red-900">
        Não foi possível carregar o Google Maps. Verifique a chave e as APIs habilitadas (Maps JavaScript API).
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className={cn(
          'flex min-h-[400px] items-center justify-center rounded-xl border border-surface-muted bg-surface/40',
          className,
        )}
      >
        <p className="text-sm font-medium text-gray-600">Carregando mapa…</p>
      </div>
    );
  }

  const shell = (
    <div
      className={cn(
        'flex flex-col gap-4 overflow-hidden rounded-xl border border-surface-muted bg-white shadow-sm',
        presentation && !compact && 'ring-2 ring-primary-400/40',
        fullscreen && 'fixed inset-0 z-[80] rounded-none border-0',
        className,
      )}
    >
      {compact ? (
        <div className="border-b border-surface-muted px-3 py-2">
          <p className="text-sm font-bold text-primary-950">Prévia no mapa</p>
          <p className="text-xs text-gray-600">{development.name}</p>
        </div>
      ) : (
        <div
          className={cn(
            'flex flex-col gap-3 border-b border-surface-muted bg-primary-50/40 px-4 py-3 lg:flex-row lg:items-center lg:justify-between',
            presentation && 'bg-gradient-to-r from-primary-900 to-primary-800 text-white',
          )}
        >
          <div>
            <p
              className={cn(
                'text-xs font-bold uppercase tracking-wide',
                presentation ? 'text-primary-100' : 'text-gray-500',
              )}
            >
              Localização comercial
            </p>
            <p className={cn('text-lg font-bold', presentation ? 'text-white' : 'text-primary-950')}>
              {development.name}
            </p>
            <p className={cn('text-sm', presentation ? 'text-primary-100' : 'text-gray-600')}>
              {[development.address, development.neighborhood, development.city, development.state]
                .filter(Boolean)
                .join(' · ') || development.city}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {development.latitude != null && development.longitude != null ? (
              <a
                href={googleDirectionsUrl(development.latitude, development.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariantsOutline(presentation),
                  'inline-flex items-center gap-1.5 text-sm font-bold',
                )}
              >
                <Navigation className="h-4 w-4" />
                Como chegar
              </a>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant={presentation ? 'secondary' : 'outline'}
              className="gap-1.5 font-bold"
              onClick={() => setPresentation((p) => !p)}
            >
              <Presentation className="h-4 w-4" />
              {presentation ? 'Modo edição' : 'Modo apresentação'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 font-bold"
              onClick={() => setFullscreen((f) => !f)}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {fullscreen ? 'Sair' : 'Tela cheia'}
            </Button>
          </div>
        </div>
      )}

      <div className={cn('grid gap-4 px-4 pb-4', !compact && 'lg:grid-cols-[1fr_220px]')}>
        <div
          className={cn(
            'relative w-full overflow-hidden rounded-lg border border-surface-muted',
            compact ? 'min-h-[280px]' : 'min-h-[400px]',
            presentation && !compact && 'min-h-[55vh]',
          )}
        >
          <GoogleMap
            mapContainerStyle={{
              width: '100%',
              height: '100%',
              minHeight: compact ? 280 : presentation ? '55vh' : 400,
            }}
            center={devCenter}
            zoom={development.latitude != null ? 16 : 5}
            onLoad={onMapLoad}
            options={{
              mapTypeControl: true,
              streetViewControl: !presentation,
              fullscreenControl: false,
              ...(mapIdOpt ? { mapId: mapIdOpt } : {}),
            }}
          >
            {development.latitude != null && development.longitude != null ? (
              <Marker
                position={{ lat: development.latitude, lng: development.longitude }}
                title={development.name}
                icon={typeof window !== 'undefined' && window.google?.maps ? { url: pinSvgDataUrl('#1d4ed8'), scaledSize: new google.maps.Size(40, 40) } : undefined}
                onClick={() => setActiveLotId(null)}
              />
            ) : null}

            {devPolygonPath && devPolygonPath.length >= 3 ? (
              <Polygon
                paths={devPolygonPath}
                options={{
                  fillColor: '#3b82f6',
                  fillOpacity: 0.12,
                  strokeColor: '#1d4ed8',
                  strokeWeight: 2,
                  clickable: false,
                }}
              />
            ) : null}

            {plottableLots.map((lot) => {
              const poly = parsePolygonCoordinates(lot.polygonCoordinates);
              const style = lotStatusMapStyle(lot.status);
              const champ = lot.isChampion ? championAccent() : null;
              const z = champ ? champ.zIndex : lot.isStalled ? 100 : 400;

              if (poly && poly.length >= 3) {
                return (
                  <Polygon
                    key={lot.id}
                    paths={toGooglePath(poly)}
                    options={{
                      fillColor: style.stroke,
                      fillOpacity: 0.28,
                      strokeColor: champ ? champ.extraStroke : style.stroke,
                      strokeWeight: champ ? 3 : style.strokeWeight,
                      zIndex: z,
                      clickable: true,
                    }}
                    onClick={() => setActiveLotId(lot.id)}
                  />
                );
              }
              if (lot.latitude != null && lot.longitude != null) {
                return (
                  <Marker
                    key={lot.id}
                    position={{ lat: lot.latitude, lng: lot.longitude }}
                    title={`Lote ${lot.number}`}
                    zIndex={z}
                    onClick={() => setActiveLotId(lot.id)}
                    icon={
                      typeof window !== 'undefined' && window.google?.maps
                        ? {
                            url: pinSvgDataUrl(lot.isChampion ? '#1e3a8a' : strokeToHex(style.stroke)),
                            scaledSize: new google.maps.Size(lot.isChampion ? 44 : 36, lot.isChampion ? 44 : 36),
                          }
                        : undefined
                    }
                  />
                );
              }
              return null;
            })}

            {activeLot ? (() => {
              const wPoly = parsePolygonCoordinates(activeLot.polygonCoordinates);
              const pos = wPoly?.length
                ? centroid(wPoly)
                : activeLot.latitude != null && activeLot.longitude != null
                  ? { lat: activeLot.latitude, lng: activeLot.longitude }
                  : null;
              if (!pos) return null;
              return (
                <InfoWindow position={pos} onCloseClick={() => setActiveLotId(null)}>
                  {infoWindowInner(activeLot, development.id, pos)}
                </InfoWindow>
              );
            })() : null}
          </GoogleMap>
        </div>

        {compact ? null : (
        <aside className="space-y-3 text-sm">
          <p className="font-bold text-primary-950">Filtros</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['DISPONIVEL', 'Disponível'],
                ['RESERVADO', 'Reservado'],
                ['VENDIDO', 'Vendido'],
                ['INDISPONIVEL', 'Indisponível'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={filters[key]}
                  onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                {label}
              </label>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={filters.championOnly}
              onChange={(e) => setFilters((f) => ({ ...f, championOnly: e.target.checked }))}
              className="rounded border-gray-300"
            />
            Só campeões de venda
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={filters.stalledOnly}
              onChange={(e) => setFilters((f) => ({ ...f, stalledOnly: e.target.checked }))}
              className="rounded border-gray-300"
            />
            Só encalhados / atenção
          </label>
          <div>
            <p className="mb-1 text-xs font-semibold text-gray-600">Quadra</p>
            <select
              value={filters.blockId}
              onChange={(e) => setFilters((f) => ({ ...f, blockId: e.target.value }))}
              className="w-full rounded-lg border px-2 py-1.5 text-xs"
            >
              <option value="">Todas</option>
              {[...new Map(lots.map((l) => [l.blockId, l.blockName])).entries()].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-gray-600">Preço mín.</p>
              <input
                type="number"
                placeholder="R$"
                value={filters.minPrice}
                onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
                className="w-full rounded-lg border px-2 py-1 text-xs"
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-gray-600">Preço máx.</p>
              <input
                type="number"
                placeholder="R$"
                value={filters.maxPrice}
                onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
                className="w-full rounded-lg border px-2 py-1 text-xs"
              />
            </div>
          </div>
          <div className="rounded-lg bg-surface/80 p-2 text-xs text-gray-600">
            <p className="font-semibold text-gray-800">Legenda</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>Verde: disponível · Âmbar: reservado · Vermelho: vendido</li>
              <li>Pin azul escuro: campeão de venda</li>
            </ul>
            {unlocatedCount > 0 ? (
              <p className="mt-2 text-amber-800">
                {unlocatedCount} lote(s) filtrado(s) sem coordenadas no cadastro — edite o lote para informar mapa.
              </p>
            ) : null}
          </div>
        </aside>
        )}
      </div>
    </div>
  );

  return shell;
}

function buttonVariantsOutline(presentation: boolean): string {
  return cn(
    'rounded-lg border-2 px-3 py-2 transition',
    presentation
      ? 'border-white/40 bg-white/10 text-white hover:bg-white/20'
      : 'border-primary-200 bg-white text-primary-900 hover:bg-primary-50',
  );
}

function strokeToHex(stroke: string): string {
  if (stroke.startsWith('#')) return stroke;
  return '#15803d';
}

function pinSvgDataUrl(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 36"><path fill="${color}" stroke="#fff" stroke-width="1" d="M12 0C7 0 3 4 3 9c0 7 9 15 9 15s9-8 9-15c0-5-4-9-9-9z"/><circle cx="12" cy="9" r="3" fill="#fff"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function centroid(pts: { lat: number; lng: number }[]): { lat: number; lng: number } {
  let lat = 0;
  let lng = 0;
  pts.forEach((p) => {
    lat += p.lat;
    lng += p.lng;
  });
  return { lat: lat / pts.length, lng: lng / pts.length };
}

function infoWindowInner(
  lot: GeoMapLot,
  developmentId: string,
  pos: { lat: number; lng: number },
) {
  return (
    <div className="max-w-[220px] p-1 text-gray-900">
      <p className="font-bold">Lote {lot.number}</p>
      <p className="text-xs text-gray-600">Quadra {lot.blockName}</p>
      <p className="text-sm font-semibold">{formatPrice(Number(lot.price ?? 0))}</p>
      {lot.area != null ? <p className="text-xs">{lot.area} m²</p> : null}
      <p className="text-xs uppercase text-gray-500">{lot.status}</p>
      {lot.saleScore != null ? (
        <p className="text-xs font-bold text-primary-800">Score {Math.round(lot.saleScore)}</p>
      ) : null}
      {lot.geoStatus === 'APROXIMADO' ? (
        <p className="mt-1 text-[10px] text-amber-700">Localização aproximada</p>
      ) : null}
      <div className="mt-2 flex flex-col gap-1">
        <Link
          href={`/lots/lots/edit/${lot.id}?development=${developmentId}&block=${lot.blockId}`}
          className="text-xs font-bold text-primary-700 underline"
        >
          Abrir cadastro do lote
        </Link>
        <a
          href={googleDirectionsUrl(pos.lat, pos.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-primary-700 underline"
        >
          Rota no Google Maps
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Olá! Segue o lote ${lot.number} da quadra ${lot.blockName}.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-success-700 underline"
        >
          WhatsApp (texto sugerido)
        </a>
      </div>
    </div>
  );
}
