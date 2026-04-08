'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Grid3X3,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Map as MapIcon,
  MapPinned,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice, cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toaster';
import { PageHeader } from '@/components/dashboard/page-header';
import { EmptyState } from '@/components/dashboard/empty-state';
import { LotStatusBadge } from '@/components/dashboard/lot-status-badge';
import { LotPaymentSimulator } from '@/components/lotes/lot-payment-simulator';
import { DevelopmentLotsMap } from '@/components/maps/development-lots-map';
import { LotMapDialog } from '@/components/maps/lot-map-dialog';
import type { GeoMapDevelopment, GeoMapLot } from '@/components/maps/development-lots-map';

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
  medianPrice: number | null;
  lots: MapLotRow[];
};

function mapCellClass(status: string) {
  switch (status) {
    case 'DISPONIVEL':
      return 'border-success-500/80 bg-success-50/90 text-success-950';
    case 'RESERVADO':
      return 'border-warning-500/80 bg-warning-50/90 text-warning-950';
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
    case 'VENDIDO':
      return 'border-l-danger-500';
    default:
      return 'border-l-gray-400';
  }
}

export default function LotsPage() {
  const searchParams = useSearchParams();
  const developmentId = searchParams.get('development');
  const blockId = searchParams.get('block');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'google'>('list');
  const [mapDialogLotId, setMapDialogLotId] = useState<string | null>(null);

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
    queryKey: ['lot-map', developmentId],
    queryFn: async () => {
      const { data } = await api.get<MapPayload>(`/lots/development/${developmentId}/map`);
      return data;
    },
    enabled: !!developmentId,
  });

  const mapLotsForBlock = (mapData?.lots ?? []).filter((l) => l.blockId === blockId);
  const mapLotsForGoogle = blockId ? mapLotsForBlock : mapData?.lots ?? [];

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
      : `Lotes — ${block?.name ?? 'Quadra'}`;

  const description = !developmentId
    ? 'Escolha um loteamento para gerenciar quadras e lotes, alterar status e preços com poucos cliques.'
    : !blockId
      ? `Selecione uma quadra em ${development?.name ?? '…'} para ver e editar os lotes.`
      : `Lotes da quadra ${block?.name ?? '…'} no empreendimento ${development?.name ?? '…'}.`;

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
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
                <div className="mt-10 space-y-3">
                  <h2 className="text-lg font-bold text-primary-950">Localização no mapa (Google)</h2>
                  <p className="text-sm text-gray-600">
                    Visualize todos os lotes georreferenciados do empreendimento. Cadastre latitude/longitude ou
                    polígono na edição do lote ou do loteamento.
                  </p>
                  <DevelopmentLotsMap development={mapData.development} lots={mapData.lots} />
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
        ) : lots?.length ? (
          <>
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start">
              <LotPaymentSimulator
                defaultLotValue={Number(lots.find((x) => x.price != null)?.price ?? 0) || undefined}
              />
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Visualização
                  </span>
                  <div className="flex rounded-xl border border-surface-muted bg-white p-1 shadow-sm">
                    <Button
                      type="button"
                      size="sm"
                      variant={viewMode === 'list' ? 'brand' : 'ghost'}
                      className="gap-1.5"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                      Lista
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={viewMode === 'grid' ? 'brand' : 'ghost'}
                      className="gap-1.5"
                      onClick={() => setViewMode('grid')}
                    >
                      <LayoutGrid className="h-4 w-4" />
                      Grade
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={viewMode === 'google' ? 'brand' : 'ghost'}
                      className="gap-1.5"
                      onClick={() => setViewMode('google')}
                    >
                      <MapIcon className="h-4 w-4" />
                      Mapa real
                    </Button>
                  </div>
                </div>
                {viewMode === 'grid' ? (
                  mapLoading ? (
                    <Skeleton className="min-h-[200px] w-full rounded-2xl" />
                  ) : (
                    <div>
                      <p className="mb-3 text-sm text-gray-600">
                        Cada bloco é um lote da quadra <strong>{block?.name}</strong>. Verde = disponível,
                        âmbar = reservado, vermelho = vendido.
                        {mapData?.medianPrice != null && (
                          <span className="ml-1">
                            Mediana de preços (disponíveis no empreendimento):{' '}
                            <strong>{formatPrice(mapData.medianPrice)}</strong>.
                          </span>
                        )}
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {mapLotsForBlock.map((l) => (
                          <Link
                            key={l.id}
                            href={`/lots/lots/edit/${l.id}?development=${developmentId}&block=${blockId}`}
                            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-xl"
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
                {viewMode === 'google' ? (
                  mapLoading ? (
                    <Skeleton className="min-h-[420px] w-full rounded-2xl" />
                  ) : mapData ? (
                    <DevelopmentLotsMap
                      development={mapData.development}
                      lots={mapLotsForGoogle}
                      className="shadow-card"
                    />
                  ) : null
                ) : null}
              </div>
            </div>

            {viewMode === 'list' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lots.map((l) => {
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
                      Ação rápida
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(['DISPONIVEL', 'RESERVADO', 'VENDIDO'] as const).map((st) => (
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
                          ) : (
                            'Vendido'
                          )}
                        </Button>
                      ))}
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
          </>
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

        <LotMapDialog
          open={!!mapDialogLotId}
          onOpenChange={(o) => !o && setMapDialogLotId(null)}
          development={mapData?.development ?? null}
          lots={mapData?.lots ?? []}
          highlightLotId={mapDialogLotId}
          loading={mapLoading && !!mapDialogLotId}
        />
      </div>
    </main>
  );
}
