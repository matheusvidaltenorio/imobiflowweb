'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ExternalLink, Loader2, MessageCircle, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/dashboard/page-header';
import { LotInterestModal } from '@/components/lotes/lot-interest-modal';
import { cn, formatPrice } from '@/lib/utils';

type SnapshotStatus = 'DISPONIVEL' | 'RESERVADO' | 'VENDIDO' | 'NEGOCIACAO';

const STATUS_LABEL: Record<SnapshotStatus, string> = {
  DISPONIVEL: 'Disponível',
  RESERVADO: 'Reservado',
  VENDIDO: 'Vendido',
  NEGOCIACAO: 'Negociação',
};

const STATUS_CLASS: Record<SnapshotStatus, string> = {
  DISPONIVEL: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  RESERVADO: 'bg-amber-50 text-amber-900 border-amber-200',
  VENDIDO: 'bg-slate-100 text-slate-800 border-slate-300',
  NEGOCIACAO: 'bg-indigo-50 text-indigo-900 border-indigo-200',
};

function spTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function DisponiveisHojePage() {
  const searchParams = useSearchParams();
  const [developmentId, setDevelopmentId] = useState('');

  useEffect(() => {
    const d = searchParams.get('developmentId');
    if (d) setDevelopmentId(d);
  }, [searchParams]);
  const [blockId, setBlockId] = useState('');
  const [date, setDate] = useState(spTodayIso);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minArea, setMinArea] = useState('');
  const [maxArea, setMaxArea] = useState('');
  const [onlyAvail, setOnlyAvail] = useState(true);
  const [leadLot, setLeadLot] = useState<{ id: string; label: string } | null>(null);

  const { data: developments } = useQuery({
    queryKey: ['developments'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; city: string }>>('/developments');
      return data;
    },
  });

  const { data: blocks } = useQuery({
    queryKey: ['blocks', developmentId],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string }>>(
        `/blocks/development/${developmentId}`,
      );
      return data;
    },
    enabled: !!developmentId,
  });

  const { data: todayData, isLoading } = useQuery({
    queryKey: [
      'daily-availability-today',
      developmentId,
      blockId,
      date,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
    ],
    queryFn: async () => {
      const { data } = await api.get<{
        date: string;
        developments: Array<{
          development: { id: string; name: string; city: string };
          dailyAvailability: {
            id: string;
            createdAt: string;
            sourceType: string;
            sourceFileUrl?: string | null;
            createdBy: { name: string };
          };
          summary: {
            disponiveis: number;
            reservados: number;
            vendidos: number;
            negociacao: number;
          };
          lots: Array<{
            lotId: string;
            number: string;
            blockId: string;
            blockName: string;
            dailyStatus: SnapshotStatus;
            effectivePrice: number | null;
            areaM2: number | null;
          }>;
        }>;
      }>('/daily-availability/today', {
        params: {
          developmentId: developmentId || undefined,
          blockId: blockId || undefined,
          date,
          minPrice: minPrice ? parseFloat(minPrice.replace(',', '.')) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice.replace(',', '.')) : undefined,
          minArea: minArea ? parseFloat(minArea.replace(',', '.')) : undefined,
          maxArea: maxArea ? parseFloat(maxArea.replace(',', '.')) : undefined,
        },
      });
      return data;
    },
  });

  const lastUpdate = todayData?.developments?.[0]?.dailyAvailability?.createdAt;

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Disponíveis hoje"
          description="Snapshot operacional do dia (América/São Paulo). Reflete a última atualização registrada pela central — não altera o cadastro oficial do lote."
        />

        <Card className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Loteamento</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-surface-muted bg-white px-3 text-sm"
                value={developmentId}
                onChange={(e) => {
                  setDevelopmentId(e.target.value);
                  setBlockId('');
                }}
              >
                <option value="">Todos com atualização</option>
                {developments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Quadra</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-surface-muted bg-white px-3 text-sm"
                value={blockId}
                onChange={(e) => setBlockId(e.target.value)}
                disabled={!developmentId}
              >
                <option value="">Todas</option>
                {blocks?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={onlyAvail}
                  onChange={(e) => setOnlyAvail(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Somente disponíveis
              </label>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Preço mín.</Label>
              <Input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="R$" />
            </div>
            <div className="space-y-2">
              <Label>Preço máx.</Label>
              <Input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="R$" />
            </div>
            <div className="space-y-2">
              <Label>Área mín. (m²)</Label>
              <Input value={minArea} onChange={(e) => setMinArea(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Área máx. (m²)</Label>
              <Input value={maxArea} onChange={(e) => setMaxArea(e.target.value)} />
            </div>
          </div>

          {lastUpdate ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary-50/70 px-3 py-2 text-sm text-primary-900">
              <CalendarClock className="h-4 w-4 shrink-0" />
              Última atualização:{' '}
              <strong>
                {new Date(lastUpdate).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </strong>
            </div>
          ) : null}
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
          </div>
        ) : !todayData?.developments?.length ? (
          <Card className="p-8 text-center text-gray-600">
            Nenhuma atualização diária para os filtros selecionados. Peça ao admin para registrar a central do dia.
          </Card>
        ) : (
          todayData.developments.map((group) => (
            <Card key={group.development.id} className="overflow-hidden">
              <div className="border-b border-surface-muted bg-surface px-4 py-3">
                <h2 className="text-lg font-bold text-primary-950">{group.development.name}</h2>
                <p className="text-sm text-gray-600">{group.development.city}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-700">
                  <span>
                    Disp.: <strong className="text-emerald-700">{group.summary.disponiveis}</strong>
                  </span>
                  <span>
                    Res.: <strong>{group.summary.reservados}</strong>
                  </span>
                  <span>
                    Vend.: <strong>{group.summary.vendidos}</strong>
                  </span>
                  <span>
                    Neg.: <strong>{group.summary.negociacao}</strong>
                  </span>
                </div>
              </div>
              <div className="max-h-[480px] overflow-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="sticky top-0 bg-white shadow-sm">
                    <tr className="border-b border-surface-muted text-xs uppercase text-gray-500">
                      <th className="px-3 py-2">Quadra</th>
                      <th className="px-3 py-2">Lote</th>
                      <th className="px-3 py-2">m²</th>
                      <th className="px-3 py-2">Preço</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.lots
                      .filter((l) => !onlyAvail || l.dailyStatus === 'DISPONIVEL')
                      .map((l) => (
                        <tr key={l.lotId} className="border-b border-surface-muted/80 hover:bg-surface/80">
                          <td className="px-3 py-2 font-medium">{l.blockName}</td>
                          <td className="px-3 py-2">{l.number}</td>
                          <td className="px-3 py-2">{l.areaM2 != null ? l.areaM2.toFixed(0) : '—'}</td>
                          <td className="px-3 py-2">
                            {l.effectivePrice != null ? formatPrice(l.effectivePrice) : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                'inline-block rounded-md border px-2 py-0.5 text-xs font-semibold',
                                STATUS_CLASS[l.dailyStatus],
                              )}
                            >
                              {STATUS_LABEL[l.dailyStatus]}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 px-2 text-xs"
                                onClick={() =>
                                  setLeadLot({
                                    id: l.lotId,
                                    label: `${group.development.name} · ${l.blockName} · ${l.number}`,
                                  })
                                }
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                                Lead
                              </Button>
                              <Link href={`/visits/new?lotId=${encodeURIComponent(l.lotId)}`}>
                                <Button type="button" variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs">
                                  Visita
                                </Button>
                              </Link>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 px-2 text-xs"
                                onClick={() => {
                                  const text = `Olá! Tenho interesse no lote ${l.number} (${l.blockName}) em ${group.development.name}.`;
                                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                }}
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                Zap
                              </Button>
                              <Link href="/publication" className="inline-flex">
                                <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Pub.
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))
        )}

        {leadLot ? (
          <LotInterestModal
            open={!!leadLot}
            onOpenChange={(o) => !o && setLeadLot(null)}
            lotId={leadLot.id}
            lotLabel={leadLot.label}
          />
        ) : null}
      </div>
    </main>
  );
}
