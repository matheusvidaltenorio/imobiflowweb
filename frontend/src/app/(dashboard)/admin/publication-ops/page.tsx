'use client';

import { useQuery } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Summary = {
  generatedAt: string;
  counts: {
    scheduled: number;
    queued: number;
    processing: number;
    published: number;
    failed: number;
    retrying: number;
    canceled: number;
    publishedLast7d: number;
  };
};

export default function PublicationOpsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['campaign-studio', 'publication-ops', 'summary'],
    queryFn: async () => {
      const { data: d } = await api.get<Summary>('/campaign-studio/publication-ops/summary');
      return d;
    },
  });

  const c = data?.counts;

  return (
    <main className="min-h-0 bg-slate-50/30 p-4 sm:p-6 md:p-8 lg:p-10">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Operação de publicações"
          description="Visão consolidada do agendamento e da fila de publicação de campanhas (Meta). Atualiza aproximadamente a cada minuto."
          breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Publicações' }]}
        />

        {isLoading ? (
          <p className="text-sm text-slate-600">Carregando…</p>
        ) : error ? (
          <p className="text-sm text-red-800">Não foi possível carregar o resumo.</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Agendadas" value={c?.scheduled ?? 0} tone="border-sky-200 bg-sky-50/80" />
            <MetricCard label="Na fila" value={c?.queued ?? 0} tone="border-indigo-200 bg-indigo-50/80" />
            <MetricCard label="Processando" value={c?.processing ?? 0} tone="border-amber-200 bg-amber-50/80" />
            <MetricCard label="Em retry" value={c?.retrying ?? 0} tone="border-orange-200 bg-orange-50/80" />
            <MetricCard label="Publicadas (total)" value={c?.published ?? 0} tone="border-emerald-200 bg-emerald-50/80" />
            <MetricCard
              label="Publicadas (7 dias)"
              value={c?.publishedLast7d ?? 0}
              tone="border-emerald-200 bg-white"
            />
            <MetricCard label="Falhas" value={c?.failed ?? 0} tone="border-red-200 bg-red-50/80" />
            <MetricCard label="Canceladas" value={c?.canceled ?? 0} tone="border-slate-200 bg-slate-50/80" />
          </div>
        )}

        <Card className="mt-8 border-primary-100 p-4 text-sm text-slate-600">
          <div className="flex items-start gap-2">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
            <p>
              O processamento roda no servidor (cron). Garanta que <code className="rounded bg-slate-100 px-1">META_*</code>{' '}
              e conexões de página estejam válidas. Detalhes por campanha ficam no estúdio (etapa Publicar) e no histórico
              via API <code className="rounded bg-slate-100 px-1">/campaign-studio/campaigns/:id/publication-op-logs</code>.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className={cn('rounded-2xl border px-4 py-3 shadow-sm', tone)}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-black text-primary-950">{value}</p>
    </div>
  );
}
