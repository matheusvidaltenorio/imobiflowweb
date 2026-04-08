'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ExternalLink,
  Loader2,
  MapPinned,
  MessageCircle,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice, cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/dashboard/page-header';
import { useToast } from '@/components/ui/toaster';

type RankingItem = {
  position: number;
  id: string;
  number: string;
  blockId: string;
  blockName: string;
  development: { id: string; name: string; city: string; state: string | null };
  price: number | null;
  saleScore: number | null;
  saleClassification: string | null;
  saleScoreReason: string | null;
  manualHighlight: boolean;
  commercialTags: string[];
  suggestedAction: string;
  viewCount: number;
  contactCount: number;
};

const FILTERS: { value: string; label: string }[] = [
  { value: 'melhores', label: 'Melhores para vender agora' },
  { value: 'campeoes', label: 'Campeões de venda' },
  { value: 'mais_procurados', label: 'Mais procurados' },
  { value: 'mais_baratos', label: 'Mais baratos' },
  { value: 'encalhados', label: 'Encalhados / atenção' },
  { value: 'recentes', label: 'Recém cadastrados' },
  { value: 'alta_conversao', label: 'Alta conversão' },
  { value: 'baixa_conversao', label: 'Baixa conversão' },
];

function scoreBarClass(score: number | null) {
  if (score == null) return 'bg-gray-200';
  if (score >= 85) return 'bg-success-500';
  if (score >= 70) return 'bg-primary-600';
  if (score >= 50) return 'bg-warning-500';
  if (score >= 30) return 'bg-warning-600/80';
  return 'bg-danger-500/90';
}

function buildShareWhatsApp(item: RankingItem): string {
  const msg = `Olá, tenho interesse no lote ${item.number}, quadra ${item.blockName}, do loteamento ${item.development.name}.`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export default function MelhoresLotesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState('melhores');
  const [developmentId, setDevelopmentId] = useState<string>('');

  const { data: developments } = useQuery({
    queryKey: ['developments-list-ranking'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; city: string }>>('/developments');
      return data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['lots-ranking', filter, developmentId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (developmentId) params.set('developmentId', developmentId);
      if (filter) params.set('filter', filter);
      const q = params.toString();
      const { data: res } = await api.get<{ filter: string; items: RankingItem[] }>(
        `/lots/ranking${q ? `?${q}` : ''}`,
      );
      return res;
    },
  });

  const toggleHighlight = useMutation({
    mutationFn: ({ id, manualHighlight }: { id: string; manualHighlight: boolean }) =>
      api.patch(`/lots/${id}`, { manualHighlight }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lots-ranking'] });
      toast({ title: 'Destaque atualizado', type: 'success' });
    },
    onError: () => {
      toast({ title: 'Não foi possível atualizar o destaque', type: 'error' });
    },
  });

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Melhores lotes para vender"
          description="Ranking automático por score comercial (preço, interesse, tempo em estoque e destaque manual). Use os filtros para priorizar ações do dia."
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Inteligência comercial' },
          ]}
          actions={
            <Link href="/lots">
              <Button type="button" variant="outline" className="gap-2">
                <MapPinned className="h-4 w-4" />
                Inventário de lotes
              </Button>
            </Link>
          }
        />

        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-primary-100/90 bg-white p-4 shadow-sm md:flex-row md:flex-wrap md:items-end">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Filtro inteligente
            </label>
            <select
              className="w-full rounded-xl border border-surface-muted bg-[#F5F6F8] px-3 py-2.5 text-sm font-medium text-primary-950"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Loteamento (opcional)
            </label>
            <select
              className="w-full rounded-xl border border-surface-muted bg-[#F5F6F8] px-3 py-2.5 text-sm font-medium text-primary-950"
              value={developmentId}
              onChange={(e) => setDevelopmentId(e.target.value)}
            >
              <option value="">Todos na sua carteira</option>
              {(developments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.city}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <Card className="border-dashed border-surface-muted bg-[#F5F6F8]/60 p-10 text-center">
            <TrendingUp className="mx-auto h-10 w-10 text-primary-300" />
            <p className="mt-4 font-bold text-primary-950">Nenhum lote neste filtro</p>
            <p className="mt-1 text-sm text-gray-600">
              Ajuste o loteamento ou aguarde o recálculo do ranking (também roda a cada hora).
            </p>
            <Link href="/lots" className="mt-4 inline-block">
              <Button type="button" variant="brand">
                Ir para quadras e lotes
              </Button>
            </Link>
          </Card>
        ) : (
          <ul className="space-y-4">
            {data.items.map((item) => {
              const score = item.saleScore ?? 0;
              const busy =
                toggleHighlight.isPending && toggleHighlight.variables?.id === item.id;
              return (
                <li key={item.id}>
                  <Card className="overflow-hidden border-l-4 border-l-primary-600 shadow-card transition hover:shadow-card-hover">
                    <div className="flex flex-col gap-4 p-5 md:flex-row md:items-stretch">
                      <div className="flex w-full shrink-0 flex-col items-center justify-center rounded-xl bg-primary-50 px-4 py-3 md:w-24">
                        <span className="text-[10px] font-bold uppercase text-primary-700">Pos.</span>
                        <span className="text-3xl font-black tabular-nums text-primary-900">
                          {item.position}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start gap-2">
                          <h3 className="text-lg font-bold text-primary-950">
                            Lote #{item.number}{' '}
                            <span className="font-semibold text-gray-600">
                              — Quadra {item.blockName}
                            </span>
                          </h3>
                          {item.commercialTags.includes('CAMPEAO_VENDA') ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-bold uppercase text-success-800">
                              <Sparkles className="h-3 w-3" />
                              Campeão
                            </span>
                          ) : null}
                          {item.commercialTags.includes('NECESITA_ATENCAO_COMERCIAL') ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-danger-100 px-2 py-0.5 text-[10px] font-bold uppercase text-danger-800">
                              Atenção comercial
                            </span>
                          ) : null}
                          {item.manualHighlight ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 px-2 py-0.5 text-[10px] font-bold uppercase text-warning-900">
                              <Star className="h-3 w-3 fill-current" />
                              Destaque
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          {item.development.name}
                          {item.development.city ? ` · ${item.development.city}` : ''}
                        </p>
                        <p className="mt-2 text-base font-bold text-primary-800">
                          {formatPrice(item.price ?? 0)}
                        </p>
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="font-bold text-gray-600">Score de venda</span>
                            <span className="tabular-nums font-black text-primary-900">
                              {item.saleScore != null ? Math.round(item.saleScore) : '—'}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                            <div
                              className={cn('h-2 rounded-full transition-all', scoreBarClass(item.saleScore))}
                              style={{ width: `${item.saleScore != null ? Math.min(100, score) : 0}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs font-bold text-primary-800">
                            {item.saleClassification ?? '—'}
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-gray-700">{item.saleScoreReason}</p>
                        <p className="mt-2 rounded-lg bg-[#F5F6F8] px-3 py-2 text-xs font-medium text-primary-900">
                          <span className="font-bold">Sugestão: </span>
                          {item.suggestedAction}
                        </p>
                        <p className="mt-2 text-[11px] text-gray-500">
                          {item.viewCount} visualizações · {item.contactCount} contatos (leads)
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 md:flex-col md:justify-center">
                        <Link
                          href={`/lots/lots/edit/${item.id}?development=${item.development.id}&block=${item.blockId}`}
                        >
                          <Button type="button" variant="brand" size="sm" className="w-full gap-1.5">
                            Detalhes
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <a
                          href={buildShareWhatsApp(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            buttonVariants({ variant: 'outline', size: 'sm' }),
                            'w-full gap-1.5 no-underline',
                          )}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                        <Button
                          type="button"
                          variant={item.manualHighlight ? 'secondary' : 'outline'}
                          size="sm"
                          className="w-full gap-1.5"
                          disabled={busy}
                          onClick={() =>
                            toggleHighlight.mutate({
                              id: item.id,
                              manualHighlight: !item.manualHighlight,
                            })
                          }
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Star className={cn('h-3.5 w-3.5', item.manualHighlight && 'fill-current')} />
                          )}
                          {item.manualHighlight ? 'Remover destaque' : 'Destacar'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
