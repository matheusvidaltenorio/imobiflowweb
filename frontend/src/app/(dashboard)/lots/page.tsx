'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Grid3X3,
  Layers,
  LayoutGrid,
  List,
  Calendar,
  HeartHandshake,
  Loader2,
  Map as MapIcon,
  MapPinned,
  MessageCircle,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice, cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toaster';
import { PageHeader } from '@/components/dashboard/page-header';
import { EmptyState } from '@/components/dashboard/empty-state';
import { LotStatusBadge } from '@/components/dashboard/lot-status-badge';
import { LotPaymentSimulator } from '@/components/lotes/lot-payment-simulator';
import { DevelopmentLotsMap } from '@/components/maps/development-lots-map';
import { LotMapDialog } from '@/components/maps/lot-map-dialog';
import type { GeoMapDevelopment, GeoMapLot, GeoMapNearbyPlace } from '@/components/maps/development-lots-map';
import { LotInterestModal } from '@/components/lotes/lot-interest-modal';

type MapLotRow = GeoMapLot & {
  isOpportunity: boolean;
  isNew: boolean;
  popular: boolean;
  priorityScore: number;
  saleScoreReason?: string | null;
  contactCount?: number;
  commercialTags?: string[];
};

type MapPayload = {
  development: GeoMapDevelopment & { coverImage?: string | null };
  nearbyPlaces?: GeoMapNearbyPlace[];
  nearbyQuery?: { radiusMeters: number; travelMode: string };
  medianPrice: number | null;
  lots: MapLotRow[];
};

function mapCellClass(status: string) {
  switch (status) {
    case 'DISPONIVEL':
      return 'border-success-500/80 bg-success-50/90 text-success-950';
    case 'RESERVADO':
      return 'border-warning-500/80 bg-warning-50/90 text-warning-950';
    case 'EM_NEGOCIACAO':
      return 'border-sky-500/80 bg-sky-50/90 text-sky-950';
    case 'VENDIDO':
      return 'border-danger-500/80 bg-danger-50/90 text-danger-950';
    default:
      return 'border-gray-300 bg-gray-50 text-gray-800';
  }
}

function lotCardBorder(status: string) {
  switch (status) {
    case 'DISPONIVEL':
      return 'border-l-success-500';
    case 'RESERVADO':
      return 'border-l-warning-500';
    case 'EM_NEGOCIACAO':
      return 'border-l-sky-500';
    case 'VENDIDO':
      return 'border-l-danger-500';
    default:
      return 'border-l-gray-400';
  }
}

const DEFAULT_STATUS_FILTERS = [
  'DISPONIVEL',
  'RESERVADO',
  'EM_NEGOCIACAO',
  'VENDIDO',
  'INDISPONIVEL',
] as const;

export default function LotsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const developmentId = searchParams.get('development');
  const blockId = searchParams.get('block');
  const focusMap = searchParams.get('focusMap') === '1';
  const developmentMapSectionRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'map'>('list');
  const [mapDialogLotId, setMapDialogLotId] = useState<string | null>(null);
  const [nearbyTravelMode, setNearbyTravelMode] = useState<'driving' | 'walking'>('driving');
  const [filterStatus, setFilterStatus] = useState<string[]>([...DEFAULT_STATUS_FILTERS]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [interestLot, setInterestLot] = useState<{ id: string; label: string } | null>(null);

  const { data: development } = useQuery({
    queryKey: ['development', developmentId],
    queryFn: async () => {
      const { data } = await api.get<{ id: string; name: string; city: string }>(
        `/developments/${developmentId}`,
      );
      return data;
    },
    enabled: !!developmentId,
  });

  const { data: block } = useQuery({
    queryKey: ['block', blockId],
    queryFn: async () => {
      const { data } = await api.get<{ id: string; name: string }>(`/blocks/${blockId}`);
      return data;
    },
    enabled: !!blockId,
  });

  const { data: blocks, isLoading: blocksLoading } = useQuery({
    queryKey: ['blocks', developmentId],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; _count?: { lots: number } }>>(
        `/blocks/development/${developmentId}`,
      );
      return data;
    },
    enabled: !!developmentId,
  });

  const { data: lots, isLoading: lotsLoading } = useQuery({
    queryKey: ['lots', blockId],
    queryFn: async () => {
      const { data } = await api.get<
        Array<{
          id: string;
          number: string;
          area?: number;
          price?: number;
          status: string;
          saleScore?: number | null;
          saleClassification?: string | null;
          manualHighlight?: boolean;
        }>
      >(`/lots/block/${blockId}`);
      return data;
    },
    enabled: !!blockId,
  });

  const { data: mapData, isLoading: mapLoading } = useQuery({
    queryKey: ['lot-map', developmentId, nearbyTravelMode],
    queryFn: async () => {
      const { data } = await api.get<MapPayload>(
        `/lots/development/${developmentId}/map?nearbyRadius=3000&nearbyMode=${nearbyTravelMode}`,
      );
      return data;
    },
    enabled: !!developmentId,
  });

  useEffect(() => {
    if (!focusMap || !developmentId || blockId || mapLoading || !mapData) return;
    const t = window.setTimeout(() => {
      developmentMapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
    return () => window.clearTimeout(t);
  }, [focusMap, developmentId, blockId, mapLoading, mapData]);

  const mapLotsForBlock = (mapData?.lots ?? []).filter((l) => l.blockId === blockId);
  const mapLotsForView = blockId ? mapLotsForBlock : mapData?.lots ?? [];

  const filteredLots = useMemo(() => {
    return (lots ?? []).filter((l) => {
      if (!filterStatus.includes(l.status)) return false;
      const p = Number(l.price ?? 0);
      const min = priceMin.trim() !== '' ? Number(priceMin) : NaN;
      const max = priceMax.trim() !== '' ? Number(priceMax) : NaN;
      if (Number.isFinite(min) && p < min) return false;
      if (Number.isFinite(max) && p > max) return false;
      return true;
    });
  }, [lots, filterStatus, priceMin, priceMax]);

  const filteredMapLotsForBlock = useMemo(() => {
    return mapLotsForBlock.filter((l) => {
      if (!filterStatus.includes(l.status)) return false;
      const p = Number(l.price ?? 0);
      const min = priceMin.trim() !== '' ? Number(priceMin) : NaN;
      const max = priceMax.trim() !== '' ? Number(priceMax) : NaN;
      if (Number.isFinite(min) && p < min) return false;
      if (Number.isFinite(max) && p > max) return false;
      return true;
    });
  }, [mapLotsForBlock, filterStatus, priceMin, priceMax]);

  const lotStats = useMemo(() => {
    const list = lots ?? [];
    return {
      total: list.length,
      disponivel: list.filter((x) => x.status === 'DISPONIVEL').length,
      reservado: list.filter((x) => x.status === 'RESERVADO').length,
      negociacao: list.filter((x) => x.status === 'EM_NEGOCIACAO').length,
      vendido: list.filter((x) => x.status === 'VENDIDO').length,
    };
  }, [lots]);

  const toggleStatusFilter = (st: string) => {
    setFilterStatus((prev) =>
      prev.includes(st) ? prev.filter((x) => x !== st) : [...prev, st],
    );
  };

  const deleteBlock = useMutation({
    mutationFn: (id: string) => api.delete(`/blocks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', developmentId] });
      toast({ title: 'Quadra removida', type: 'success' });
    },
  });

  const deleteLot = useMutation({
    mutationFn: (id: string) => api.delete(`/lots/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lots', blockId] });
      queryClient.invalidateQueries({ queryKey: ['lot-map', developmentId] });
      toast({ title: 'Lote removido', type: 'success' });
    },
  });

  const updateLotStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/lots/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lots', blockId] });
      queryClient.invalidateQueries({ queryKey: ['lot-map', developmentId] });
      toast({ title: 'Status do lote atualizado', type: 'success' });
    },
    onError: () => {
      toast({ title: 'Não foi possível atualizar o status', type: 'error' });
    },
  });

  const breadcrumbs =
    developmentId && development
      ? blockId && block
        ? [
            { label: 'Loteamentos', href: '/developments' },
            { label: development.name, href: `/lots?development=${developmentId}` },
            { label: block.name },
          ]
        : [
            { label: 'Loteamentos', href: '/developments' },
            { label: development.name },
          ]
      : [{ label: 'Loteamentos', href: '/developments' }];

  const title = !developmentId
    ? 'Quadras e lotes'
    : !blockId
      ? 'Quadras'
      : (block?.name ?? 'Quadra');

  const description = !developmentId
    ? 'Escolha um loteamento para gerenciar quadras e lotes, alterar status e preços com poucos cliques.'
    : !blockId
      ? `Selecione uma quadra em ${development?.name ?? '…'} para ver e editar os lotes.`
      : lotsLoading
        ? `Empreendimento ${development?.name ?? '…'} — carregando lotes…`
        : `Empreendimento ${development?.name ?? '…'} · ${lotStats.total} ${lotStats.total === 1 ? 'lote' : 'lotes'} · status, preços e mapa em um só lugar.`;

  return (
    <main className="min-h-0 bg-slate-50/30 p-4 sm:p-6 md:p-8 lg:p-10">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title={title}
          description={description}
          breadcrumbs={breadcrumbs}
          actions={
            developmentId ? (
              <Link
                href={
                  blockId
                    ? `/lots/lots/new?development=${developmentId}&block=${blockId}`
                    : `/lots/blocks/new?development=${developmentId}`
                }
              >
                <Button type="button" className="gap-2 shadow-md">
                  <Plus className="h-4 w-4" />
                  {blockId ? 'Novo lote' : 'Nova quadra'}
                </Button>
              </Link>
            ) : null
          }
        />

        {!developmentId ? (
          <EmptyState
            icon={MapPinned}
            title="Selecione um loteamento"
            description="Abra um empreendimento na lista de loteamentos para cadastrar quadras e lotes."
            action={
              <Link href="/developments">
                <Button type="button" variant="brand" className="gap-2">
                  <MapPinned className="h-4 w-4" />
                  Ir para loteamentos
                </Button>
              </Link>
            }
          />
        ) : blocksLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : !blockId ? (
          <>
            {blocks?.length ? (
              <div className="space-y-3">
                {blocks.map((b) => (
                  <Card
                    key={b.id}
                    className="flex flex-col gap-3 p-5 transition-shadow hover:shadow-card-hover sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link
                      href={`/lots?development=${developmentId}&block=${b.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-800">
                        <Grid3X3 className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <p className="font-bold text-primary-950">{b.name}</p>
                        <p className="text-sm text-gray-500">
                          {b._count?.lots ?? 0} {b._count?.lots === 1 ? 'lote' : 'lotes'}
                        </p>
                      </div>
                    </Link>
                    <div className="flex shrink-0 gap-2">
                      <Link href={`/lots?development=${developmentId}&block=${b.id}`}>
                        <Button variant="brand" size="sm" type="button" className="gap-1.5">
                          <Layers className="h-3.5 w-3.5" />
                          Abrir lotes
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        type="button"
                        className="gap-1.5"
                        onClick={() => {
                          if (confirm('Excluir esta quadra e todos os lotes vinculados?')) {
                            deleteBlock.mutate(b.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Grid3X3}
                title="Nenhuma quadra neste loteamento"
                description="Crie a primeira quadra para começar a cadastrar lotes e status."
                action={
                  <Link href={`/lots/blocks/new?development=${developmentId}`}>
                    <Button type="button" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Nova quadra
                    </Button>
                  </Link>
                }
              />
            )}
            {developmentId ? (
              mapLoading ? (
                <Skeleton className="mt-10 h-[480px] w-full rounded-2xl" />
              ) : mapData ? (
                <div ref={developmentMapSectionRef} className="mt-10 scroll-mt-6 space-y-3">
                  <h2 className="text-lg font-bold text-primary-950">Localização no mapa (MapLibre)</h2>
                  <p className="text-sm text-gray-600">
                    Visualize todos os lotes georreferenciados do empreendimento. Cadastre latitude/longitude ou
                    polígono na edição do lote ou do loteamento.
                  </p>
                  <DevelopmentLotsMap
                    development={mapData.development}
                    lots={mapData.lots}
                    nearbyPlaces={mapData.nearbyPlaces ?? []}
                    nearbyTravelMode={nearbyTravelMode}
                    onNearbyTravelModeChange={setNearbyTravelMode}
                  />
                </div>
              ) : null
            ) : null}
          </>
        ) : lotsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {block && development ? (
              <nav
                className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
                aria-label="Resumo da quadra"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <Link
                    href={`/lots?development=${developmentId}`}
                    className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-primary-800 transition-colors hover:text-primary-950 hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                    Quadras do empreendimento
                  </Link>
                  <span className="hidden h-4 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-success-200/80 bg-success-50/90 px-2.5 py-0.5 text-xs font-semibold text-success-900">
                      {lotStats.disponivel} disp.
                    </span>
                    <span className="rounded-full border border-warning-200/80 bg-warning-50/90 px-2.5 py-0.5 text-xs font-semibold text-warning-950">
                      {lotStats.reservado} reserv.
                    </span>
                    <span className="rounded-full border border-sky-200/80 bg-sky-50/90 px-2.5 py-0.5 text-xs font-semibold text-sky-950">
                      {lotStats.negociacao} neg.
                    </span>
                    <span className="rounded-full border border-danger-200/70 bg-danger-50/90 px-2.5 py-0.5 text-xs font-semibold text-danger-950">
                      {lotStats.vendido} vend.
                    </span>
                  </div>
                </div>
                {mapData?.medianPrice != null ? (
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Mediana (empreend.)</p>
                    <p className="text-sm font-bold tabular-nums text-primary-950">{formatPrice(mapData.medianPrice)}</p>
                  </div>
                ) : null}
              </nav>
            ) : null}

            {blockId && developmentId && blocks && blocks.length > 1 ? (
              <div className="mb-4">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Quadra
                </label>
                <select
                  value={blockId}
                  onChange={(e) =>
                    router.push(`/lots?development=${developmentId}&block=${e.target.value}`)
                  }
                  className="h-10 max-w-md rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-primary-950 shadow-sm"
                >
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {block && development ? (
              <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Filtros</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {DEFAULT_STATUS_FILTERS.map((st) => {
                    const labels: Record<string, string> = {
                      DISPONIVEL: 'Disponível',
                      RESERVADO: 'Reservado',
                      EM_NEGOCIACAO: 'Em negociação',
                      VENDIDO: 'Vendido',
                      INDISPONIVEL: 'Indisponível',
                    };
                    const on = filterStatus.includes(st);
                    return (
                      <Button
                        key={st}
                        type="button"
                        size="sm"
                        variant={on ? 'brand' : 'outline'}
                        className="h-8 text-[11px]"
                        onClick={() => toggleStatusFilter(st)}
                      >
                        {labels[st] ?? st}
                      </Button>
                    );
                  })}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Preço mín. (R$)</label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="Ex.: 50000"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Preço máx. (R$)</label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="Ex.: 250000"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-600">
                  Exibindo <strong>{filteredLots.length}</strong> de <strong>{lots?.length ?? 0}</strong> lotes
                  nesta quadra.
                </p>
              </div>
            ) : null}

            {lots?.length ? (
              <section
                className={cn(
                  'rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5',
                  viewMode === 'map' && 'flex min-h-[min(72dvh,820px)] flex-col',
                )}
                aria-labelledby="lots-workspace-heading"
              >
                <h2 id="lots-workspace-heading" className="sr-only">
                  Lotes e ferramentas
                </h2>
                <div
                  className={cn(
                    'flex gap-6',
                    viewMode === 'map' ? 'min-h-0 flex-1 flex-col' : 'flex-col lg:flex-row lg:items-start',
                  )}
                >
                  <aside
                    className={cn(
                      'w-full shrink-0',
                      viewMode !== 'map' && 'lg:max-w-[min(100%,20rem)] xl:max-w-[22rem]',
                      viewMode !== 'map' && 'lg:sticky lg:top-4 lg:z-10 lg:self-start',
                    )}
                  >
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Simulação</p>
                    <LotPaymentSimulator
                      defaultLotValue={
                        Number(
                          filteredLots.find((x) => x.price != null)?.price ??
                            lots?.find((x) => x.price != null)?.price ??
                            0,
                        ) || undefined
                      }
                    />
                  </aside>

                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Visualização</p>
                      <div
                        role="tablist"
                        aria-label="Modo de visualização dos lotes"
                        className="flex w-full max-w-md rounded-xl border border-slate-200/80 bg-slate-50/80 p-1 shadow-inner sm:ml-auto sm:w-auto"
                      >
                        <Button
                          type="button"
                          size="sm"
                          role="tab"
                          aria-selected={viewMode === 'list'}
                          variant={viewMode === 'list' ? 'brand' : 'ghost'}
                          className="min-h-9 flex-1 gap-1.5 sm:flex-initial"
                          onClick={() => setViewMode('list')}
                        >
                          <List className="h-4 w-4 shrink-0" aria-hidden />
                          Lista
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          role="tab"
                          aria-selected={viewMode === 'grid'}
                          variant={viewMode === 'grid' ? 'brand' : 'ghost'}
                          className="min-h-9 flex-1 gap-1.5 sm:flex-initial"
                          onClick={() => setViewMode('grid')}
                        >
                          <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
                          Grade
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          role="tab"
                          aria-selected={viewMode === 'map'}
                          variant={viewMode === 'map' ? 'brand' : 'ghost'}
                          className="min-h-9 flex-1 gap-1.5 sm:flex-initial"
                          onClick={() => setViewMode('map')}
                        >
                          <MapIcon className="h-4 w-4 shrink-0" aria-hidden />
                          Mapa
                        </Button>
                      </div>
                    </div>

                    {viewMode === 'list' ? (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredLots.length === 0 ? (
                          <p className="col-span-full rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
                            Nenhum lote corresponde aos filtros. Ajuste status ou faixa de preço.
                          </p>
                        ) : null}
                        {filteredLots.map((l) => {
                          const busy =
                            updateLotStatus.isPending && updateLotStatus.variables?.id === l.id;
                          return (
                            <Card
                              key={l.id}
                              className={cn(
                                'flex flex-col border-l-4 p-5 transition-shadow hover:shadow-card-hover',
                                lotCardBorder(l.status),
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                                    Lote
                                  </p>
                                  <p className="text-xl font-bold text-primary-950">#{l.number}</p>
                                  <p className="mt-1 text-sm text-gray-600">
                                    {l.area ? `${l.area} m²` : 'Metragem não informada'}
                                  </p>
                                  <p className="mt-2 text-lg font-bold text-primary-800">
                                    {formatPrice(Number(l.price ?? 0))}
                                  </p>
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <LotStatusBadge status={l.status} />
                                    {l.saleScore != null && l.status === 'DISPONIVEL' ? (
                                      <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-900">
                                        Score {Math.round(Number(l.saleScore))}
                                      </span>
                                    ) : null}
                                    {l.saleClassification && l.status === 'DISPONIVEL' ? (
                                      <span className="max-w-[140px] truncate text-[10px] font-semibold text-gray-600">
                                        {l.saleClassification}
                                      </span>
                                    ) : null}
                                    {l.manualHighlight ? (
                                      <span className="rounded-full bg-warning-100 px-2 py-0.5 text-[10px] font-bold text-warning-900">
                                        Destaque
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-col gap-1">
                                  <Link href={`/lots/lots/edit/${l.id}?development=${developmentId}&block=${blockId}`}>
                                    <Button variant="outline" size="sm" type="button" className="gap-1 w-full">
                                      <Pencil className="h-3.5 w-3.5" />
                                      Editar
                                    </Button>
                                  </Link>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="gap-1 font-bold"
                                    disabled={mapLoading}
                                    onClick={() => setMapDialogLotId(l.id)}
                                  >
                                    <MapIcon className="h-3.5 w-3.5" />
                                    Ver no mapa
                                  </Button>
                                </div>
                              </div>

                              <div className="mt-4 border-t border-surface-muted pt-4">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                  Ação rápida (status)
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {(['DISPONIVEL', 'RESERVADO', 'EM_NEGOCIACAO', 'VENDIDO'] as const).map((st) => (
                                    <Button
                                      key={st}
                                      type="button"
                                      size="sm"
                                      variant={l.status === st ? 'brand' : 'secondary'}
                                      className="h-8 text-[11px]"
                                      disabled={busy || l.status === st}
                                      onClick={() => updateLotStatus.mutate({ id: l.id, status: st })}
                                    >
                                      {busy && updateLotStatus.variables?.status === st ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : st === 'DISPONIVEL' ? (
                                        'Disponível'
                                      ) : st === 'RESERVADO' ? (
                                        'Reservar'
                                      ) : st === 'EM_NEGOCIACAO' ? (
                                        'Negociação'
                                      ) : (
                                        'Vendido'
                                      )}
                                    </Button>
                                  ))}
                                </div>
                                <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                  Vendas & leads
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  <Link href={`/visits/new?lotId=${l.id}`}>
                                    <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-[11px]">
                                      <Calendar className="h-3.5 w-3.5" />
                                      Agendar visita
                                    </Button>
                                  </Link>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1 text-[11px]"
                                    onClick={() =>
                                      setInterestLot({
                                        id: l.id,
                                        label: `Lote ${l.number} — ${block?.name ?? 'Quadra'} (${development?.name ?? 'Loteamento'})`,
                                      })
                                    }
                                  >
                                    <HeartHandshake className="h-3.5 w-3.5" />
                                    Tenho interesse
                                  </Button>
                                  <a
                                    href={`https://wa.me/?text=${encodeURIComponent(
                                      `Olá! Tenho interesse no lote ${l.number} (${block?.name ?? 'Quadra'}) no empreendimento ${development?.name ?? ''}.`,
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      'inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-success-800 shadow-sm transition hover:bg-success-50',
                                    )}
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                    WhatsApp
                                  </a>
                                </div>
                              </div>

                              <div className="mt-3 flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  type="button"
                                  className="gap-1.5 text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                                  onClick={() => {
                                    if (confirm('Excluir este lote permanentemente?')) {
                                      deleteLot.mutate(l.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Excluir
                                </Button>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    ) : null}

                    {viewMode === 'grid' ? (
                      mapLoading ? (
                        <Skeleton className="min-h-[200px] w-full rounded-2xl" />
                      ) : (
                        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-4">
                          <p className="mb-3 text-sm leading-relaxed text-slate-600">
                            Cada bloco é um lote da quadra <strong className="text-slate-800">{block?.name}</strong>.
                            Verde = disponível, âmbar = reservado, azul = negociação, vermelho = vendido.
                            {mapData?.medianPrice != null && (
                              <span className="ml-1">
                                Mediana no empreendimento:{' '}
                                <strong>{formatPrice(mapData.medianPrice)}</strong>.
                              </span>
                            )}
                          </p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                            {filteredMapLotsForBlock.length === 0 ? (
                              <p className="col-span-full rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
                                Nenhum lote corresponde aos filtros.
                              </p>
                            ) : null}
                            {filteredMapLotsForBlock.map((l) => (
                              <Link
                                key={l.id}
                                href={`/lots/lots/edit/${l.id}?development=${developmentId}&block=${blockId}`}
                                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                              >
                                <div
                                  className={cn(
                                    'flex min-h-[100px] flex-col items-center justify-center rounded-xl border-2 p-2 text-center shadow-sm transition hover:shadow-md',
                                    mapCellClass(l.status),
                                  )}
                                >
                                  {l.isOpportunity ? (
                                    <span className="mb-1 inline-flex items-center gap-0.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-success-800 shadow">
                                      <Sparkles className="h-2.5 w-2.5" />
                                      Oportunidade
                                    </span>
                                  ) : null}
                                  <p className="text-lg font-bold">#{l.number}</p>
                                  {l.saleScore != null && l.status === 'DISPONIVEL' ? (
                                    <p className="text-[10px] font-bold text-primary-800">
                                      Score {Math.round(l.saleScore)}
                                    </p>
                                  ) : null}
                                  <p className="text-[11px] font-semibold opacity-90">
                                    {formatPrice(l.price ?? 0)}
                                  </p>
                                  {l.area != null ? (
                                    <p className="text-[10px] opacity-80">{l.area} m²</p>
                                  ) : null}
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )
                    ) : null}

                    {viewMode === 'map' ? (
                      mapLoading ? (
                        <Skeleton className="min-h-[min(52dvh,560px)] w-full flex-1 rounded-2xl" />
                      ) : mapData ? (
                        <div className="flex min-h-0 w-full flex-1 flex-col">
                          <DevelopmentLotsMap
                            development={mapData.development}
                            lots={mapLotsForView}
                            className="shadow-card flex min-h-0 flex-1 flex-col"
                            tallViewport
                            tallViewportFill
                            nearbyPlaces={mapData.nearbyPlaces ?? []}
                            nearbyTravelMode={nearbyTravelMode}
                            onNearbyTravelModeChange={setNearbyTravelMode}
                          />
                        </div>
                      ) : null
                    ) : null}
                  </div>
                </div>
              </section>
            ) : (
              <EmptyState
                icon={Layers}
                title="Nenhum lote nesta quadra"
                description="Adicione lotes com número, metragem, preço e status para acompanhar o estoque."
                action={
                  <Link href={`/lots/lots/new?development=${developmentId}&block=${blockId}`}>
                    <Button type="button" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Novo lote
                    </Button>
                  </Link>
                }
              />
            )}
          </>
        )}

        <LotMapDialog
          open={!!mapDialogLotId}
          onOpenChange={(o) => !o && setMapDialogLotId(null)}
          development={mapData?.development ?? null}
          lots={mapData?.lots ?? []}
          nearbyPlaces={mapData?.nearbyPlaces ?? []}
          nearbyTravelMode={nearbyTravelMode}
          onNearbyTravelModeChange={setNearbyTravelMode}
          highlightLotId={mapDialogLotId}
          loading={mapLoading && !!mapDialogLotId}
        />

        {interestLot ? (
          <LotInterestModal
            open={!!interestLot}
            onOpenChange={(o) => !o && setInterestLot(null)}
            lotId={interestLot.id}
            lotLabel={interestLot.label}
          />
        ) : null}
      </div>
    </main>
  );
}
