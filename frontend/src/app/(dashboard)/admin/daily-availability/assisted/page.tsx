'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  ImageIcon,
  LayoutGrid,
  List,
  Loader2,
  MapPin,
  Save,
  Sparkles,
  Undo2,
  Upload,
} from 'lucide-react';
import { api } from '@/lib/api';
import { AssistedImageViewer } from '@/components/daily-availability/assisted-image-viewer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/dashboard/page-header';
import { useToast } from '@/components/ui/toaster';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

function previousCalendarDayIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
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

type MapPoint = { xNorm: number; yNorm: number; wNorm?: number; hNorm?: number; refImageWidth?: number; refImageHeight?: number };

export default function AssistedDailyAvailabilityPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [developmentId, setDevelopmentId] = useState('');
  const [date, setDate] = useState(spTodayIso);
  const [blockFilter, setBlockFilter] = useState('');
  const [snapByLot, setSnapByLot] = useState<Record<string, SnapshotStatus>>({});
  const [priceByLot, setPriceByLot] = useState<Record<string, string>>({});
  const [mapByLot, setMapByLot] = useState<Record<string, MapPoint>>({});
  const [pendingMapLotId, setPendingMapLotId] = useState<string | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set());
  const [layoutMode, setLayoutMode] = useState<'split' | 'image' | 'list'>('split');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  /** Snapshot de status ao carregar a tela (para medir alterações da sessão antes de salvar). */
  const [sessionBaseline, setSessionBaseline] = useState<Record<string, SnapshotStatus> | null>(null);
  const undoStack = useRef<{ lotId: string; prev: SnapshotStatus }[]>([]);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const prevDayIso = useMemo(() => previousCalendarDayIso(date), [date]);

  const { data: developments } = useQuery({
    queryKey: ['developments'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; city: string }>>('/developments');
      return data;
    },
  });

  const { data: mapData, isLoading: mapLoading } = useQuery({
    queryKey: ['lot-map', developmentId, 'assisted-daily'],
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
          sourceFileUrl?: string | null;
          lotSnapshots: Array<{ lotId: string; status: SnapshotStatus; price?: unknown }>;
        } | null;
      }>(`/daily-availability/developments/${developmentId}/current`, { params: { date } });
      return data;
    },
    enabled: !!developmentId && !!date,
  });

  const { data: prevDayData } = useQuery({
    queryKey: ['daily-availability-current', developmentId, prevDayIso, 'prev'],
    queryFn: async () => {
      const { data } = await api.get<{
        latest: { lotSnapshots: Array<{ lotId: string; status: SnapshotStatus }> } | null;
      }>(`/daily-availability/developments/${developmentId}/current`, { params: { date: prevDayIso } });
      return data;
    },
    enabled: !!developmentId && !!date,
  });

  const { data: latestBeforeData, isLoading: latestBeforeLoading } = useQuery({
    queryKey: ['daily-availability-latest-before', developmentId, date],
    queryFn: async () => {
      const { data } = await api.get<{
        baseline: {
          date: string;
          lotSnapshots: Array<{ lotId: string; status: SnapshotStatus }>;
        } | null;
      }>(`/daily-availability/developments/${developmentId}/latest-before`, { params: { before: date } });
      return data;
    },
    enabled: !!developmentId && !!date,
  });

  const { data: imageMapRows, isLoading: mapRowsLoading } = useQuery({
    queryKey: ['lot-image-map', developmentId],
    queryFn: async () => {
      const { data } = await api.get<
        Array<{
          lotId: string;
          xNorm: string | number;
          yNorm: string | number;
          wNorm?: string | number | null;
          hNorm?: string | number | null;
          refImageWidth?: number | null;
          refImageHeight?: number | null;
        }>
      >(`/daily-availability/developments/${developmentId}/image-map`);
      return data;
    },
    enabled: !!developmentId,
  });

  const lots = mapData?.lots ?? [];

  const blocks = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lots) m.set(l.blockId, l.blockName);
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [lots]);

  const baselineComparison = useMemo(() => {
    if (latestBeforeData?.baseline?.lotSnapshots?.length) {
      return {
        label: `vs última atualização (${new Date(latestBeforeData.baseline.date).toLocaleDateString('pt-BR')})`,
        source: 'LATEST_BEFORE_REF' as const,
      };
    }
    return {
      label: `vs dia anterior (${new Date(prevDayIso).toLocaleDateString('pt-BR')})`,
      source: 'PREV_CALENDAR_DAY_FALLBACK' as const,
    };
  }, [latestBeforeData?.baseline, prevDayIso]);

  const prevStatusByLot = useMemo(() => {
    const m = new Map<string, SnapshotStatus>();
    const snaps =
      latestBeforeData?.baseline?.lotSnapshots ??
      prevDayData?.latest?.lotSnapshots ??
      [];
    for (const s of snaps) {
      m.set(s.lotId, s.status);
    }
    return m;
  }, [latestBeforeData?.baseline?.lotSnapshots, prevDayData?.latest?.lotSnapshots]);

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
    setSessionBaseline({ ...next });
    setPriceByLot(priceNext);
    setReviewed(new Set());
    setSelectedLotId(null);
    setPendingMapLotId(null);
  }, [lots, currentData?.latest]);

  useEffect(() => {
    setLocalImageUrl(null);
  }, [developmentId, date]);

  useEffect(() => {
    setMapByLot({});
  }, [developmentId]);

  useEffect(() => {
    if (imageMapRows === undefined) return;
    const next: Record<string, MapPoint> = {};
    for (const r of imageMapRows) {
      next[r.lotId] = {
        xNorm: Number(r.xNorm),
        yNorm: Number(r.yNorm),
        wNorm: r.wNorm != null ? Number(r.wNorm) : undefined,
        hNorm: r.hNorm != null ? Number(r.hNorm) : undefined,
        refImageWidth: r.refImageWidth ?? undefined,
        refImageHeight: r.refImageHeight ?? undefined,
      };
    }
    setMapByLot(next);
  }, [imageMapRows]);

  const imageUrl = localImageUrl ?? currentData?.latest?.sourceFileUrl ?? null;

  const sortedLotIds = useMemo(() => {
    return [...lots]
      .sort((a, b) => a.blockName.localeCompare(b.blockName) || a.number.localeCompare(b.number, undefined, { numeric: true }))
      .map((l) => l.id);
  }, [lots]);

  const changedFromSessionCount = useMemo(() => {
    if (!sessionBaseline || !lots.length) return 0;
    let n = 0;
    for (const l of lots) {
      const cur = snapByLot[l.id] ?? 'DISPONIVEL';
      const orig = sessionBaseline[l.id] ?? 'DISPONIVEL';
      if (cur !== orig) n++;
    }
    return n;
  }, [lots, snapByLot, sessionBaseline]);

  /** Sugestão assistida: lotes com ponto no template ainda sem interação nesta sessão (sem OCR; só ordenação). */
  const suggestedReviewLotIds = useMemo(() => {
    return sortedLotIds.filter((id) => mapByLot[id] && !reviewed.has(id)).slice(0, 14);
  }, [sortedLotIds, mapByLot, reviewed]);

  const setStatus = useCallback(
    (lotId: string, status: SnapshotStatus) => {
      setSnapByLot((prev) => {
        const was = prev[lotId] ?? 'DISPONIVEL';
        if (was !== status) undoStack.current.push({ lotId, prev: was });
        return { ...prev, [lotId]: status };
      });
      setReviewed((r) => new Set(r).add(lotId));
    },
    [],
  );

  const undoLast = useCallback(() => {
    const last = undoStack.current.pop();
    if (!last) return;
    setSnapByLot((prev) => ({ ...prev, [last.lotId]: last.prev }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoLast();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undoLast]);

  const goNextLot = useCallback(() => {
    if (!selectedLotId) {
      const first = sortedLotIds[0];
      if (first) setSelectedLotId(first);
      return;
    }
    const i = sortedLotIds.indexOf(selectedLotId);
    if (i >= 0 && i < sortedLotIds.length - 1) {
      const nid = sortedLotIds[i + 1];
      setSelectedLotId(nid);
      rowRefs.current[nid]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedLotId, sortedLotIds]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('date', date);
      const { data } = await api.post<{ sourceFileUrl?: string | null }>(
        `/daily-availability/developments/${developmentId}/image`,
        fd,
      );
      return data;
    },
    onSuccess: (data) => {
      const url = data?.sourceFileUrl ?? null;
      if (url) setLocalImageUrl(url);
      toast({ title: 'Imagem registrada para o dia', type: 'success' });
      qc.invalidateQueries({ queryKey: ['daily-availability-current', developmentId, date] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro no upload';
      toast({ title: msg, type: 'error' });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(mapByLot).map(([lotId, p]) => ({
        lotId,
        xNorm: p.xNorm,
        yNorm: p.yNorm,
        wNorm: p.wNorm,
        hNorm: p.hNorm,
        refImageWidth: p.refImageWidth,
        refImageHeight: p.refImageHeight,
      }));
      const { data } = await api.put(`/daily-availability/developments/${developmentId}/image-map`, { items });
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Template visual salvo', type: 'success' });
      qc.invalidateQueries({ queryKey: ['lot-image-map', developmentId] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao salvar template';
      toast({ title: msg, type: 'error' });
    },
  });

  const saveSnapshotMutation = useMutation({
    mutationFn: async () => {
      const snapshots = lots.map((l) => ({
        lotId: l.id,
        status: snapByLot[l.id] ?? 'DISPONIVEL',
        price: priceByLot[l.id] ? parseFloat(priceByLot[l.id].replace(',', '.')) : undefined,
      }));
      let c = { d: 0, r: 0, v: 0, n: 0 };
      for (const l of lots) {
        const s = snapByLot[l.id] ?? 'DISPONIVEL';
        if (s === 'DISPONIVEL') c.d++;
        else if (s === 'RESERVADO') c.r++;
        else if (s === 'VENDIDO') c.v++;
        else c.n++;
      }
      const { data } = await api.post(`/daily-availability/developments/${developmentId}/snapshot`, {
        date,
        sourceType: imageUrl ? 'IMAGE' : 'MANUAL',
        sourceFileUrl: imageUrl ?? undefined,
        snapshots,
        assistedConfirmed: true,
        assistedMetadata: {
          mode: 'ASSISTED',
          flow: 'IMAGE_ASSISTED',
          imageUrl: imageUrl ?? undefined,
          reviewedLotCount: reviewed.size,
          notReviewedLotCount: Math.max(0, lots.length - reviewed.size),
          mapTemplateLotCount: Object.keys(mapByLot).length,
          counts: c,
          changedFromSessionCount,
          baselineComparisonSource: baselineComparison.source,
          baselineBeforeDate:
            latestBeforeData?.baseline?.date ??
            (baselineComparison.source === 'PREV_CALENDAR_DAY_FALLBACK' ? prevDayIso : undefined),
        },
      });
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Disponibilidade confirmada e salva', type: 'success' });
      qc.invalidateQueries({ queryKey: ['daily-availability-current'] });
      qc.invalidateQueries({ queryKey: ['daily-availability-today'] });
      setConfirmOpen(false);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao salvar';
      toast({ title: msg, type: 'error' });
    },
  });

  const onImageClick = useCallback(
    (nx: number, ny: number, refW: number, refH: number) => {
      if (!pendingMapLotId) return;
      const hit = 0.028;
      const lotId = pendingMapLotId;
      setMapByLot((prev) => ({
        ...prev,
        [lotId]: {
          xNorm: nx,
          yNorm: ny,
          wNorm: hit,
          hNorm: hit,
          refImageWidth: refW,
          refImageHeight: refH,
        },
      }));
      setReviewed((r) => new Set(r).add(lotId));
      setPendingMapLotId(null);
      toast({ title: 'Ponto do lote definido (salve o template para persistir)', type: 'success' });
    },
    [pendingMapLotId, toast],
  );

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
    return { d, r, v, n, total: lots.length };
  }, [lots, snapByLot]);

  const unreviewedCount = Math.max(0, lots.length - reviewed.size);

  const hotspotOverlay = imageUrl ? (
    <>
      {Object.entries(mapByLot).map(([lotId, m]) => {
        const lot = lots.find((x) => x.id === lotId);
        if (!lot) return null;
        const label = `${lot.blockName} · ${lot.number}`;
        return (
          <button
            key={lotId}
            type="button"
            title={label}
            className={cn(
              'absolute z-10 min-h-[10px] min-w-[10px] rounded-full border-2 shadow-md transition-colors',
              selectedLotId === lotId ? 'border-primary-600 bg-primary-500/50' : 'border-white bg-black/35 hover:bg-black/50',
            )}
            style={{
              left: `${m.xNorm * 100}%`,
              top: `${m.yNorm * 100}%`,
              width: m.wNorm != null ? `${m.wNorm * 100}%` : undefined,
              height: m.hNorm != null ? `${m.hNorm * 100}%` : undefined,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedLotId(lotId);
              rowRefs.current[lotId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }}
          />
        );
      })}
    </>
  ) : null;

  const showLoader = developmentId && (mapLoading || currentLoading || mapRowsLoading || latestBeforeLoading);

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/admin/daily-availability"
              className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar à central manual
            </Link>
            <PageHeader
              title="Disponibilidade assistida por imagem"
              description="Use a imagem da gestora como referência, mapeie lotes uma vez (template) e confira status com conferência humana obrigatória antes de salvar."
            />
          </div>
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
            <div className="flex flex-col justify-end gap-2">
              <Label className="text-xs text-slate-500">Layout</Label>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={layoutMode === 'split' ? 'brand' : 'outline'}
                  className="gap-1"
                  onClick={() => setLayoutMode('split')}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Imagem + lista
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={layoutMode === 'image' ? 'brand' : 'outline'}
                  onClick={() => setLayoutMode('image')}
                >
                  <ImageIcon className="h-4 w-4" />
                  Só imagem
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={layoutMode === 'list' ? 'brand' : 'outline'}
                  onClick={() => setLayoutMode('list')}
                >
                  <List className="h-4 w-4" />
                  Só lista
                </Button>
              </div>
            </div>
          </div>

          {developmentId ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-primary-50/60 px-4 py-3 text-sm">
              <span>
                Lotes: <strong>{summary.total}</strong>
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
              <span className="text-gray-500">|</span>
              <span>
                Sem revisão nesta sessão: <strong>{unreviewedCount}</strong>
              </span>
            </div>
          ) : null}

          {developmentId ? (
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-primary-300 bg-white px-3 py-2 text-sm font-medium text-primary-800 hover:bg-primary-50">
                <Camera className="h-4 w-4" />
                {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Enviar imagem do dia
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
                className="gap-1"
                disabled={!Object.keys(mapByLot).length || saveTemplateMutation.isPending}
                onClick={() => saveTemplateMutation.mutate()}
              >
                {saveTemplateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                Salvar template visual
              </Button>

              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={undoLast}>
                <Undo2 className="h-4 w-4" />
                Desfazer status
              </Button>

              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={goNextLot}>
                Próximo lote
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="brand"
                className="gap-2"
                disabled={!lots.length || saveSnapshotMutation.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                {saveSnapshotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Revisar e salvar dia
              </Button>
            </div>
          ) : null}
        </Card>

        {developmentId && suggestedReviewLotIds.length ? (
          <Card className="border-indigo-100 bg-indigo-50/50 p-4">
            <div className="flex flex-wrap items-start gap-3">
              <Sparkles className="h-5 w-5 shrink-0 text-indigo-600" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-semibold text-indigo-950">Sugestões assistidas (sem automação)</p>
                <p className="text-xs text-slate-600">
                  Lotes com marca no template visual que ainda não foram interagidos nesta sessão. Use como fila sugerida; nada é salvo sem sua confirmação final.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedReviewLotIds.map((id) => {
                    const lot = lots.find((x) => x.id === id);
                    if (!lot) return null;
                    return (
                      <Button
                        key={id}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-indigo-200 bg-white text-xs"
                        onClick={() => {
                          setSelectedLotId(id);
                          rowRefs.current[id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }}
                      >
                        {lot.blockName} · {lot.number}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        {showLoader ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
          </div>
        ) : null}

        {developmentId && !showLoader ? (
          <div
            className={cn(
              'grid gap-4',
              layoutMode === 'split' && 'lg:grid-cols-2',
              layoutMode === 'image' && 'grid-cols-1',
              layoutMode === 'list' && 'grid-cols-1',
            )}
          >
            {layoutMode !== 'list' ? (
              <Card className="p-4">
                <AssistedImageViewer
                  imageUrl={imageUrl}
                  mapMode={!!pendingMapLotId}
                  overlay={hotspotOverlay}
                  onImageNormalizedClick={onImageClick}
                />
                {selectedLotId ? (
                  <div className="mt-4 flex flex-wrap gap-2 rounded-lg border border-surface-muted bg-surface/80 p-3">
                    <span className="w-full text-xs font-semibold text-slate-600">Ações rápidas (lote selecionado)</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => setStatus(selectedLotId, 'DISPONIVEL')}>
                      Disponível
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setStatus(selectedLotId, 'RESERVADO')}>
                      Reservado
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setStatus(selectedLotId, 'VENDIDO')}>
                      Vendido
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setStatus(selectedLotId, 'NEGOCIACAO')}>
                      Negociação
                    </Button>
                  </div>
                ) : null}
              </Card>
            ) : null}

            {layoutMode !== 'image' ? (
              <Card className="overflow-hidden">
                <div className="border-b border-surface-muted bg-surface px-4 py-3">
                  <h3 className="text-sm font-bold text-primary-950">Conferência de lotes</h3>
                  <p className="mt-1 text-xs text-gray-600">
                    Selecione um lote para destacar no mapa. Use &quot;Mapear&quot; para posicionar na imagem. O selo Δ indica diferença em relação à
                    última atualização registrada antes desta data (ou ao dia anterior, se não houver histórico).
                  </p>
                </div>
                <div className="max-h-[min(70vh,720px)] overflow-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="sticky top-0 bg-white shadow-sm">
                      <tr className="border-b border-surface-muted text-xs uppercase text-gray-500">
                        <th className="px-3 py-2">Quadra</th>
                        <th className="px-3 py-2">Lote</th>
                        <th className="px-3 py-2">Preço</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Mapa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLots.map((l) => {
                        const st = snapByLot[l.id] ?? 'DISPONIVEL';
                        const prevSt = prevStatusByLot.get(l.id);
                        const changedFromPrev = prevSt != null && prevSt !== st;
                        return (
                          <tr
                            key={l.id}
                            ref={(el) => {
                              rowRefs.current[l.id] = el;
                            }}
                            className={cn(
                              'border-b border-surface-muted/80 hover:bg-surface/80',
                              selectedLotId === l.id && 'bg-primary-50/80',
                            )}
                          >
                            <td className="px-3 py-2 font-medium text-gray-800">{l.blockName}</td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                className="text-left font-medium text-primary-800 hover:underline"
                                onClick={() => setSelectedLotId(l.id)}
                              >
                                {l.number}
                              </button>
                              {changedFromPrev ? (
                                <span
                                  title={baselineComparison.label}
                                  className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900"
                                >
                                  Δ base
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                className="h-8 max-w-[140px] text-xs"
                                value={priceByLot[l.id] ?? ''}
                                onChange={(e) => {
                                  setPriceByLot((p) => ({ ...p, [l.id]: e.target.value }));
                                  setReviewed((r) => new Set(r).add(l.id));
                                }}
                                placeholder={typeof l.price === 'number' ? formatPrice(l.price) : '—'}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLotId(l.id);
                                  const i = STATUS_ORDER.indexOf(st);
                                  setStatus(l.id, STATUS_ORDER[(i + 1) % STATUS_ORDER.length]);
                                }}
                                className={cn(
                                  'rounded-lg border px-2 py-1 text-xs font-semibold transition hover:opacity-90',
                                  STATUS_CLASS[st],
                                )}
                              >
                                {STATUS_LABEL[st]}
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={pendingMapLotId === l.id ? 'brand' : 'outline'}
                                className="gap-1"
                                disabled={!imageUrl}
                                onClick={() => setPendingMapLotId((p) => (p === l.id ? null : l.id))}
                              >
                                <MapPin className="h-3 w-3" />
                                {mapByLot[l.id] ? 'Remapear' : 'Mapear'}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar disponibilidade do dia</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              Revise os totais antes de persistir. O sistema registra a confirmação humana e o vínculo com a imagem (quando houver).
            </p>
            <ul className="space-y-1 text-sm">
              <li>
                Total de lotes no snapshot: <strong>{summary.total}</strong>
              </li>
              <li>
                Disponíveis: <strong>{summary.d}</strong>
              </li>
              <li>
                Reservados: <strong>{summary.r}</strong>
              </li>
              <li>
                Vendidos: <strong>{summary.v}</strong>
              </li>
              <li>
                Negociação: <strong>{summary.n}</strong>
              </li>
              <li>
                Lotes com status alterado nesta sessão: <strong>{changedFromSessionCount}</strong>
              </li>
              <li className="text-slate-700">
                Base de comparação (selo Δ na lista): <strong>{baselineComparison.label}</strong>
              </li>
              <li>
                Lotes sem revisão nesta sessão: <strong>{unreviewedCount}</strong>
              </li>
              <li>
                Imagem do dia: <strong>{imageUrl ? 'Sim' : 'Não'}</strong>
              </li>
            </ul>
            {unreviewedCount > 0 ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Ainda há lotes que você não interagiu nesta sessão (não marca automaticamente erro — apenas alerta operacional).
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
                Voltar
              </Button>
              <Button type="button" variant="brand" className="gap-2" disabled={saveSnapshotMutation.isPending} onClick={() => saveSnapshotMutation.mutate()}>
                {saveSnapshotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Confirmar e salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
