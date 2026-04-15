'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MapView,
  Layer,
  Marker,
  NavigationControl,
  FullscreenControl,
  Popup,
  Source,
  type MapRef,
} from '@/components/maps/map-view';
import maplibregl from 'maplibre-gl';
import { ExternalLink, Layers, ListFilter, Maximize2, Minimize2, Navigation, Presentation } from 'lucide-react';
import type { FeatureCollection } from 'geojson';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getDefaultMapCenter, getMapStyleUrl } from '@/lib/maps/config';
import {
  googleDirectionsUrl,
  lotStatusMapStyle,
  championAccent,
} from '@/lib/maps/lot-map-styles';
import { parsePolygonCoordinates } from '@/lib/maps/polygon';
import {
  boundsFromFeatureCollection,
  boundsFromPoints,
  circleRingLatLng,
  emptyFeatureCollection,
  extendBoundsLngLat,
  polygonFeatureFromLatLng,
} from '@/lib/maps/geojson';
import {
  DEV_FALLBACK_RADIUS_APPROX_M,
  DEV_FALLBACK_RADIUS_EXACT_M,
} from '@/lib/maps/loteamento-map-constants';
import { cn, formatPrice } from '@/lib/utils';
import { lotStatusLabel } from '@/lib/lot-status';
import { LocationPrecisionBadge, type DevelopmentLocationPrecision } from '@/components/developments/location-precision-badge';
import { MapLegend } from '@/components/maps/map-legend';
import { LoteamentoAreaLayer } from '@/components/maps/loteamento-area-layer';
import { NearbyPlaceMarker } from '@/components/maps/nearby-place-marker';
import { NearbyPlacesPanel } from '@/components/maps/nearby-places-panel';
import { nearbyCategoryLabel } from '@/lib/maps/nearby-place-styles';

export type GeoMapDevelopment = {
  id: string;
  name: string;
  description?: string | null;
  city: string;
  state?: string | null;
  address?: string | null;
  referenceAddress?: string | null;
  neighborhood?: string | null;
  zipCode?: string | null;
  locationPrecision?: DevelopmentLocationPrecision | null;
  locationNotes?: string | null;
  geocodingStatus?: string | null;
  latitude: number | null;
  longitude: number | null;
  polygonCoordinates?: unknown;
};

export type GeoMapNearbyPlace = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  travelTimeMinutes: number | null;
  routeSource?: string | null;
  shortAddress?: string | null;
};

function developmentLocationLine(d: GeoMapDevelopment): string {
  const parts = [d.referenceAddress, d.address, d.neighborhood, d.city, d.state].filter(
    (x): x is string => typeof x === 'string' && x.trim().length > 0,
  );
  return parts.join(' · ');
}

function developmentPrecisionLabel(p: DevelopmentLocationPrecision): string {
  switch (p) {
    case 'EXATA':
      return 'Exata';
    case 'APROXIMADA':
      return 'Aproximada';
    default:
      return 'Pendente';
  }
}

function developmentPrecisionObservation(
  p: DevelopmentLocationPrecision,
  hasRealPolygon: boolean,
  isFallbackArea: boolean,
): string {
  if (p === 'EXATA') {
    if (hasRealPolygon) return 'Área delimitada com precisão';
    if (isFallbackArea) {
      return 'Área de referência ao redor do ponto — cadastre o polígono do perímetro no empreendimento';
    }
    return 'Área delimitada com precisão';
  }
  if (p === 'APROXIMADA') {
    return hasRealPolygon
      ? 'Área estimada com base na localização disponível'
      : 'Área estimada ao redor do ponto — confirme o perímetro no cadastro';
  }
  return 'Polígono exibido como referência cadastral — confirme a precisão no empreendimento';
}

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

function hasPlottablePosition(lot: GeoMapLot): boolean {
  const poly = parsePolygonCoordinates(lot.polygonCoordinates);
  if (poly && poly.length >= 3) return true;
  return lot.latitude != null && lot.longitude != null;
}

type FilterState = {
  DISPONIVEL: boolean;
  RESERVADO: boolean;
  EM_NEGOCIACAO: boolean;
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
  EM_NEGOCIACAO: true,
  VENDIDO: true,
  INDISPONIVEL: true,
  championOnly: false,
  stalledOnly: false,
  blockId: '',
  minPrice: '',
  maxPrice: '',
};

function strokeToHex(stroke: string): string {
  if (stroke.startsWith('#')) return stroke.slice(0, 7);
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

function buttonVariantsOutline(presentation: boolean): string {
  return cn(
    'rounded-lg border-2 px-3 py-2 transition',
    presentation
      ? 'border-white/40 bg-white/10 text-white hover:bg-white/20'
      : 'border-primary-200 bg-white text-primary-900 hover:bg-primary-50',
  );
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
      <p className="text-xs font-semibold text-gray-600">{lotStatusLabel(lot.status)}</p>
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
          Como chegar (mapa externo)
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

export function DevelopmentLotsMap({
  development,
  lots,
  nearbyPlaces = [],
  nearbyTravelMode: nearbyTravelModeProp,
  onNearbyTravelModeChange,
  onRefreshNearby,
  nearbyRefreshing,
  highlightLotId,
  initialPresentation = false,
  compact = false,
  /** Área do mapa maior (ex.: aba quadra com “Mapa real” em destaque). */
  tallViewport = false,
  /** Preenche altura do pai (flex); use com wrapper `flex-1 min-h-0` na página. */
  tallViewportFill = false,
  className,
}: {
  development: GeoMapDevelopment;
  lots: GeoMapLot[];
  nearbyPlaces?: GeoMapNearbyPlace[];
  nearbyTravelMode?: 'driving' | 'walking';
  onNearbyTravelModeChange?: (mode: 'driving' | 'walking') => void;
  onRefreshNearby?: () => void | Promise<void>;
  nearbyRefreshing?: boolean;
  highlightLotId?: string | null;
  initialPresentation?: boolean;
  compact?: boolean;
  tallViewport?: boolean;
  tallViewportFill?: boolean;
  className?: string;
}) {
  const mapStyleUrl = getMapStyleUrl();
  const [presentation, setPresentation] = useState(initialPresentation);
  const [fullscreen, setFullscreen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [activeLotId, setActiveLotId] = useState<string | null>(highlightLotId ?? null);
  const [activeNearbyId, setActiveNearbyId] = useState<string | null>(null);
  const [showDevPopup, setShowDevPopup] = useState(false);
  const [blockedNearbyCats, setBlockedNearbyCats] = useState<Set<string>>(new Set());
  const [travelMode, setTravelMode] = useState<'driving' | 'walking'>(nearbyTravelModeProp ?? 'driving');
  const [mapError, setMapError] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (nearbyTravelModeProp) setTravelMode(nearbyTravelModeProp);
  }, [nearbyTravelModeProp]);

  const setMode = (m: 'driving' | 'walking') => {
    setTravelMode(m);
    onNearbyTravelModeChange?.(m);
  };

  const toggleNearbyCategory = (category: string, visible: boolean) => {
    setBlockedNearbyCats((prev) => {
      const n = new Set(prev);
      if (visible) n.delete(category);
      else n.add(category);
      return n;
    });
  };

  const visibleNearby = useMemo(
    () => nearbyPlaces.filter((p) => !blockedNearbyCats.has(p.category)),
    [nearbyPlaces, blockedNearbyCats],
  );

  useEffect(() => {
    if (highlightLotId) setActiveLotId(highlightLotId);
  }, [highlightLotId]);

  const filteredLots = useMemo(() => {
    return lots.filter((l) => {
      if (l.status === 'DISPONIVEL' && !filters.DISPONIVEL) return false;
      if (l.status === 'RESERVADO' && !filters.RESERVADO) return false;
      if (l.status === 'EM_NEGOCIACAO' && !filters.EM_NEGOCIACAO) return false;
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

  const locationPrecision: DevelopmentLocationPrecision = development.locationPrecision ?? 'PENDENTE';

  const hasRealDevPolygon =
    (parsePolygonCoordinates(development.polygonCoordinates)?.length ?? 0) >= 3;

  const devAreaFc = useMemo((): FeatureCollection => {
    const poly = parsePolygonCoordinates(development.polygonCoordinates);
    const areaStyle: 'EXATA' | 'APROXIMADA' | 'PENDENTE' =
      locationPrecision === 'EXATA'
        ? 'EXATA'
        : locationPrecision === 'APROXIMADA'
          ? 'APROXIMADA'
          : 'PENDENTE';

    if (poly && poly.length >= 3) {
      const f = polygonFeatureFromLatLng(poly, {
        kind: 'development',
        areaStyle,
        isFallback: 0,
      });
      return f ? { type: 'FeatureCollection', features: [f] } : emptyFeatureCollection();
    }

    if (locationPrecision === 'PENDENTE') {
      return emptyFeatureCollection();
    }

    if (development.latitude == null || development.longitude == null) {
      return emptyFeatureCollection();
    }

    const radius =
      locationPrecision === 'EXATA' ? DEV_FALLBACK_RADIUS_EXACT_M : DEV_FALLBACK_RADIUS_APPROX_M;
    const ring = circleRingLatLng(development.latitude, development.longitude, radius);
    const f = polygonFeatureFromLatLng(ring, {
      kind: 'development',
      areaStyle,
      isFallback: 1,
    });
    return f ? { type: 'FeatureCollection', features: [f] } : emptyFeatureCollection();
  }, [
    development.polygonCoordinates,
    development.latitude,
    development.longitude,
    locationPrecision,
  ]);

  const hasDevArea = devAreaFc.features.length > 0;
  const hasFallbackDevArea = hasDevArea && !hasRealDevPolygon;

  const devPinPosition = useMemo(() => {
    if (development.latitude != null && development.longitude != null) {
      return { lat: development.latitude, lng: development.longitude };
    }
    const poly = parsePolygonCoordinates(development.polygonCoordinates);
    if (poly && poly.length >= 3) return centroid(poly);
    return null;
  }, [development.latitude, development.longitude, development.polygonCoordinates]);

  const devPopupPos = useMemo(() => {
    const box = boundsFromFeatureCollection(devAreaFc);
    if (box) {
      return { lat: (box.minLat + box.maxLat) / 2, lng: (box.minLng + box.maxLng) / 2 };
    }
    return devPinPosition;
  }, [devAreaFc, devPinPosition]);

  const devCenterForView = useMemo(() => {
    if (hasDevArea) {
      const box = boundsFromFeatureCollection(devAreaFc);
      if (box) {
        return { lat: (box.minLat + box.maxLat) / 2, lng: (box.minLng + box.maxLng) / 2 };
      }
    }
    return devPinPosition ?? getDefaultMapCenter();
  }, [devAreaFc, devPinPosition, hasDevArea]);

  const hideMapForPending =
    locationPrecision === 'PENDENTE' && !hasDevArea && plottableLots.length === 0;

  const { polygonFc, pointLots } = useMemo(() => {
    const polyFeatures: NonNullable<ReturnType<typeof polygonFeatureFromLatLng>>[] = [];
    const points: GeoMapLot[] = [];
    const polyLots = plottableLots.filter((l) => {
      const poly = parsePolygonCoordinates(l.polygonCoordinates);
      return poly && poly.length >= 3;
    });
    const markerLots = plottableLots.filter((l) => {
      const poly = parsePolygonCoordinates(l.polygonCoordinates);
      return !(poly && poly.length >= 3);
    });
    const sorted = [...polyLots].sort((a, b) => {
      if (a.isChampion === b.isChampion) return 0;
      return a.isChampion ? 1 : -1;
    });
    for (const lot of sorted) {
      const poly = parsePolygonCoordinates(lot.polygonCoordinates);
      if (!poly) continue;
      const style = lotStatusMapStyle(lot.status);
      const stroke = lot.isChampion ? championAccent().extraStroke : strokeToHex(style.stroke);
      const f = polygonFeatureFromLatLng(poly, {
        lotId: lot.id,
        champion: lot.isChampion ? 1 : 0,
        stalled: lot.isStalled ? 1 : 0,
        fillColor: strokeToHex(style.stroke),
        fillOpacity: lot.isChampion ? 0.38 : 0.28,
      });
      if (f) polyFeatures.push(f);
    }
    for (const lot of markerLots) {
      if (lot.latitude != null && lot.longitude != null) points.push(lot);
    }
    points.sort((a, b) => (a.isChampion === b.isChampion ? 0 : a.isChampion ? 1 : -1));
    return {
      polygonFc: { type: 'FeatureCollection', features: polyFeatures } as FeatureCollection,
      pointLots: points,
    };
  }, [plottableLots]);

  const fitBounds = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    let b: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null = null;
    const devBox = boundsFromFeatureCollection(devAreaFc);
    if (devBox) {
      b = extendBoundsLngLat(b, devBox.minLng, devBox.minLat);
      b = extendBoundsLngLat(b, devBox.maxLng, devBox.maxLat);
    } else if (development.latitude != null && development.longitude != null) {
      b = extendBoundsLngLat(b, development.longitude, development.latitude);
    }
    plottableLots.forEach((lot) => {
      const poly = parsePolygonCoordinates(lot.polygonCoordinates);
      if (poly?.length) {
        const pb = boundsFromPoints(poly);
        if (pb) {
          b = extendBoundsLngLat(b, pb.minLng, pb.minLat);
          b = extendBoundsLngLat(b, pb.maxLng, pb.maxLat);
        }
      } else if (lot.latitude != null && lot.longitude != null) {
        b = extendBoundsLngLat(b, lot.longitude, lot.latitude);
      }
    });
    visibleNearby.forEach((p) => {
      b = extendBoundsLngLat(b, p.longitude, p.latitude);
    });
    if (!b) {
      map.jumpTo({
        center: [devCenterForView.lng, devCenterForView.lat],
        zoom: hasDevArea || devPinPosition ? 15 : 5,
      });
      return;
    }
    map.fitBounds(
      [
        [b.minLng, b.minLat],
        [b.maxLng, b.maxLat],
      ],
      { padding: 72, maxZoom: 17, duration: 0 },
    );
  }, [
    development.latitude,
    development.longitude,
    devAreaFc,
    hasDevArea,
    plottableLots,
    devCenterForView.lat,
    devCenterForView.lng,
    devPinPosition,
    visibleNearby,
  ]);

  const plotKey = useMemo(
    () =>
      `${plottableLots.map((l) => l.id).join(',')}|${visibleNearby.map((p) => p.id).join(',')}|d${devAreaFc.features.length}`,
    [plottableLots, visibleNearby, devAreaFc.features.length],
  );

  useEffect(() => {
    const t = requestAnimationFrame(() => fitBounds());
    return () => cancelAnimationFrame(t);
  }, [plotKey, development.latitude, development.longitude, fitBounds]);

  const activeLot = activeLotId ? lots.find((l) => l.id === activeLotId) : null;
  const unlocatedCount = filteredLots.length - plottableLots.length;

  const devPopupObservation = useMemo(
    () =>
      developmentPrecisionObservation(locationPrecision, hasRealDevPolygon, hasFallbackDevArea),
    [locationPrecision, hasRealDevPolygon, hasFallbackDevArea],
  );

  const popupPos = useMemo(() => {
    if (!activeLot) return null;
    const wPoly = parsePolygonCoordinates(activeLot.polygonCoordinates);
    if (wPoly?.length) return centroid(wPoly);
    if (activeLot.latitude != null && activeLot.longitude != null) {
      return { lat: activeLot.latitude, lng: activeLot.longitude };
    }
    return null;
  }, [activeLot]);

  const onMapClick = useCallback((e: { features?: Array<{ layer?: { id?: string }; properties?: Record<string, unknown> }> }) => {
    const devHit = e.features?.find((x) => {
      const id = x.layer?.id;
      return id === 'dev-fill' || id === 'dev-outline';
    });
    if (devHit) {
      setActiveLotId(null);
      setActiveNearbyId(null);
      setShowDevPopup(true);
      return;
    }
    const f = e.features?.find((x) => {
      const id = x.layer?.id;
      return id === 'lots-fill' || id === 'lots-outline';
    });
    const id = f?.properties?.lotId;
    if (id != null) {
      setShowDevPopup(false);
      setActiveLotId(String(id));
    } else {
      setActiveLotId(null);
      setShowDevPopup(false);
    }
  }, []);

  const interactiveLayerIds: string[] = [
    ...(polygonFc.features.length ? ['lots-fill', 'lots-outline'] : []),
    ...(hasDevArea ? ['dev-fill', 'dev-outline'] : []),
  ];

  const showNearbyPanel =
    !compact &&
    (onRefreshNearby != null ||
      nearbyPlaces.length > 0 ||
      hasDevArea ||
      devPinPosition != null ||
      plottableLots.length > 0);

  if (mapError) {
    return (
      <Card className="border-red-200 bg-red-50/60 p-6 text-sm text-red-900">
        <p className="font-bold">Erro ao carregar o mapa</p>
        <p className="mt-2">{mapError}</p>
        <p className="mt-2 text-xs text-red-800">
          Verifique <code className="rounded bg-white px-1">NEXT_PUBLIC_MAP_STYLE_URL</code> ou a rede. Estilo padrão:
          CARTO Positron.
        </p>
      </Card>
    );
  }

  const mapFill =
    tallViewportFill && tallViewport && !compact && !presentation;

  const shell = (
    <div
      className={cn(
        'flex flex-col gap-4 overflow-hidden rounded-xl border border-surface-muted bg-white shadow-sm',
        mapFill && 'min-h-0 flex-1',
        presentation && !compact && 'ring-2 ring-primary-400/40',
        fullscreen && 'fixed inset-0 z-[80] rounded-none border-0',
        className,
      )}
    >
      {compact ? (
        <div className="border-b border-surface-muted px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-primary-950">Prévia no mapa</p>
            <LocationPrecisionBadge precision={locationPrecision} />
          </div>
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
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <p
                className={cn(
                  'text-xs font-bold uppercase tracking-wide',
                  presentation ? 'text-primary-100' : 'text-gray-500',
                )}
              >
                Localização comercial
              </p>
              <LocationPrecisionBadge
                precision={locationPrecision}
                className={presentation ? 'border-white/30 bg-white/15 text-white' : undefined}
              />
            </div>
            <p className={cn('text-lg font-bold', presentation ? 'text-white' : 'text-primary-950')}>
              {development.name}
            </p>
            <p className={cn('text-sm', presentation ? 'text-primary-100' : 'text-gray-600')}>
              {developmentLocationLine(development) || development.city}
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

      <div
        className={cn(
          'grid gap-4 px-4 pb-4',
          !compact && 'lg:grid-cols-[1fr_220px]',
          mapFill && 'min-h-0 flex-1 lg:grid-rows-[minmax(0,1fr)]',
        )}
      >
        <div
          className={cn(
            'relative w-full overflow-hidden rounded-lg border border-surface-muted',
            compact
              ? 'h-[280px]'
              : presentation && !compact
                ? 'min-h-[55vh] h-[min(55vh,560px)]'
                : mapFill
                  ? 'h-full min-h-[min(48vh,400px)]'
                  : tallViewport
                    ? 'min-h-[min(62vh,600px)] h-[min(62vh,600px)]'
                    : 'h-[400px]',
          )}
        >
          {hideMapForPending ? (
            <div className="flex h-full flex-col justify-center gap-3 bg-slate-50/90 p-6 text-center">
              <LocationPrecisionBadge precision="PENDENTE" className="mx-auto" />
              <p className="text-sm font-semibold text-slate-800">Localização detalhada ainda não cadastrada</p>
              {development.locationNotes ? (
                <p className="text-xs text-slate-600">{development.locationNotes}</p>
              ) : null}
              {development.referenceAddress ? (
                <p className="text-xs text-slate-700">
                  <span className="font-semibold">Referência: </span>
                  {development.referenceAddress}
                </p>
              ) : null}
              <p className="text-[11px] text-slate-500">
                Cadastre latitude/longitude e a precisão no empreendimento, desenhe o polígono do loteamento ou
                georreferencie os lotes para o mapa MapLibre aparecer aqui.
              </p>
            </div>
          ) : (
            <>
              {hasFallbackDevArea ? (
                <div
                  className={cn(
                    'absolute left-2 right-2 top-2 z-10 rounded-lg border px-3 py-2 text-center text-[11px] font-medium shadow-sm backdrop-blur-sm',
                    locationPrecision === 'EXATA'
                      ? 'border-emerald-200/90 bg-emerald-50/95 text-emerald-950'
                      : 'border-amber-200/90 bg-amber-50/95 text-amber-950',
                  )}
                >
                  {locationPrecision === 'EXATA' ? (
                    <>
                      Área de referência (~{DEV_FALLBACK_RADIUS_EXACT_M} m) ao redor do ponto. Cadastre{' '}
                      <strong>polygon_coordinates</strong> no loteamento para exibir o perímetro exato.
                    </>
                  ) : (
                    <>
                      Localização aproximada: área estimada (~{DEV_FALLBACK_RADIUS_APPROX_M} m). Cadastre o polígono
                      para reduzir a incerteza visual.
                    </>
                  )}
                </div>
              ) : null}
              {hasRealDevPolygon && locationPrecision === 'APROXIMADA' ? (
                <div className="absolute left-2 right-2 top-2 z-10 rounded-lg border border-amber-200/90 bg-amber-50/95 px-3 py-2 text-center text-[11px] font-medium text-amber-950 shadow-sm backdrop-blur-sm">
                  Perímetro cadastrado como <strong>localização aproximada</strong> — confira a precisão no cadastro do
                  empreendimento.
                </div>
              ) : null}
              {hasRealDevPolygon && locationPrecision === 'PENDENTE' ? (
                <div className="absolute left-2 right-2 top-2 z-10 rounded-lg border border-slate-200/90 bg-slate-50/95 px-3 py-2 text-center text-[11px] font-medium text-slate-800 shadow-sm backdrop-blur-sm">
                  Polígono cadastrado, porém a precisão do loteamento ainda está como <strong>PENDENTE</strong> — atualize
                  no empreendimento quando confirmar a localização.
                </div>
              ) : null}
              <MapView
                ref={mapRef}
                mapLib={maplibregl}
                initialViewState={{
                  longitude: devCenterForView.lng,
                  latitude: devCenterForView.lat,
                  zoom: hasDevArea || devPinPosition ? 15 : 5,
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle={mapStyleUrl}
                interactiveLayerIds={interactiveLayerIds}
                onClick={onMapClick}
                onLoad={(e) => {
                  setMapError(null);
                  e.target.on('error', (err) => {
                    setMapError(err.error?.message || 'Falha ao carregar tiles ou estilo do mapa.');
                  });
                  requestAnimationFrame(() => fitBounds());
                }}
              >
              <NavigationControl position="top-left" showCompass={!presentation} />
              <FullscreenControl position="top-left" />

              {hasDevArea ? (
                <LoteamentoAreaLayer data={devAreaFc} highlighted={showDevPopup} />
              ) : null}

              {polygonFc.features.length > 0 ? (
                <Source id="lots-polygons" type="geojson" data={polygonFc} promoteId="lotId">
                  <Layer
                    id="lots-fill"
                    type="fill"
                    paint={{
                      'fill-color': ['get', 'fillColor'],
                      'fill-opacity': ['get', 'fillOpacity'],
                    }}
                  />
                  <Layer
                    id="lots-outline"
                    type="line"
                    paint={{
                      'line-color': '#15803d',
                      'line-width': [
                        'case',
                        ['==', ['get', 'champion'], 1],
                        3,
                        ['==', ['get', 'stalled'], 1],
                        2.5,
                        2,
                      ],
                      'line-dasharray': [2, 2],
                    }}
                  />
                </Source>
              ) : null}

              {devPopupPos ? (
                <Marker
                  longitude={devPopupPos.lng}
                  latitude={devPopupPos.lat}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setActiveLotId(null);
                    setActiveNearbyId(null);
                    setShowDevPopup((s) => !s);
                  }}
                >
                  <img
                    src={pinSvgDataUrl(
                      locationPrecision === 'EXATA'
                        ? '#166534'
                        : locationPrecision === 'APROXIMADA'
                          ? '#ea580c'
                          : '#64748b',
                    )}
                    width={46}
                    height={46}
                    alt=""
                    className="drop-shadow-md"
                    title={development.name}
                  />
                </Marker>
              ) : null}

              {showDevPopup && devPopupPos ? (
                <Popup
                  longitude={devPopupPos.lng}
                  latitude={devPopupPos.lat}
                  anchor="bottom"
                  onClose={() => setShowDevPopup(false)}
                  closeButton
                  closeOnClick={false}
                  maxWidth="300px"
                >
                  <div className="max-w-[280px] space-y-2 p-1 text-gray-900">
                    <div>
                      <p className="font-bold text-emerald-950">{development.name}</p>
                      <p className="mt-0.5 text-xs text-gray-600">{developmentLocationLine(development)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <LocationPrecisionBadge precision={locationPrecision} />
                      <span className="text-[10px] font-semibold text-gray-600">
                        Tipo: {developmentPrecisionLabel(locationPrecision)}
                      </span>
                    </div>
                    {locationPrecision === 'APROXIMADA' ? (
                      <p className="rounded-md border border-amber-200 bg-amber-50/90 px-2 py-1 text-[10px] font-medium text-amber-950">
                        Localização aproximada — use o perímetro e o endereço como referência, não como medida
                        certificada.
                      </p>
                    ) : null}
                    <p className="text-[11px] leading-snug text-gray-700">{devPopupObservation}</p>
                    {development.locationNotes ? (
                      <p className="text-[10px] text-gray-500">{development.locationNotes}</p>
                    ) : null}
                    {development.description ? (
                      <p className="text-xs text-gray-700">{development.description}</p>
                    ) : null}
                    <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-2">
                      <Link
                        href={`/developments/edit/${development.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir cadastro do loteamento
                      </Link>
                      <Link
                        href={`/lots?development=${development.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 underline"
                      >
                        <ListFilter className="h-3.5 w-3.5" />
                        Filtrar / ver lotes deste loteamento
                      </Link>
                      {!compact && showNearbyPanel ? (
                        <a
                          href="#nearby-places-panel"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 underline"
                          onClick={() => setShowDevPopup(false)}
                        >
                          <Layers className="h-3.5 w-3.5" />
                          Ver serviços próximos (painel ao lado)
                        </a>
                      ) : null}
                      {devPopupPos ? (
                        <a
                          href={googleDirectionsUrl(devPopupPos.lat, devPopupPos.lng)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 underline"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          Como chegar (mapa externo)
                        </a>
                      ) : null}
                    </div>
                  </div>
                </Popup>
              ) : null}

              {visibleNearby.map((p) => (
                <NearbyPlaceMarker
                  key={p.id}
                  latitude={p.latitude}
                  longitude={p.longitude}
                  category={p.category}
                  onClick={() => {
                    setActiveLotId(null);
                    setShowDevPopup(false);
                    setActiveNearbyId((id) => (id === p.id ? null : p.id));
                  }}
                />
              ))}

              {activeNearbyId
                ? (() => {
                    const p = visibleNearby.find((x) => x.id === activeNearbyId);
                    if (!p) return null;
                    return (
                      <Popup
                        longitude={p.longitude}
                        latitude={p.latitude}
                        anchor="bottom"
                        onClose={() => setActiveNearbyId(null)}
                        closeButton
                        closeOnClick={false}
                        maxWidth="240px"
                      >
                        <div className="p-1 text-xs text-gray-900">
                          <p className="font-bold">{p.name}</p>
                          <p className="text-gray-600">{nearbyCategoryLabel(p.category)}</p>
                          {p.travelTimeMinutes != null ? (
                            <p className="mt-1 font-semibold text-emerald-800">
                              ~{p.travelTimeMinutes} min ({travelMode === 'driving' ? 'carro' : 'a pé'})
                            </p>
                          ) : null}
                          {p.routeSource === 'haversine_speed_estimate' ? (
                            <p className="mt-1 text-[10px] text-amber-700">Estimativa por distância</p>
                          ) : null}
                        </div>
                      </Popup>
                    );
                  })()
                : null}

              {pointLots.map((lot) => {
                const style = lotStatusMapStyle(lot.status);
                const color = lot.isChampion ? '#1e3a8a' : strokeToHex(style.stroke);
                return (
                  <Marker
                    key={lot.id}
                    longitude={lot.longitude!}
                    latitude={lot.latitude!}
                    anchor="bottom"
                    onClick={(e) => {
                      e.originalEvent.stopPropagation();
                      setShowDevPopup(false);
                      setActiveLotId(lot.id);
                    }}
                  >
                    <img
                      src={pinSvgDataUrl(color)}
                      width={lot.isChampion ? 44 : 36}
                      height={lot.isChampion ? 44 : 36}
                      alt=""
                      className="drop-shadow-md"
                    />
                  </Marker>
                );
              })}

              {activeLot && popupPos ? (
                <Popup
                  longitude={popupPos.lng}
                  latitude={popupPos.lat}
                  anchor="bottom"
                  onClose={() => setActiveLotId(null)}
                  closeButton
                  closeOnClick={false}
                  maxWidth="240px"
                >
                  {infoWindowInner(activeLot, development.id, popupPos)}
                </Popup>
              ) : null}
              </MapView>
              <div className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-[220px]">
                <MapLegend compact={compact} className="pointer-events-auto" />
              </div>
              {!compact && hasDevArea ? (
                <p className="pointer-events-none absolute bottom-2 right-2 z-10 max-w-[140px] rounded-md border border-white/80 bg-white/90 px-2 py-1 text-center text-[9px] font-medium text-gray-700 shadow-sm backdrop-blur-sm">
                  Toque na área do loteamento para ver o popup
                </p>
              ) : null}
            </>
          )}
        </div>

        {compact ? null : (
          <aside className="space-y-3 text-sm">
            {showNearbyPanel ? (
              <NearbyPlacesPanel
                id="nearby-places-panel"
                places={nearbyPlaces}
                travelMode={travelMode}
                onTravelModeChange={setMode}
                onRefresh={onRefreshNearby}
                refreshing={nearbyRefreshing}
                blockedCategories={blockedNearbyCats}
                onToggleCategory={toggleNearbyCategory}
              />
            ) : null}
            <p className="font-bold text-primary-950">Filtros</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['DISPONIVEL', 'Disponível'],
                  ['RESERVADO', 'Reservado'],
                  ['EM_NEGOCIACAO', 'Em negociação'],
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
                {Array.from(new Map(lots.map((l) => [l.blockId, l.blockName])).entries()).map(([id, name]) => (
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
              <p className="font-semibold text-gray-800">Lotes no mapa</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                <li>Verde: disponível · Âmbar: reservado · Vermelho: vendido</li>
                <li>Pin azul escuro: campeão de venda</li>
                <li>Área verde sólida: loteamento com localização exata</li>
                <li>Área laranja tracejada: loteamento aproximado</li>
                <li>Área cinza: polígono com precisão ainda pendente</li>
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
