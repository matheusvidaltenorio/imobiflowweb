'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Flame,
  Grid3X3,
  Heart,
  Layers,
  MapPinned,
  Map as MapIconDash,
  MessageSquare,
  Share2,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserCircle,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/dashboard/page-header';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const flowSteps = [
  { step: 1, label: 'Lead', href: '/leads' },
  { step: 2, label: 'Visita', href: '/visits/agenda' },
  { step: 3, label: 'Simulação', href: '/simulacao' },
  { step: 4, label: 'Proposta', href: '/propostas' },
  { step: 5, label: 'Contrato', href: '/contracts' },
];

type CommercialLotRow = {
  id: string;
  blockId: string;
  number: string;
  blockName: string;
  development: { id: string; name: string; city: string };
  price: number | null;
  saleScore: number | null;
  saleClassification: string | null;
  saleScoreReason: string | null;
  viewCount: number;
  contactCount: number;
  commercialTags: string[];
  suggestedAction: string;
  position?: number;
};

type CommercialIntel = {
  todayPick: CommercialLotRow[];
  topSaleScore: CommercialLotRow[];
  topViewed: CommercialLotRow[];
  topContacted: CommercialLotRow[];
  topConversionPotential: CommercialLotRow[];
  stalled: CommercialLotRow[];
  champions: CommercialLotRow[];
};

type MessageRecommendationItem = {
  leadId: string;
  leadName: string;
  lotLabel: string;
  contactTiming: string;
  recommendedTone: string;
  nextAction: string;
  primaryType: string;
  typeLabel: string;
  preview: string;
  strategySummary: string;
};

type ClosingForecastLead = {
  id: string;
  name: string;
  closingScore: number | null;
  closingPrediction: string | null;
  closingNextAction: string | null;
  closingPriorityLevel?: string | null;
  leadLastInteractionAt?: string | null;
  status?: string;
  lotLabel: string | null;
  momentumDrop?: number;
};

type ClosingForecast = {
  topToCloseToday: ClosingForecastLead[];
  coolingDown: ClosingForecastLead[];
  needsFollowUp: ClosingForecastLead[];
  nearClosing: ClosingForecastLead[];
};

type InstagramAdRecommendation = {
  kind: string;
  lotId: string;
  blockId: string;
  developmentId: string;
  number: string;
  blockName: string;
  developmentName: string;
  reason: string;
  suggestedObjective: string;
  commercialTags: string[];
};

type DashboardData = {
  propertiesCount: number;
  visitsCount: number;
  leadsCount: number;
  favoritesCount: number;
  developmentsCount?: number;
  blocksCount?: number;
  lotsCount?: number;
  clientsCount?: number;
  lotsAvailable?: number;
  lotsReserved?: number;
  lotsSold?: number;
  leadsByStage?: Array<{ status: string; count: number }>;
  conversionRate?: number;
  leadsSoldCount?: number;
  commercialIntel?: CommercialIntel;
  closingForecast?: ClosingForecast;
  messageRecommendations?: { items: MessageRecommendationItem[] };
  instagramAdRecommendations?: { items: InstagramAdRecommendation[] };
  recentLeads?: Array<{
    id: string;
    name: string;
    email: string;
    property?: { title: string } | null;
    lot?: { number: string; block?: { name: string; development?: { name: string } } };
    createdAt: string;
  }>;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get<DashboardData>('/dashboard');
      return data;
    },
    enabled: !!user,
  });

  if (user?.role === 'CLIENTE') {
    return (
      <main className="p-6 md:p-10">
        <PageHeader
          title="Área do cliente"
          description="Explore favoritos e interesses pelo menu. Estamos aqui para ajudar na sua escolha."
        />
      </main>
    );
  }

  const inventoryCards = [
    {
      label: 'Loteamentos',
      value: data?.developmentsCount ?? 0,
      href: '/developments',
      sub: 'Gerenciar',
      icon: MapPinned,
      tone: 'from-primary-800 to-primary-700',
    },
    {
      label: 'Quadras',
      value: data?.blocksCount ?? 0,
      href: '/lots',
      sub: 'Ver inventário',
      icon: Grid3X3,
      tone: 'from-primary-700 to-primary-600',
    },
    {
      label: 'Lotes (total)',
      value: data?.lotsCount ?? 0,
      href: '/lots',
      sub: 'Abrir lotes',
      icon: Layers,
      tone: 'from-primary-600 to-primary-500',
    },
    {
      label: 'Clientes',
      value: data?.clientsCount ?? 0,
      href: '/clients',
      sub: 'Ver cadastros',
      icon: UserCircle,
      tone: 'from-accent-600 to-accent-500',
    },
  ];

  const statusCards = [
    {
      label: 'Disponíveis',
      value: data?.lotsAvailable ?? 0,
      href: '/lots',
      icon: Layers,
      border: 'border-l-success-500',
      bg: 'bg-success-50/80',
    },
    {
      label: 'Reservados',
      value: data?.lotsReserved ?? 0,
      href: '/lots',
      icon: Layers,
      border: 'border-l-warning-500',
      bg: 'bg-warning-50/80',
    },
    {
      label: 'Vendidos',
      value: data?.lotsSold ?? 0,
      href: '/lots',
      icon: Layers,
      border: 'border-l-danger-500',
      bg: 'bg-danger-50/60',
    },
  ];

  const legacyCards = [
    {
      label: 'Imóveis',
      value: data?.propertiesCount ?? 0,
      href: '/properties',
      sub: 'Ver todos',
      icon: Building2,
      tone: 'from-gray-700 to-gray-600',
    },
    {
      label: 'Visitas',
      value: data?.visitsCount ?? 0,
      href: '/visits',
      sub: 'Ver agenda',
      icon: CalendarDays,
      tone: 'from-gray-600 to-gray-500',
    },
    {
      label: 'Leads',
      value: data?.leadsCount ?? 0,
      href: '/leads',
      sub: 'Abrir funil',
      icon: Users,
      tone: 'from-accent-600 to-accent-500',
    },
    {
      label: 'Favoritos',
      value: data?.favoritesCount ?? 0,
      href: '/favorites',
      sub: null,
      icon: Heart,
      tone: 'from-success-600 to-success-500',
    },
  ];

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Dashboard"
          description="Visão operacional dos loteamentos, lotes e relacionamento. Atalhos para o que mais importa no dia a dia do corretor."
          actions={
            <Link href="/developments/new">
              <Button type="button" variant="brand" className="shadow-md">
                Novo loteamento
              </Button>
            </Link>
          }
        />

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200/80 bg-primary-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-800">
            <Sparkles className="h-3.5 w-3.5" />
            Painel de loteamentos
          </span>
        </div>

        <Card className="mb-6 border-primary-100/90 bg-gradient-to-r from-white via-primary-50/30 to-accent-50/40 p-5 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-primary-900">Mapa e visitas</p>
              <p className="mt-1 text-xs text-gray-600">
                Cadastre coordenadas nos loteamentos e lotes e use o mapa Google na tela de quadras para orientar
                clientes e corretores.
              </p>
            </div>
            <Link href="/developments">
              <Button type="button" variant="outline" size="sm" className="gap-2 font-bold">
                <MapIconDash className="h-4 w-4" />
                Loteamentos e mapa
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="mb-10 border-primary-100/90 bg-gradient-to-r from-white via-white to-primary-50/50 p-5 shadow-card">
          <p className="text-sm font-bold text-primary-900">Fluxo comercial</p>
          <p className="mt-1 text-xs text-gray-600">Ordem sugerida do primeiro contato ao contrato.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {flowSteps.map((s, i) => (
              <span key={s.href} className="flex items-center gap-2">
                <Link
                  href={s.href}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary-800 shadow-sm ring-1 ring-primary-100/90 transition hover:bg-primary-800 hover:text-white hover:ring-primary-700"
                >
                  {s.step}. {s.label}
                </Link>
                {i < flowSteps.length - 1 ? (
                  <ArrowRight className="hidden h-4 w-4 text-gray-300 sm:inline" aria-hidden />
                ) : null}
              </span>
            ))}
          </div>
        </Card>

        {isLoading ? (
          <div className="space-y-10">
            <div>
              <Skeleton className="mb-4 h-5 w-48" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-36 rounded-2xl" />
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <section className="mb-10">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">
                Inventário de terrenos
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {inventoryCards.map((item) => (
                  <Card key={item.label} className="group relative overflow-hidden p-0 transition-shadow duration-200 hover:shadow-card-hover">
                    <div
                      className={cn(
                        'absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full opacity-15 blur-2xl',
                        `bg-gradient-to-br ${item.tone}`,
                      )}
                    />
                    <div className="relative p-6">
                      <div
                        className={cn(
                          'mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md',
                          `bg-gradient-to-br ${item.tone}`,
                        )}
                      >
                        <item.icon className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <p className="text-sm font-semibold text-gray-500">{item.label}</p>
                      <p className="mt-1 text-3xl font-bold tabular-nums text-primary-950">{item.value}</p>
                      {item.sub ? (
                        <Link
                          href={item.href}
                          className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary-700 transition group-hover:text-accent-600"
                        >
                          {item.sub}
                          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                        </Link>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">
                Status dos lotes
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {statusCards.map((item) => (
                  <Card
                    key={item.label}
                    className={cn(
                      'border-l-4 p-5 transition-shadow hover:shadow-card-hover',
                      item.border,
                      item.bg,
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-600">{item.label}</p>
                        <p className="mt-1 text-3xl font-bold tabular-nums text-primary-950">{item.value}</p>
                      </div>
                      <div className="rounded-xl bg-white/80 p-3 text-primary-700 shadow-sm">
                        <item.icon className="h-6 w-6" strokeWidth={1.5} />
                      </div>
                    </div>
                    <Link
                      href={item.href}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-accent-600"
                    >
                      Ver no inventário
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Card>
                ))}
              </div>
            </section>

            {data?.commercialIntel?.todayPick?.length ? (
              <section className="mb-10">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                    Prioridade de hoje
                  </h2>
                  <Link
                    href="/melhores-lotes"
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-accent-600"
                  >
                    Ver ranking completo
                    <TrendingUp className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <p className="mb-4 text-sm text-gray-600">
                  Três lotes com melhor score na sua carteira — foque primeiro neles para conversão.
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  {data.commercialIntel.todayPick.map((lot) => (
                    <Card
                      key={lot.id}
                      className="border-l-4 border-l-primary-600 bg-gradient-to-br from-white to-primary-50/40 p-5 shadow-card"
                    >
                      <p className="text-xs font-bold uppercase text-primary-800">
                        #{lot.position ?? '—'} no ranking
                      </p>
                      <p className="mt-1 text-lg font-bold text-primary-950">
                        Lote {lot.number} · {lot.blockName}
                      </p>
                      <p className="text-sm text-gray-600">{lot.development.name}</p>
                      <p className="mt-2 font-bold text-primary-800">{formatPrice(lot.price ?? 0)}</p>
                      <p className="mt-2 text-xs font-bold text-primary-900">
                        Score {lot.saleScore != null ? Math.round(lot.saleScore) : '—'} —{' '}
                        {lot.saleClassification ?? '—'}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs text-gray-600">{lot.suggestedAction}</p>
                      <Link
                        href={`/lots/lots/edit/${lot.id}?development=${lot.development.id}&block=${lot.blockId}`}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-accent-600"
                      >
                        Abrir lote
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {data?.instagramAdRecommendations?.items?.length ? (
              <section className="mb-10">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                    Anúncios sugeridos para hoje (Instagram)
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-1 text-[10px] font-bold uppercase text-primary-800">
                    <Share2 className="h-3 w-3" />
                    Ranking + campanha
                  </span>
                </div>
                <p className="mb-4 text-sm text-gray-600">
                  Lotes campeões, com sinal de estoque ou alta prioridade — abra o lote e use &quot;Gerar anúncio para
                  Instagram&quot; com o objetivo sugerido.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {data.instagramAdRecommendations.items.map((row) => (
                    <Card
                      key={`${row.kind}-${row.lotId}`}
                      className={cn(
                        'border-l-4 p-5 shadow-card',
                        row.kind === 'champion' && 'border-l-success-600 bg-gradient-to-br from-white to-success-50/30',
                        row.kind === 'stalled' && 'border-l-amber-500 bg-gradient-to-br from-white to-amber-50/40',
                        row.kind === 'priority' && 'border-l-primary-600 bg-gradient-to-br from-white to-primary-50/30',
                      )}
                    >
                      <p className="text-[10px] font-bold uppercase text-gray-500">
                        {row.kind === 'champion'
                          ? 'Campeão de venda'
                          : row.kind === 'stalled'
                            ? 'Campanha / estoque'
                            : 'Alta prioridade'}
                      </p>
                      <p className="mt-1 text-lg font-bold text-primary-950">
                        Lote {row.number} · {row.blockName}
                      </p>
                      <p className="text-sm text-gray-600">{row.developmentName}</p>
                      <p className="mt-2 text-sm text-gray-800">{row.reason}</p>
                      <p className="mt-2 text-xs font-bold text-primary-800">
                        Objetivo sugerido: {row.suggestedObjective.replace(/_/g, ' ')}
                      </p>
                      {row.commercialTags.length ? (
                        <p className="mt-1 text-xs text-gray-500">Tags: {row.commercialTags.join(', ')}</p>
                      ) : null}
                      <Link
                        href={`/lots/lots/edit/${row.lotId}?development=${row.developmentId}&block=${row.blockId}`}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-accent-600"
                      >
                        Gerar anúncio neste lote
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {data?.closingForecast &&
            (data.closingForecast.topToCloseToday.length > 0 ||
              data.closingForecast.coolingDown.length > 0 ||
              data.closingForecast.needsFollowUp.length > 0 ||
              data.closingForecast.nearClosing.length > 0) ? (
              <section className="mb-10">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                    Previsão de fechamento (leads)
                  </h2>
                  <Link
                    href="/leads"
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-accent-600"
                  >
                    Abrir funil
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <p className="mb-4 text-sm text-gray-600">
                  Score 0–100 por regras de funil, engajamento, visitas, propostas, lote e aderência financeira — use para
                  priorizar o dia.
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="border-l-4 border-l-success-600 p-5 shadow-card">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="rounded-lg bg-success-100 p-2 text-success-800">
                        <Target className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold text-primary-950">Maior chance de fechar hoje</p>
                    </div>
                    <ul className="space-y-3">
                      {data.closingForecast.topToCloseToday.length ? (
                        data.closingForecast.topToCloseToday.map((l) => (
                          <li key={l.id} className="border-b border-surface-muted pb-2 text-sm last:border-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-gray-900">{l.name}</span>
                              <span className="rounded-full bg-success-100 px-2 py-0.5 text-xs font-black tabular-nums text-success-900">
                                {l.closingScore != null ? Math.round(l.closingScore) : '—'}
                              </span>
                            </div>
                            {l.lotLabel ? <p className="text-xs text-gray-600">{l.lotLabel}</p> : null}
                            <p className="mt-1 text-xs font-medium text-primary-800">{l.closingPrediction}</p>
                            <p className="text-[11px] text-gray-500">{l.closingNextAction}</p>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-gray-500">Sem leads com score calculado ainda.</li>
                      )}
                    </ul>
                  </Card>

                  <Card className="border-l-4 border-l-red-500/70 p-5 shadow-card">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="rounded-lg bg-red-100 p-2 text-red-800">
                        <TrendingDown className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold text-primary-950">Negociação esfriando</p>
                    </div>
                    <p className="mb-2 text-xs text-gray-600">
                      Queda relevante no score entre recálculos — retome contato.
                    </p>
                    <ul className="space-y-3">
                      {data.closingForecast.coolingDown.length ? (
                        data.closingForecast.coolingDown.map((l) => (
                          <li key={l.id} className="border-b border-surface-muted pb-2 text-sm last:border-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-gray-900">{l.name}</span>
                              {l.momentumDrop != null ? (
                                <span className="text-xs font-bold text-red-700">−{l.momentumDrop} pts</span>
                              ) : null}
                            </div>
                            <p className="text-xs text-gray-600">{l.closingPrediction}</p>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-gray-500">Nenhum alerta de momentum no momento.</li>
                      )}
                    </ul>
                  </Card>

                  <Card className="border-l-4 border-l-amber-500/80 p-5 shadow-card">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="rounded-lg bg-amber-100 p-2 text-amber-900">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold text-primary-950">Precisam de follow-up</p>
                    </div>
                    <ul className="space-y-3">
                      {data.closingForecast.needsFollowUp.length ? (
                        data.closingForecast.needsFollowUp.map((l) => (
                          <li key={l.id} className="border-b border-surface-muted pb-2 text-sm last:border-0">
                            <span className="font-semibold text-gray-900">{l.name}</span>
                            {l.lotLabel ? <p className="text-xs text-gray-600">{l.lotLabel}</p> : null}
                            <p className="mt-1 text-[11px] text-gray-500">{l.closingNextAction}</p>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-gray-500">Nenhum lead nesta lista agora.</li>
                      )}
                    </ul>
                  </Card>

                  <Card className="border-l-4 border-l-accent-500 p-5 shadow-card">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="rounded-lg bg-accent-100 p-2 text-accent-900">
                        <Flame className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold text-primary-950">Quase fechando (≥ 70)</p>
                    </div>
                    <ul className="space-y-3">
                      {data.closingForecast.nearClosing.length ? (
                        data.closingForecast.nearClosing.map((l) => (
                          <li key={l.id} className="border-b border-surface-muted pb-2 text-sm last:border-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-gray-900">{l.name}</span>
                              <span className="text-xs font-bold tabular-nums text-accent-800">
                                {l.closingScore != null ? Math.round(l.closingScore) : '—'}
                              </span>
                            </div>
                            {l.status ? (
                              <p className="text-[11px] uppercase text-gray-500">Etapa: {l.status}</p>
                            ) : null}
                            {l.lotLabel ? <p className="text-xs text-gray-600">{l.lotLabel}</p> : null}
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-gray-500">Nenhum lead acima de 70 no momento.</li>
                      )}
                    </ul>
                  </Card>
                </div>
              </section>
            ) : null}

            {data?.commercialIntel &&
            (data.commercialIntel.topViewed.length > 0 ||
              data.commercialIntel.stalled.length > 0) ? (
              <section className="mb-10">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">
                  Inteligência comercial (lotes)
                </h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="p-5 shadow-card">
                    <p className="text-sm font-bold text-primary-950">Top 5 mais vistos</p>
                    <ul className="mt-3 space-y-2">
                      {data.commercialIntel.topViewed.map((lot) => (
                        <li
                          key={lot.id}
                          className="flex items-center justify-between gap-2 border-b border-surface-muted pb-2 text-sm last:border-0"
                        >
                          <span className="min-w-0 truncate font-medium text-gray-800">
                            {lot.number} · {lot.development.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-xs font-bold text-gray-500">
                            {lot.viewCount} views
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                  <Card className="p-5 shadow-card border-l-warning-500/80">
                    <p className="text-sm font-bold text-primary-950">Precisam de atenção</p>
                    <p className="mt-1 text-xs text-gray-600">
                      Tempo em estoque e baixa conversão — campanha ou revisão de preço.
                    </p>
                    <ul className="mt-3 space-y-2">
                      {data.commercialIntel.stalled.length ? (
                        data.commercialIntel.stalled.map((lot) => (
                          <li key={lot.id} className="text-sm">
                            <Link
                              href={`/lots/lots/edit/${lot.id}?development=${lot.development.id}&block=${lot.blockId}`}
                              className="font-medium text-primary-800 hover:underline"
                            >
                              Lote {lot.number} — {lot.development.name}
                            </Link>
                            <p className="text-xs text-gray-500">{lot.suggestedAction}</p>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-gray-500">Nenhum alerta no momento.</li>
                      )}
                    </ul>
                  </Card>
                </div>
                <div className="mt-3 text-center">
                  <Link href="/melhores-lotes">
                    <Button type="button" variant="outline" size="sm" className="gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Painel de ranking e filtros
                    </Button>
                  </Link>
                </div>
              </section>
            ) : null}

            {data?.messageRecommendations?.items && data.messageRecommendations.items.length > 0 ? (
              <section className="mb-10">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                    Mensagens recomendadas para hoje
                  </h2>
                  <Link
                    href="/leads"
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-accent-600"
                  >
                    Abrir funil
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <p className="mb-4 text-sm text-gray-600">
                  Combinação de leads quentes, leads parados e contexto do ranking — use o botão IA no card do lead
                  para ver três versões completas.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {data.messageRecommendations.items.map((item) => (
                    <Card
                      key={item.leadId}
                      className="border-l-4 border-l-accent-500/90 p-5 shadow-card"
                    >
                      <div className="flex items-start gap-2">
                        <div className="rounded-lg bg-accent-100 p-2 text-accent-800">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-primary-950">{item.leadName}</p>
                          <p className="text-xs text-gray-600">{item.lotLabel}</p>
                          <p className="mt-2 text-[11px] font-bold uppercase text-primary-800">
                            {item.typeLabel} · tom sugerido: {item.recommendedTone}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-success-800">{item.contactTiming}</p>
                          <p className="mt-2 text-sm leading-relaxed text-gray-800">{item.preview}</p>
                          <p className="mt-2 text-[11px] text-gray-500">{item.nextAction}</p>
                          <Link
                            href="/leads"
                            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-accent-600"
                          >
                            Ver no funil (botão IA)
                            <Sparkles className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mb-10">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">
                Funil e conversão
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-6 shadow-card">
                  <p className="text-sm font-semibold text-gray-600">Taxa de conversão (vendas / leads)</p>
                  <p className="mt-2 text-4xl font-bold tabular-nums text-primary-950">
                    {data?.conversionRate ?? 0}%
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Leads com status vendido: {data?.leadsSoldCount ?? 0} (sobre o total do seu funil)
                  </p>
                  <Link href="/leads" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary-700">
                    Abrir kanban
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Card>
                <Card className="p-6 shadow-card">
                  <p className="mb-3 text-sm font-semibold text-gray-600">Leads por etapa</p>
                  <div className="space-y-2">
                    {(data?.leadsByStage ?? []).map((row) => (
                      <div key={row.status} className="flex items-center gap-2">
                        <span className="w-32 shrink-0 truncate text-xs font-medium text-gray-700">
                          {row.status}
                        </span>
                        <div className="h-2 min-w-0 flex-1 rounded-full bg-surface-muted">
                          <div
                            className="h-2 rounded-full bg-primary-600 transition-all"
                            style={{
                              width: `${Math.min(
                                100,
                                (row.count / Math.max(1, data?.leadsCount ?? 1)) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-gray-800">
                          {row.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">
                Demais indicadores
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {legacyCards.map((item) => (
                  <Card key={item.label} className="group relative overflow-hidden p-0 opacity-95 transition hover:opacity-100">
                    <div className="relative p-5">
                      <div
                        className={cn(
                          'mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm',
                          `bg-gradient-to-br ${item.tone}`,
                        )}
                      >
                        <item.icon className="h-4 w-4" strokeWidth={1.75} />
                      </div>
                      <p className="text-xs font-semibold text-gray-500">{item.label}</p>
                      <p className="mt-0.5 text-2xl font-bold tabular-nums text-primary-950">{item.value}</p>
                      {item.sub ? (
                        <Link
                          href={item.href}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-primary-800"
                        >
                          {item.sub}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            <Card className="p-6 shadow-card">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-primary-950">Leads recentes</h2>
                <Link href="/leads">
                  <Button variant="outline" size="sm" type="button">
                    Ver funil completo
                  </Button>
                </Link>
              </div>
              {data?.recentLeads?.length ? (
                <div className="divide-y divide-surface-muted overflow-hidden rounded-xl border border-surface-muted/90">
                  {data.recentLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-surface/90 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{lead.name}</p>
                        <p className="text-sm text-gray-500">
                          {lead.lot
                            ? `Lote ${lead.lot.number} — ${lead.lot.block?.name ?? ''} (${lead.lot.block?.development?.name ?? ''})`
                            : lead.property?.title}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-gray-400">
                        {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-surface-muted bg-surface/40 px-6 py-10 text-center">
                  <p className="font-medium text-gray-700">Nenhum lead recente</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Divulgue seus imóveis e loteamentos para receber interessados.
                  </p>
                  <Link href="/leads">
                    <Button className="mt-4" type="button">
                      Ir para leads
                    </Button>
                  </Link>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
