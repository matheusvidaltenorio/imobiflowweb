'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Copy,
  ExternalLink,
  Filter,
  Loader2,
  Megaphone,
  Pencil,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import { cn, formatDate } from '@/lib/utils';

type CampaignRow = {
  id: string;
  title: string;
  status: string;
  campaignKind: string;
  commercialObjective: string | null;
  createdAt: string;
  scheduledPublishAt: string | null;
  development: { name: string; city: string } | null;
  lot: { number: string } | null;
  user: { id: string; name: string; email: string };
  _count: { assets: number; copies: number };
  targets: Array<{ platform: string; status: string }>;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  READY: 'Pronta',
  SCHEDULED: 'Agendada',
  PUBLISHED: 'Publicada',
  FAILED: 'Falhou',
  ARCHIVED: 'Arquivada',
};

const KIND_LABEL: Record<string, string> = {
  LOTEMENTO: 'Loteamento',
  LOTE: 'Lote',
  INSTITUCIONAL: 'Institucional',
  PROMOCAO: 'Promoção',
  REENGAJAMENTO: 'Reengajamento',
};

const OBJ_LABEL: Record<string, string> = {
  GERAR_LEADS: 'Gerar leads',
  GERAR_VISITAS: 'Gerar visitas',
  DIVULGAR_LOTES: 'Divulgar lotes',
  FORTALECER_MARCA: 'Fortalecer marca',
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-800';
    case 'READY':
      return 'bg-sky-100 text-sky-900';
    case 'SCHEDULED':
      return 'bg-violet-100 text-violet-900';
    case 'PUBLISHED':
      return 'bg-emerald-100 text-emerald-900';
    case 'FAILED':
      return 'bg-red-100 text-red-900';
    case 'ARCHIVED':
      return 'bg-gray-200 text-gray-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default function CampaignsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [status, setStatus] = useState('');
  const [campaignKind, setCampaignKind] = useState('');
  const [developmentId, setDevelopmentId] = useState('');
  const [lotId, setLotId] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (status) p.status = status;
    if (campaignKind) p.campaignKind = campaignKind;
    if (developmentId) p.developmentId = developmentId;
    if (lotId) p.lotId = lotId;
    if (user?.role === 'ADMIN' && userIdFilter) p.userId = userIdFilter;
    if (from) p.from = from;
    if (to) p.to = to;
    return p;
  }, [status, campaignKind, developmentId, lotId, userIdFilter, from, to, user?.role]);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaign-studio', 'campaigns', 'list', queryParams],
    queryFn: async () => {
      const { data } = await api.get<CampaignRow[]>('/campaign-studio/campaigns', { params: queryParams });
      return data;
    },
  });

  const { data: developments = [] } = useQuery({
    queryKey: ['developments'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; city: string }>>('/developments');
      return data;
    },
  });

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<CampaignRow>(`/campaign-studio/campaigns/${id}/duplicate`, {});
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaign-studio'] });
      toast({ title: 'Campanha duplicada', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao duplicar', type: 'error' }),
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/campaign-studio/campaigns/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaign-studio'] });
      toast({ title: 'Campanha arquivada', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao arquivar', type: 'error' }),
  });

  return (
    <main className="min-h-0 bg-slate-50/30 p-4 sm:p-6 md:p-8 lg:p-10">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Campanhas comerciais"
          description="Central de campanhas para loteamentos e lotes: rascunhos, legendas, mídias e preparação para redes sociais."
          breadcrumbs={[{ label: 'Campanhas' }]}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/publication"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent-500 px-5 text-sm font-bold text-white shadow-cta transition hover:bg-accent-600"
              >
                <Megaphone className="h-4 w-4" />
                Nova campanha
              </Link>
              <Link
                href="/publication?institutional=1"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-primary-200 bg-white px-4 text-sm font-bold text-primary-900 shadow-sm hover:bg-primary-50"
              >
                Institucional
              </Link>
            </div>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 font-semibold"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-slate-600"
            onClick={() => {
              setStatus('');
              setCampaignKind('');
              setDevelopmentId('');
              setLotId('');
              setUserIdFilter('');
              setFrom('');
              setTo('');
            }}
          >
            Limpar
          </Button>
        </div>

        {filtersOpen ? (
          <Card className="mb-6 border-slate-200 p-4 shadow-sm sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Status</Label>
                <select
                  className="mt-1 flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Todos</option>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Tipo</Label>
                <select
                  className="mt-1 flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  value={campaignKind}
                  onChange={(e) => setCampaignKind(e.target.value)}
                >
                  <option value="">Todos</option>
                  {Object.entries(KIND_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-slate-500">Loteamento</Label>
                <select
                  className="mt-1 flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  value={developmentId}
                  onChange={(e) => setDevelopmentId(e.target.value)}
                >
                  <option value="">Todos</option>
                  {developments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.city}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="flt-lot" className="text-xs font-bold uppercase text-slate-500">
                  ID do lote (filtro exato)
                </Label>
                <Input
                  id="flt-lot"
                  className="mt-1 h-10"
                  placeholder="cuid…"
                  value={lotId}
                  onChange={(e) => setLotId(e.target.value)}
                />
              </div>
              {user?.role === 'ADMIN' ? (
                <div>
                  <Label htmlFor="flt-user" className="text-xs font-bold uppercase text-slate-500">
                    ID do criador
                  </Label>
                  <Input
                    id="flt-user"
                    className="mt-1 h-10 font-mono text-xs"
                    placeholder="user id"
                    value={userIdFilter}
                    onChange={(e) => setUserIdFilter(e.target.value)}
                  />
                </div>
              ) : null}
              <div>
                <Label htmlFor="flt-from" className="text-xs font-bold uppercase text-slate-500">
                  De
                </Label>
                <Input
                  id="flt-from"
                  type="date"
                  className="mt-1 h-10"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="flt-to" className="text-xs font-bold uppercase text-slate-500">
                  Até
                </Label>
                <Input
                  id="flt-to"
                  type="date"
                  className="mt-1 h-10"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>
          </Card>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando campanhas…
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="border-dashed border-slate-200 p-10 text-center text-slate-600">
            Nenhuma campanha encontrada.{' '}
            <Link href="/publication" className="font-semibold text-primary-700 underline">
              Abrir centro de publicação
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((c) => (
              <Card
                key={c.id}
                className="flex flex-col border-slate-200/80 p-5 shadow-sm transition hover:border-primary-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="line-clamp-2 font-bold text-primary-950">{c.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {c.user.name} · {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase',
                      statusBadgeClass(c.status),
                    )}
                  >
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                    {KIND_LABEL[c.campaignKind] ?? c.campaignKind}
                  </span>
                  {c.commercialObjective ? (
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                      {OBJ_LABEL[c.commercialObjective] ?? c.commercialObjective}
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 text-sm text-slate-700">
                  {c.development ? (
                    <>
                      <span className="font-semibold">{c.development.name}</span>
                      <span className="text-slate-500"> · {c.development.city}</span>
                    </>
                  ) : (
                    <span className="text-slate-500 italic">Sem loteamento vinculado</span>
                  )}
                  {c.lot ? (
                    <span className="block text-slate-600">
                      Lote <strong>#{c.lot.number}</strong>
                    </span>
                  ) : null}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Mídias: {c._count.assets} · Legendas: {c._count.copies}
                  {c.scheduledPublishAt ? (
                    <span className="ml-2 text-violet-700">
                      Agend.: {formatDate(c.scheduledPublishAt)}
                    </span>
                  ) : null}
                </p>

                <div className="mt-2 flex flex-wrap gap-1">
                  {c.targets.slice(0, 4).map((t) => (
                    <span
                      key={t.platform}
                      className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-mono text-slate-600"
                    >
                      {t.platform.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {c.targets.length > 4 ? (
                    <span className="text-[9px] text-slate-400">+{c.targets.length - 4}</span>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <Link
                    href={`/publication?resume=${encodeURIComponent(c.id)}`}
                    className="inline-flex h-9 items-center gap-1 rounded-lg bg-accent-500 px-3.5 text-xs font-bold text-white shadow-sm hover:bg-accent-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={duplicate.isPending}
                    onClick={() => duplicate.mutate(c.id)}
                  >
                    {duplicate.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Duplicar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-amber-800"
                    disabled={archive.isPending}
                    onClick={() => {
                      if (confirm('Arquivar esta campanha?')) archive.mutate(c.id);
                    }}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Arquivar
                  </Button>
                  <Link
                    href={`/publication?resume=${encodeURIComponent(c.id)}#prev`}
                    className="inline-flex h-9 items-center gap-1 rounded-lg px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir prévia
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
