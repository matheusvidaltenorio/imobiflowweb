'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  Filter,
  LineChart,
  Loader2,
  Megaphone,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/dashboard/page-header';

const STAGE_LABELS: Record<string, string> = {
  NOVO_LEAD: 'Novo lead',
  EM_ATENDIMENTO: 'Em atendimento',
  VISITA_AGENDADA: 'Visita agendada',
  PROPOSTA_ENVIADA: 'Proposta enviada',
  RESERVADO: 'Reservado',
  VENDIDO: 'Vendido',
  PERDIDO: 'Perdido',
};

const LEAD_SOURCE_OPTIONS = [
  { value: '', label: 'Todas as origens' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'SITE', label: 'Site' },
  { value: 'INDICACAO', label: 'Indicação' },
  { value: 'TRAFICO_PAGO', label: 'Tráfego pago' },
  { value: 'OUTRO', label: 'Outro' },
];

type PeriodPreset = 'today' | '7' | '30' | 'month' | 'custom';

function computeRange(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string,
): { from: Date; to: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (preset === 'custom' && customFrom && customTo) {
    const from = new Date(`${customFrom}T00:00:00`);
    const to = new Date(`${customTo}T23:59:59.999`);
    return { from, to };
  }

  const start = new Date(now);
  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      return { from: start, to: end };
    case '7':
      start.setTime(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: end };
    case '30':
      start.setTime(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: end };
    case 'month': {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      m.setHours(0, 0, 0, 0);
      return { from: m, to: end };
    }
    default:
      start.setTime(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: end };
  }
}

type CommercialDashboard = {
  meta: { generatedAt: string; range: { from: string; to: string }; funnelNote: string };
  kpis: {
    leadsTotal: number;
    leadsWithVisit: number;
    leadsWon: number;
    leadsLost: number;
    visitsScheduled: number;
    visitsDone: number;
    visitsCanceled: number;
    proposalsTotal: number;
    salesTotal: number;
    lotsReserved: number;
    lotsSold: number;
    lotsAvailable: number;
    leadToVisitRate: number;
    leadToSaleRate: number;
    lossRate: number;
  };
  funnel: Array<{ stage: string; count: number; percent: number }>;
  leadsBySource: Array<{ source: string; count: number }>;
  leadsSeries: Array<{ date: string; count: number }>;
  topBrokers: Array<{ userId: string; name: string; leads: number; visits: number; sales: number }>;
  topDevelopments: Array<{
    developmentId: string;
    name: string;
    city: string | null;
    leads: number;
    lotsAvailable: number;
  }>;
  campaigns: Array<{
    id: string;
    title: string;
    status: string;
    publishedAt: string | null;
    leadsCount: number;
    visitsFromLeads: number;
  }>;
  operational: {
    leadsNewToday: number;
    leadsWithoutInteraction: number;
    leadsStale: number;
    visitsToday: number;
    visitsThisWeek: number;
    campaignsFailedRecent: number;
  };
};

type CampaignOption = { id: string; title: string };

const PIE_COLORS = ['#0f766e', '#0ea5e9', '#6366f1', '#f59e0b', '#ec4899', '#64748b', '#22c55e'];

export default function CommercialAnalyticsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [preset, setPreset] = useState<PeriodPreset>('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [developmentId, setDevelopmentId] = useState('');
  const [brokerId, setBrokerId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [leadSource, setLeadSource] = useState('');

  const { from, to } = useMemo(
    () => computeRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const queryString = useMemo(() => {
    const q = new URLSearchParams();
    q.set('from', from.toISOString());
    q.set('to', to.toISOString());
    if (developmentId) q.set('developmentId', developmentId);
    if (isAdmin && brokerId) q.set('brokerId', brokerId);
    if (campaignId) q.set('campaignId', campaignId);
    if (leadSource) q.set('leadSource', leadSource);
    return q.toString();
  }, [from, to, developmentId, isAdmin, brokerId, campaignId, leadSource]);

  const { data: developments } = useQuery({
    queryKey: ['developments-options'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string }>>('/developments');
      return data;
    },
  });

  const { data: brokers } = useQuery({
    queryKey: ['brokers-options'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string }>>('/users?role=CORRETOR');
      return data;
    },
  });

  const { data: campaignOptions } = useQuery({
    queryKey: ['campaigns-analytics-filter'],
    queryFn: async () => {
      const { data } = await api.get<CampaignOption[]>('/campaign-studio/campaigns');
      return data;
    },
  });

  const {
    data: dashboard,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['commercial-analytics', queryString],
    queryFn: async () => {
      const { data } = await api.get<CommercialDashboard>(`/analytics/commercial?${queryString}`);
      return data;
    },
  });

  const funnelChartData = useMemo(
    () =>
      (dashboard?.funnel ?? []).map((f) => ({
        ...f,
        label: STAGE_LABELS[f.stage] ?? f.stage,
      })),
    [dashboard?.funnel],
  );

  const sourceChartData = useMemo(
    () =>
      (dashboard?.leadsBySource ?? []).map((s, i) => ({
        name: s.source,
        value: s.count,
        fill: PIE_COLORS[i % PIE_COLORS.length],
      })),
    [dashboard?.leadsBySource],
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        title="Analytics comercial"
        description="KPIs, funil, origens, campanhas e visão operacional. Os números refletem o período e os filtros selecionados."
        breadcrumbs={[
          { label: 'Início', href: '/dashboard' },
          { label: 'Analytics comercial' },
        ]}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <LineChart className="h-4 w-4" />}
            Atualizar
          </Button>
        }
      />

      <Card className="mb-6 border-surface-muted p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={preset === 'today' ? 'default' : 'outline'}
              onClick={() => setPreset('today')}
            >
              Hoje
            </Button>
            <Button
              type="button"
              size="sm"
              variant={preset === '7' ? 'default' : 'outline'}
              onClick={() => setPreset('7')}
            >
              7 dias
            </Button>
            <Button
              type="button"
              size="sm"
              variant={preset === '30' ? 'default' : 'outline'}
              onClick={() => setPreset('30')}
            >
              30 dias
            </Button>
            <Button
              type="button"
              size="sm"
              variant={preset === 'month' ? 'default' : 'outline'}
              onClick={() => setPreset('month')}
            >
              Mês atual
            </Button>
            <Button
              type="button"
              size="sm"
              variant={preset === 'custom' ? 'default' : 'outline'}
              onClick={() => setPreset('custom')}
            >
              Personalizado
            </Button>
          </div>
          {preset === 'custom' ? (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-xs text-gray-500">De</Label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Até</Label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9" />
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 border-t border-surface-muted pt-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <Building2 className="h-3.5 w-3.5" />
              Loteamento
            </Label>
            <select
              className="mt-1 flex h-10 w-full rounded-lg border border-surface-muted bg-white px-3 text-sm"
              value={developmentId}
              onChange={(e) => setDevelopmentId(e.target.value)}
            >
              <option value="">Todos</option>
              {(developments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {isAdmin ? (
            <div>
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                <Users className="h-3.5 w-3.5" />
                Corretor
              </Label>
              <select
                className="mt-1 flex h-10 w-full rounded-lg border border-surface-muted bg-white px-3 text-sm"
                value={brokerId}
                onChange={(e) => setBrokerId(e.target.value)}
              >
                <option value="">Todos</option>
                {(brokers ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <Megaphone className="h-3.5 w-3.5" />
              Campanha
            </Label>
            <select
              className="mt-1 flex h-10 w-full rounded-lg border border-surface-muted bg-white px-3 text-sm"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              <option value="">Todas</option>
              {(campaignOptions ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <Filter className="h-3.5 w-3.5" />
              Origem do lead
            </Label>
            <select
              className="mt-1 flex h-10 w-full rounded-lg border border-surface-muted bg-white px-3 text-sm"
              value={leadSource}
              onChange={(e) => setLeadSource(e.target.value)}
            >
              {LEAD_SOURCE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="mb-6 border-red-200 bg-red-50/80 p-4 text-sm text-red-900">
          Não foi possível carregar o analytics. Verifique sua sessão ou tente novamente.
        </Card>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-[320px] items-center justify-center gap-3 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <span className="font-medium">Carregando métricas…</span>
        </div>
      ) : dashboard ? (
        <>
          <p className="mb-4 text-xs text-gray-500">
            Período: {formatDate(dashboard.meta.range.from)} — {formatDate(dashboard.meta.range.to)} ·{' '}
            {dashboard.meta.funnelNote}
          </p>

          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-primary-950">
              <Target className="h-5 w-5 text-accent-600" />
              KPIs principais
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
              <KpiCard
                title="Leads no período"
                value={dashboard.kpis.leadsTotal}
                icon={Users}
                sub={`${dashboard.kpis.leadToVisitRate}% com visita · ${dashboard.kpis.leadToSaleRate}% vendidos`}
              />
              <KpiCard
                title="Visitas (agendadas / realizadas)"
                value={`${dashboard.kpis.visitsScheduled} / ${dashboard.kpis.visitsDone}`}
                icon={CalendarClock}
                sub={`${dashboard.kpis.visitsCanceled} canceladas`}
              />
              <KpiCard
                title="Propostas · Vendas"
                value={`${dashboard.kpis.proposalsTotal} · ${dashboard.kpis.salesTotal}`}
                icon={BarChart3}
              />
              <KpiCard
                title="Taxa de perda (leads)"
                value={`${dashboard.kpis.lossRate}%`}
                icon={TrendingDown}
                sub="Sobre leads do período"
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                title="Lotes disponíveis"
                value={dashboard.kpis.lotsAvailable}
                icon={Building2}
                sub={`Reservados: ${dashboard.kpis.lotsReserved} · Vendidos: ${dashboard.kpis.lotsSold}`}
              />
            </div>
          </section>

          <section className="mb-8 grid gap-6 lg:grid-cols-2">
            <Card className="border-surface-muted p-4 shadow-sm">
              <h3 className="mb-1 font-semibold text-primary-950">Leads por dia</h3>
              <p className="mb-3 text-xs text-gray-500">Entrada de leads no período</p>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboard.leadsSeries}>
                    <defs>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-surface-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                      labelFormatter={(l) => `Data: ${l}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Leads"
                      stroke="#0f766e"
                      fillOpacity={1}
                      fill="url(#colorLeads)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="border-surface-muted p-4 shadow-sm">
              <h3 className="mb-1 font-semibold text-primary-950">Funil (status atual)</h3>
              <p className="mb-3 text-xs text-gray-500">Leads criados no período, agrupados pelo estágio atual</p>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-surface-muted" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                      formatter={(v: number, _n, p) => [`${v} (${p?.payload?.percent ?? 0}%)`, 'Leads']}
                    />
                    <Bar dataKey="count" name="Leads" fill="#0f766e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>

          <section className="mb-8 grid gap-6 lg:grid-cols-2">
            <Card className="border-surface-muted p-4 shadow-sm">
              <h3 className="mb-1 font-semibold text-primary-950">Origem dos leads</h3>
              <div className="h-[280px] w-full">
                {sourceChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={88}
                        paddingAngle={2}
                      >
                        {sourceChartData.map((e, i) => (
                          <Cell key={`c-${i}`} fill={e.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v, 'Leads']} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-full items-center justify-center text-sm text-gray-500">Sem dados de origem</p>
                )}
              </div>
            </Card>

            <Card className="border-surface-muted p-4 shadow-sm">
              <h3 className="mb-3 font-semibold text-primary-950">Visão operacional</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between rounded-lg bg-surface px-3 py-2">
                  <span className="text-gray-600">Leads novos hoje</span>
                  <span className="font-bold text-primary-950">{dashboard.operational.leadsNewToday}</span>
                </li>
                <li className="flex justify-between rounded-lg bg-surface px-3 py-2">
                  <span className="text-gray-600">Sem interação registrada</span>
                  <span className="font-bold text-primary-950">{dashboard.operational.leadsWithoutInteraction}</span>
                </li>
                <li className="flex justify-between rounded-lg bg-amber-50/80 px-3 py-2 text-amber-950">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Sem contato há 7+ dias (abertos)
                  </span>
                  <span className="font-bold">{dashboard.operational.leadsStale}</span>
                </li>
                <li className="flex justify-between rounded-lg bg-surface px-3 py-2">
                  <span className="text-gray-600">Visitas hoje</span>
                  <span className="font-bold text-primary-950">{dashboard.operational.visitsToday}</span>
                </li>
                <li className="flex justify-between rounded-lg bg-surface px-3 py-2">
                  <span className="text-gray-600">Visitas na semana (7 dias)</span>
                  <span className="font-bold text-primary-950">{dashboard.operational.visitsThisWeek}</span>
                </li>
                <li className="flex justify-between rounded-lg bg-red-50/80 px-3 py-2 text-red-900">
                  <span>Campanhas com falha (7 dias)</span>
                  <span className="font-bold">{dashboard.operational.campaignsFailedRecent}</span>
                </li>
              </ul>
            </Card>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-primary-950">
              <TrendingUp className="h-5 w-5 text-accent-600" />
              Rankings
            </h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="overflow-hidden border-surface-muted shadow-sm">
                <div className="border-b border-surface-muted bg-surface/50 px-4 py-3">
                  <h3 className="font-semibold text-primary-950">Corretores</h3>
                  <p className="text-xs text-gray-500">Leads no período (atribuídos)</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-surface-muted text-xs text-gray-500">
                        <th className="px-4 py-2 font-medium">#</th>
                        <th className="px-4 py-2 font-medium">Nome</th>
                        <th className="px-4 py-2 font-medium">Leads</th>
                        <th className="px-4 py-2 font-medium">Visitas</th>
                        <th className="px-4 py-2 font-medium">Vendas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.topBrokers.length ? (
                        dashboard.topBrokers.map((b, i) => (
                          <tr key={b.userId} className="border-b border-surface-muted/80 last:border-0">
                            <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                            <td className="px-4 py-2.5 font-medium text-primary-950">{b.name}</td>
                            <td className="px-4 py-2.5">{b.leads}</td>
                            <td className="px-4 py-2.5">{b.visits}</td>
                            <td className="px-4 py-2.5">{b.sales}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                            Nenhum dado no período
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="overflow-hidden border-surface-muted shadow-sm">
                <div className="border-b border-surface-muted bg-surface/50 px-4 py-3">
                  <h3 className="font-semibold text-primary-950">Loteamentos</h3>
                  <p className="text-xs text-gray-500">Leads com empreendimento definido</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-surface-muted text-xs text-gray-500">
                        <th className="px-4 py-2 font-medium">#</th>
                        <th className="px-4 py-2 font-medium">Empreendimento</th>
                        <th className="px-4 py-2 font-medium">Leads</th>
                        <th className="px-4 py-2 font-medium">Lotes livres</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.topDevelopments.length ? (
                        dashboard.topDevelopments.map((d, i) => (
                          <tr key={d.developmentId} className="border-b border-surface-muted/80 last:border-0">
                            <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                            <td className="px-4 py-2.5 font-medium text-primary-950">
                              {d.name}
                              {d.city ? (
                                <span className="block text-xs font-normal text-gray-500">{d.city}</span>
                              ) : null}
                            </td>
                            <td className="px-4 py-2.5">{d.leads}</td>
                            <td className="px-4 py-2.5">{d.lotsAvailable}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                            Nenhum dado no período
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-primary-950">
              <Megaphone className="h-5 w-5 text-accent-600" />
              Campanhas de marketing
            </h2>
            <Card className="overflow-hidden border-surface-muted shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-muted bg-surface/50 text-xs text-gray-500">
                      <th className="px-4 py-3 font-medium">Campanha</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Publicação</th>
                      <th className="px-4 py-3 font-medium">Leads atribuídos</th>
                      <th className="px-4 py-3 font-medium">Visitas (período)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.campaigns.length ? (
                      dashboard.campaigns.map((c) => (
                        <tr key={c.id} className="border-b border-surface-muted/80 last:border-0">
                          <td className="max-w-[220px] truncate px-4 py-3 font-medium text-primary-950" title={c.title}>
                            {c.title}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{c.status}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {c.publishedAt ? formatDate(c.publishedAt) : '—'}
                          </td>
                          <td className="px-4 py-3">{c.leadsCount}</td>
                          <td className="px-4 py-3">{c.visitsFromLeads}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          Nenhuma campanha listada para seu escopo
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="border-surface-muted p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary-950">{value}</p>
          {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
        </div>
        <div className="rounded-xl bg-primary-50 p-2.5 text-primary-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
