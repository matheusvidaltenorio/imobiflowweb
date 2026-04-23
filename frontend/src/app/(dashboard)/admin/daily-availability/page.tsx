'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  History,
  ImageIcon,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  Table2,
  Upload,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/dashboard/page-header';
import { useToast } from '@/components/ui/toaster';
import { cn, formatPrice } from '@/lib/utils';

type SnapshotStatus = 'DISPONIVEL' | 'RESERVADO' | 'VENDIDO' | 'NEGOCIACAO';

const STATUS_ORDER: SnapshotStatus[] = ['DISPONIVEL', 'RESERVADO', 'VENDIDO', 'NEGOCIACAO'];

const STATUS_LABEL: Record<SnapshotStatus, string> = {
  DISPONIVEL: 'Disponível',
  RESERVADO: 'Reservado',
  VENDIDO: 'Vendido',
  NEGOCIACAO: 'Negociação',
};

const STATUS_CLASS: Record<SnapshotStatus, string> = {
  DISPONIVEL: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  RESERVADO: 'bg-amber-100 text-amber-900 border-amber-300',
  VENDIDO: 'bg-slate-200 text-slate-800 border-slate-400',
  NEGOCIACAO: 'bg-indigo-100 text-indigo-900 border-indigo-300',
};

function spTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function catalogStatusToSnapshot(s: string): SnapshotStatus {
  if (s === 'EM_NEGOCIACAO') return 'NEGOCIACAO';
  if (STATUS_ORDER.includes(s as SnapshotStatus)) return s as SnapshotStatus;
  return 'DISPONIVEL';
}

type MapLot = {
  id: string;
  number: string;
  blockId: string;
  blockName: string;
  status: string;
  price: number | null;
  area: number | null;
};

export default function AdminDailyAvailabilityPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [developmentId, setDevelopmentId] = useState('');
  const [date, setDate] = useState(spTodayIso);
  const [blockFilter, setBlockFilter] = useState<string>('');
  const [snapByLot, setSnapByLot] = useState<Record<string, SnapshotStatus>>({});
  const [priceByLot, setPriceByLot] = useState<Record<string, string>>({});

  const { data: developments } = useQuery({
    queryKey: ['developments'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; city: string }>>('/developments');
      return data;
    },
  });

  const { data: mapData, isLoading: mapLoading } = useQuery({
    queryKey: ['lot-map', developmentId, 'admin-daily'],
    queryFn: async () => {
      const { data } = await api.get<{ lots: MapLot[] }>(
        `/lots/development/${developmentId}/map?nearbyRadius=3000&nearbyMode=driving`,
      );
      return data;
    },
    enabled: !!developmentId,
  });

  const { data: currentData, isLoading: currentLoading } = useQuery({
    queryKey: ['daily-availability-current', developmentId, date],
    queryFn: async () => {
      const { data } = await api.get<{
        latest: {
          id: string;
          createdAt: string;
          lotSnapshots: Array<{ lotId: string; status: SnapshotStatus; price?: unknown }>;
        } | null;
      }>(`/daily-availability/developments/${developmentId}/current`, { params: { date } });
      return data;
    },
    enabled: !!developmentId && !!date,
  });

  const lots = mapData?.lots ?? [];

  const blocks = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lots) m.set(l.blockId, l.blockName);
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [lots]);

  useEffect(() => {
    if (!lots.length) return;
    const fromServer = currentData?.latest?.lotSnapshots;
    const next: Record<string, SnapshotStatus> = {};
    const priceNext: Record<string, string> = {};
    for (const l of lots) {
      const row = fromServer?.find((r) => r.lotId === l.id);
      next[l.id] = row ? row.status : catalogStatusToSnapshot(l.status);
      const p = row?.price != null ? Number(row.price) : l.price;
      priceNext[l.id] = p != null && !Number.isNaN(p) ? String(p) : '';
    }
    setSnapByLot(next);
    setPriceByLot(priceNext);
  }, [lots, currentData?.latest]);

  const cycleStatus = useCallback((lotId: string) => {
    setSnapByLot((prev) => {
      const cur = prev[lotId] ?? 'DISPONIVEL';
      const i = STATUS_ORDER.indexOf(cur);
      const next = STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
      return { ...prev, [lotId]: next };
    });
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const snapshots = lots.map((l) => ({
        lotId: l.id,
        status: snapByLot[l.id] ?? 'DISPONIVEL',
        price: priceByLot[l.id] ? parseFloat(priceByLot[l.id].replace(',', '.')) : undefined,
      }));
      const { data } = await api.post(`/daily-availability/developments/${developmentId}/snapshot`, {
        date,
        sourceType: 'MANUAL',
        snapshots,
      });
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Disponibilidade do dia salva', type: 'success' });
      qc.invalidateQueries({ queryKey: ['daily-availability-current'] });
      qc.invalidateQueries({ queryKey: ['daily-availability-today'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao salvar';
      toast({ title: msg, type: 'error' });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/daily-availability/developments/${developmentId}/reset-day`, {
        date,
        sourceType: 'MANUAL',
        notes: 'Reset operacional',
      });
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Dia resetado (todos como disponíveis no snapshot)', type: 'success' });
      qc.invalidateQueries({ queryKey: ['daily-availability-current'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao resetar';
      toast({ title: msg, type: 'error' });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (payload: { blockId?: string; lotIds?: string[]; status: SnapshotStatus }) => {
      const { data } = await api.post(`/daily-availability/developments/${developmentId}/bulk`, {
        date,
        sourceType: 'MANUAL',
        status: payload.status,
        blockId: payload.blockId,
        lotIds: payload.lotIds,
      });
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Atualização em massa registrada', type: 'success' });
      qc.invalidateQueries({ queryKey: ['daily-availability-current'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro na ação em massa';
      toast({ title: msg, type: 'error' });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('date', date);
      const { data } = await api.post(`/daily-availability/developments/${developmentId}/image`, fd);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Imagem da planilha enviada (registro do dia)', type: 'success' });
      qc.invalidateQueries({ queryKey: ['daily-availability-current'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro no upload';
      toast({ title: msg, type: 'error' });
    },
  });

  const { data: historyRows } = useQuery({
    queryKey: ['daily-availability-history', developmentId],
    queryFn: async () => {
      const { data } = await api.get<
        Array<{
          id: string;
          date: string;
          sourceType: string;
          createdAt: string;
          snapshotCount: number;
          createdBy: { name: string };
        }>
      >(`/daily-availability/developments/${developmentId}/history`, { params: { limit: 25 } });
      return data;
    },
    enabled: !!developmentId,
  });

  const filteredLots = useMemo(() => {
    if (!blockFilter) return lots;
    return lots.filter((l) => l.blockId === blockFilter);
  }, [lots, blockFilter]);

  const summary = useMemo(() => {
    let d = 0,
      r = 0,
      v = 0,
      n = 0;
    for (const l of lots) {
      const s = snapByLot[l.id] ?? 'DISPONIVEL';
      if (s === 'DISPONIVEL') d++;
      else if (s === 'RESERVADO') r++;
      else if (s === 'VENDIDO') v++;
      else n++;
    }
    return { d, r, v, n };
  }, [lots, snapByLot]);

  const lastAt = currentData?.latest?.createdAt
    ? new Date(currentData.latest.createdAt).toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Central de disponibilidade diária"
          description="Atualize o estoque do dia por loteamento. O cadastro oficial do lote não é alterado — apenas o snapshot operacional."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border-2 border-primary-200 bg-white p-4 shadow-sm ring-2 ring-primary-100">
            <div className="flex items-center gap-2 text-sm font-bold text-primary-950">
              <Table2 className="h-4 w-4 shrink-0" />
              Atualização manual simples
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Grade de lotes, clique para alternar status e salvar. Fluxo clássico da central.
            </p>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-primary-700">Você está aqui ↓</p>
          </div>
          <Link
            href="/admin/daily-availability/assisted"
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm transition hover:border-primary-300 hover:bg-primary-50/60"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-primary-950">
              <ImageIcon className="h-4 w-4 shrink-0" />
              Atualização por imagem assistida
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Envie a imagem da gestora, use zoom e template visual, confira com conferência obrigatória antes de gravar.
            </p>
            <span className="mt-3 inline-block text-xs font-semibold text-primary-700">Abrir modo assistido →</span>
          </Link>
          <Link
            href="/admin/daily-availability/spreadsheet"
            className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm transition hover:bg-emerald-50"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-950">
              <Upload className="h-4 w-4 shrink-0" />
              Importação por planilha
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Analise e importe arquivo da gestora com mapeamento de colunas reutilizável.
            </p>
            <span className="mt-3 inline-block text-xs font-semibold text-emerald-800">Abrir importação →</span>
          </Link>
        </div>

        <Card className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Loteamento</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-surface-muted bg-white px-3 text-sm"
                value={developmentId}
                onChange={(e) => {
                  setDevelopmentId(e.target.value);
                  setBlockFilter('');
                }}
              >
                <option value="">Selecione…</option>
                {developments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.city}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Data (referência)</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Filtrar quadra</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-surface-muted bg-white px-3 text-sm"
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
                disabled={!developmentId}
              >
                <option value="">Todas</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end gap-2 sm:flex-row sm:items-end">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={!developmentId || mapLoading || currentLoading}
                onClick={() =>
                  qc.invalidateQueries({ queryKey: ['daily-availability-current', developmentId, date] })
                }
              >
                <RefreshCw className="h-4 w-4" />
                Recarregar
              </Button>
            </div>
          </div>

          {developmentId ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-primary-50/60 px-4 py-3 text-sm">
              <span>
                Última atualização: <strong>{lastAt ?? '—'}</strong>
              </span>
              <span className="text-gray-500">|</span>
              <span>
                Disp. <strong className="text-emerald-700">{summary.d}</strong>
              </span>
              <span>
                Res. <strong className="text-amber-700">{summary.r}</strong>
              </span>
              <span>
                Vend. <strong className="text-slate-700">{summary.v}</strong>
              </span>
              <span>
                Neg. <strong className="text-indigo-700">{summary.n}</strong>
              </span>
            </div>
          ) : null}

          {developmentId ? (
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-primary-300 bg-white px-3 py-2 text-sm font-medium text-primary-800 hover:bg-primary-50">
                <Camera className="h-4 w-4" />
                {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Enviar imagem da planilha
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={uploadMutation.isPending}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) uploadMutation.mutate(f);
                  }}
                />
              </label>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={bulkMutation.isPending || !lots.length}
                onClick={() => {
                  if (!confirm('Marcar todos os lotes como DISPONÍVEL no snapshot do dia?')) return;
                  bulkMutation.mutate({ lotIds: lots.map((l) => l.id), status: 'DISPONIVEL' });
                }}
              >
                Todos disponíveis
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={bulkMutation.isPending || !blockFilter}
                onClick={() => {
                  if (!blockFilter) return;
                  if (!confirm('Aplicar VENDIDO a toda a quadra filtrada?')) return;
                  bulkMutation.mutate({ blockId: blockFilter, status: 'VENDIDO' });
                }}
              >
                Quadra → vendidos
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={resetMutation.isPending}
                onClick={() => {
                  if (!confirm('Resetar o snapshot do dia (todos como disponíveis)?')) return;
                  resetMutation.mutate();
                }}
              >
                Resetar dia
              </Button>
              <Button
                type="button"
                variant="brand"
                className="gap-2"
                disabled={saveMutation.isPending || !lots.length}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar snapshot
              </Button>
            </div>
          ) : null}
        </Card>

        {developmentId && (mapLoading || currentLoading) ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
          </div>
        ) : null}

        {developmentId && !mapLoading ? (
          <Card className="overflow-hidden">
            <div className="border-b border-surface-muted bg-surface px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-primary-950">
                <Layers className="h-4 w-4" />
                Lotes ({filteredLots.length})
              </h3>
              <p className="mt-1 text-xs text-gray-600">Clique no status para alternar rapidamente.</p>
            </div>
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="sticky top-0 bg-white shadow-sm">
                  <tr className="border-b border-surface-muted text-xs uppercase text-gray-500">
                    <th className="px-3 py-2">Quadra</th>
                    <th className="px-3 py-2">Lote</th>
                    <th className="px-3 py-2">Preço (snapshot)</th>
                    <th className="px-3 py-2">Status do dia</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLots.map((l) => {
                    const st = snapByLot[l.id] ?? 'DISPONIVEL';
                    return (
                      <tr key={l.id} className="border-b border-surface-muted/80 hover:bg-surface/80">
                        <td className="px-3 py-2 font-medium text-gray-800">{l.blockName}</td>
                        <td className="px-3 py-2">{l.number}</td>
                        <td className="px-3 py-2">
                          <Input
                            className="h-8 max-w-[140px] text-xs"
                            value={priceByLot[l.id] ?? ''}
                            onChange={(e) => setPriceByLot((p) => ({ ...p, [l.id]: e.target.value }))}
                            placeholder={typeof l.price === 'number' ? formatPrice(l.price) : '—'}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => cycleStatus(l.id)}
                            className={cn(
                              'rounded-lg border px-2 py-1 text-xs font-semibold transition hover:opacity-90',
                              STATUS_CLASS[st],
                            )}
                          >
                            {STATUS_LABEL[st]}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {developmentId ? (
          <Card className="p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-primary-950">
              <History className="h-4 w-4" />
              Histórico recente
            </h3>
            {!historyRows?.length ? (
              <p className="text-sm text-gray-600">Nenhum registro ainda.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {historyRows.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-muted px-3 py-2"
                  >
                    <span>
                      {new Date(h.date).toLocaleDateString('pt-BR')} · {h.sourceType} · {h.snapshotCount} lotes
                    </span>
                    <span className="text-gray-600">
                      {new Date(h.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} —{' '}
                      {h.createdBy.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
      </div>
    </main>
  );
}
