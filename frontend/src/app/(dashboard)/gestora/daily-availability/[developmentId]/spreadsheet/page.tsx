'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  FileSpreadsheet,
  History,
  Loader2,
  Upload,
} from 'lucide-react';
import { api } from '@/lib/api';
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
type CanonicalKey =
  | 'block'
  | 'lotNumber'
  | 'status'
  | 'price'
  | 'area'
  | 'notes'
  | 'developmentName';

const FIELD_LABEL: Record<CanonicalKey, string> = {
  developmentName: 'Loteamento (opcional)',
  block: 'Quadra *',
  lotNumber: 'Lote *',
  status: 'Status *',
  price: 'Preço',
  area: 'Metragem (m²)',
  notes: 'Observação',
};

function spTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

type AnalyzeResponse = {
  sheetName: string;
  headers: string[];
  rowCount: number;
  suggestedMapping: Partial<Record<CanonicalKey, string | null>>;
  sampleRows: string[][];
};

type PreviewResponse = {
  sheetName: string;
  totalRowsInFile: number;
  dataRows: number;
  rowsSkippedBlank: number;
  matchedFromSheet: number;
  unmatchedRows: Array<{ rowIndex: number; reason: string; block?: string; lot?: string }>;
  invalidRows: Array<{ rowIndex: number; reason: string }>;
  duplicateRowWarnings: number;
  changesVsPrevious: Array<{ lotId: string; from: string | null; to: string; block?: string; lotNumber?: string }>;
  matchedSample: Array<{
    rowIndex: number;
    lotId: string;
    block: string;
    lotNumber: string;
    status: string;
  }>;
};

const STATUS_PREVIEW_LABEL: Record<string, string> = {
  DISPONIVEL: 'Disponível',
  RESERVADO: 'Reservado',
  VENDIDO: 'Vendido',
  NEGOCIACAO: 'Negociação',
};

export default function GestoraSpreadsheetImportPage() {
  const params = useParams();
  const developmentId = (params?.developmentId as string) ?? '';
  const { toast } = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState(spTodayIso);
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<CanonicalKey, string>>>({});
  const [analyze, setAnalyze] = useState<AnalyzeResponse | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Template aplicado nesta sessão (gravado em importMetadata / auditoria ao confirmar). */
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const { data: myAccess } = useQuery({
    queryKey: ['gestora-my-developments'],
    queryFn: async () => {
      const { data } = await api.get<
        Array<{ developmentId: string; development: { id: string; name: string; city: string } }>
      >('/gestora/my-developments');
      return data;
    },
  });

  const currentDevLabel = useMemo(() => {
    const row = myAccess?.find((a) => a.developmentId === developmentId);
    if (!row) return null;
    return `${row.development.name} — ${row.development.city}`;
  }, [myAccess, developmentId]);

  const { data: templates } = useQuery({
    queryKey: ['spreadsheet-templates', developmentId, 'gestora'],
    queryFn: async () => {
      const { data } = await api.get<
        Array<{ id: string; name: string; gestoraLabel: string | null; columnMapping: Partial<Record<CanonicalKey, string>> }>
      >(`/daily-availability/developments/${developmentId}/spreadsheet-templates`);
      return data;
    },
    enabled: !!developmentId,
  });

  const { data: importHistory } = useQuery({
    queryKey: ['daily-availability-history', developmentId, 'spreadsheet', 'gestora'],
    queryFn: async () => {
      const { data } = await api.get<
        Array<{
          id: string;
          date: string;
          sourceType: string;
          createdAt: string;
          snapshotCount: number;
          createdBy: { name: string };
          importSummary?: {
            fileName?: string;
            sheetName?: string;
            matchedFromSheet?: number;
            changesCount?: number;
            templateName?: string;
          } | null;
        }>
      >(`/daily-availability/developments/${developmentId}/history`, { params: { limit: 15 } });
      return data;
    },
    enabled: !!developmentId,
  });

  const analyzeMutation = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData();
      fd.append('file', f);
      const { data } = await api.post<AnalyzeResponse>(
        `/daily-availability/developments/${developmentId}/spreadsheet/analyze`,
        fd,
      );
      return data;
    },
    onSuccess: (data) => {
      setAnalyze(data);
      const m: Partial<Record<CanonicalKey, string>> = {};
      for (const k of Object.keys(data.suggestedMapping) as CanonicalKey[]) {
        const v = data.suggestedMapping[k];
        if (v) m[k] = v;
      }
      setMapping((prev) => ({ ...m, ...prev }));
      toast({ title: 'Planilha lida. Ajuste o mapeamento se necessário.', type: 'success' });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao analisar arquivo';
      toast({ title: msg, type: 'error' });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Arquivo ausente');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('date', date);
      fd.append('columnMapping', JSON.stringify(mapping));
      const { data } = await api.post<PreviewResponse>(
        `/daily-availability/developments/${developmentId}/spreadsheet/preview`,
        fd,
      );
      return data;
    },
    onSuccess: (data) => {
      setPreview(data);
      toast({ title: 'Pré-visualização pronta', type: 'success' });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro no preview';
      toast({ title: msg, type: 'error' });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Arquivo ausente');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('date', date);
      fd.append('columnMapping', JSON.stringify(mapping));
      if (activeTemplateId) {
        fd.append('templateId', activeTemplateId);
      }
      const { data } = await api.post(`/daily-availability/developments/${developmentId}/spreadsheet/confirm`, fd);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Importação concluída e snapshot do dia registrado', type: 'success' });
      qc.invalidateQueries({ queryKey: ['daily-availability-current'] });
      qc.invalidateQueries({ queryKey: ['daily-availability-today'] });
      qc.invalidateQueries({ queryKey: ['spreadsheet-templates', developmentId] });
      qc.invalidateQueries({ queryKey: ['daily-availability-history', developmentId, 'spreadsheet'] });
      setConfirmOpen(false);
      setPreview(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao confirmar';
      toast({ title: msg, type: 'error' });
    },
  });

  const headerOptions = useMemo(() => {
    const h = analyze?.headers ?? [];
    return [''].concat(h.filter(Boolean));
  }, [analyze?.headers]);

  const applyTemplate = useCallback(
    (id: string) => {
      const t = templates?.find((x) => x.id === id);
      if (!t?.columnMapping) return;
      setActiveTemplateId(id);
      setMapping(t.columnMapping as Partial<Record<CanonicalKey, string>>);
      setPreview(null);
      toast({ title: 'Mapeamento do template aplicado — gere o preview novamente se já tinha arquivo carregado.', type: 'success' });
    },
    [templates, toast],
  );

  const canPreview =
    !!developmentId &&
    !!file &&
    !!mapping.block?.trim() &&
    !!mapping.lotNumber?.trim() &&
    !!mapping.status?.trim();

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href={developmentId ? `/gestora/daily-availability/${developmentId}` : '/gestora'}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar à disponibilidade do dia
        </Link>

        <PageHeader
          title="Importação por planilha da gestora"
          description="Envie CSV ou Excel, mapeie colunas, revise o preview e confirme. O arquivo fica armazenado para rastreabilidade e o snapshot do dia é criado com origem SPREADSHEET."
        />

        <Card className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Loteamento</Label>
              <p className="flex min-h-10 items-center rounded-lg border border-surface-muted bg-surface/50 px-3 py-2 text-sm font-medium text-gray-800">
                {(currentDevLabel ?? developmentId) || '—'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Data do snapshot</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {developmentId ? (
            <div className="space-y-2">
              <Label>Templates salvos (opcional)</Label>
              <div className="flex flex-wrap gap-2">
                {templates?.length ? (
                  templates.map((t) => (
                    <Button
                      key={t.id}
                      type="button"
                      variant={activeTemplateId === t.id ? 'brand' : 'outline'}
                      size="sm"
                      onClick={() => applyTemplate(t.id)}
                    >
                      Usar: {t.name}
                      {t.gestoraLabel ? ` (${t.gestoraLabel})` : ''}
                    </Button>
                  ))
                ) : (
                  <span className="text-sm text-gray-500">Nenhum template ainda para este loteamento.</span>
                )}
              </div>
              {activeTemplateId ? (
                <p className="text-xs text-slate-600">
                  Template ativo para rastreio na confirmação.{' '}
                  <button
                    type="button"
                    className="font-medium text-primary-700 underline"
                    onClick={() => setActiveTemplateId(null)}
                  >
                    Limpar seleção
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}

          {developmentId ? (
            <div className="space-y-2">
              <Label>Arquivo (.csv, .xlsx)</Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-primary-300 bg-white px-4 py-3 text-sm">
                <FileSpreadsheet className="h-5 w-5 text-primary-700" />
                {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {file ? file.name : 'Selecionar planilha'}
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  disabled={analyzeMutation.isPending}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    setFile(f);
                    setAnalyze(null);
                    setPreview(null);
                    analyzeMutation.mutate(f);
                  }}
                />
              </label>
            </div>
          ) : null}
        </Card>

        {analyze ? (
          <Card className="space-y-4 p-6">
            <h3 className="text-sm font-bold text-primary-950">
              Aba: {analyze.sheetName} · {analyze.rowCount} linhas de dados
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(FIELD_LABEL) as CanonicalKey[]).map((key) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{FIELD_LABEL[key]}</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-surface-muted bg-white px-3 text-sm"
                    value={mapping[key] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || undefined }))}
                  >
                    {headerOptions.map((h) => (
                      <option key={`${key}-${h}`} value={h}>
                        {h || '(ignorar)'}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="brand"
              disabled={!canPreview || previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
            >
              {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Gerar pré-visualização
            </Button>
          </Card>
        ) : null}

        {preview ? (
          <Card className="space-y-4 p-6">
            <h3 className="text-sm font-bold text-primary-950">Resultado da pré-visualização</h3>
            <p className="text-xs text-slate-600">
              Aba: <strong>{preview.sheetName}</strong>
            </p>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              <li>
                Linhas no arquivo: <strong>{preview.totalRowsInFile}</strong>
              </li>
              <li>
                Linhas de dados: <strong>{preview.dataRows}</strong>
              </li>
              <li>
                Linhas em branco ignoradas: <strong>{preview.rowsSkippedBlank}</strong>
              </li>
              <li>
                Lotes reconhecidos na planilha: <strong>{preview.matchedFromSheet}</strong>
              </li>
              <li>
                Avisos de linha duplicada (mesmo lote): <strong>{preview.duplicateRowWarnings}</strong>
              </li>
              <li>
                Alterações vs snapshot anterior: <strong>{preview.changesVsPrevious.length}</strong>
              </li>
              <li>
                Linhas inválidas (não importadas): <strong>{preview.invalidRows.length}</strong>
              </li>
              <li>
                Conflitos / sem match no cadastro: <strong>{preview.unmatchedRows.length}</strong>
              </li>
            </ul>

            {preview.invalidRows.length > 0 ? (
              <div className="max-h-48 overflow-auto rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs">
                <p className="mb-2 font-semibold text-amber-950">Linhas com erro</p>
                <ul className="space-y-1">
                  {preview.invalidRows.slice(0, 40).map((r) => (
                    <li key={r.rowIndex}>
                      Linha {r.rowIndex}: {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview.unmatchedRows.length > 0 ? (
              <div className="max-h-48 overflow-auto rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs">
                <p className="mb-2 font-semibold text-rose-950">Sem correspondência no cadastro</p>
                <ul className="space-y-1">
                  {preview.unmatchedRows.slice(0, 40).map((r) => (
                    <li key={r.rowIndex}>
                      Linha {r.rowIndex}: {r.block ?? '?'} / {r.lot ?? '?'} — {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview.changesVsPrevious.length > 0 ? (
              <div className="overflow-auto rounded-lg border border-indigo-100">
                <p className="bg-indigo-50/80 px-3 py-2 text-xs font-semibold text-indigo-950">
                  Alterações em relação ao último snapshot desta data (máx. 40)
                </p>
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead className="bg-surface">
                    <tr>
                      <th className="px-2 py-2">Quadra</th>
                      <th className="px-2 py-2">Lote</th>
                      <th className="px-2 py-2">De</th>
                      <th className="px-2 py-2">Para</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.changesVsPrevious.slice(0, 40).map((c) => (
                      <tr key={c.lotId} className="border-t">
                        <td className="px-2 py-1">{c.block ?? '—'}</td>
                        <td className="px-2 py-1">{c.lotNumber ?? '—'}</td>
                        <td className="px-2 py-1">{c.from ? STATUS_PREVIEW_LABEL[c.from] ?? c.from : '—'}</td>
                        <td className="px-2 py-1">{STATUS_PREVIEW_LABEL[c.to] ?? c.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {preview.matchedSample.length > 0 ? (
              <div className="overflow-auto rounded-lg border">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead className="bg-surface">
                    <tr>
                      <th className="px-2 py-2">Linha</th>
                      <th className="px-2 py-2">Quadra</th>
                      <th className="px-2 py-2">Lote</th>
                      <th className="px-2 py-2">Status (planilha)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.matchedSample.map((r) => (
                      <tr key={`${r.rowIndex}-${r.lotId}`} className="border-t">
                        <td className="px-2 py-1">{r.rowIndex}</td>
                        <td className="px-2 py-1">{r.block}</td>
                        <td className="px-2 py-1">{r.lotNumber}</td>
                        <td className="px-2 py-1">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <p className="text-xs text-slate-600">
              Templates existentes podem ser reutilizados abaixo; novos templates só podem ser criados pelo administrador na central
              global.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="brand"
                className="gap-2"
                disabled={preview.matchedFromSheet === 0}
                onClick={() => setConfirmOpen(true)}
              >
                <Check className="h-4 w-4" />
                Confirmar importação
              </Button>
              <p className="text-xs text-gray-600">
                A confirmação reenvia o mesmo arquivo, grava o snapshot do dia com todos os lotes (planilha aplicada onde couber,
                demais lotes mantêm baseline), define origem <strong>CSV</strong> ou <strong>SPREADSHEET</strong> conforme o arquivo e
                registra auditoria com metadados do arquivo.
              </p>
            </div>
          </Card>
        ) : null}

        {developmentId ? (
          <Card className="p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-primary-950">
              <History className="h-4 w-4" />
              Histórico recente (inclui importações)
            </h3>
            {!importHistory?.length ? (
              <p className="text-sm text-gray-600">Nenhum registro ainda.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {importHistory.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-col gap-1 rounded-lg border border-surface-muted px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
                  >
                    <span>
                      {new Date(h.date).toLocaleDateString('pt-BR')} · <strong>{h.sourceType}</strong> · {h.snapshotCount}{' '}
                      lotes
                      {h.importSummary?.fileName ? (
                        <span className="block text-xs text-slate-600">
                          Arquivo: {h.importSummary.fileName}
                          {h.importSummary.sheetName ? ` · ${h.importSummary.sheetName}` : ''}
                          {h.importSummary.templateName ? ` · template: ${h.importSummary.templateName}` : ''}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-gray-600">
                      {new Date(h.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} — {h.createdBy.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar importação da planilha</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              Será criado um registro de disponibilidade com origem <strong>CSV</strong> ou <strong>SPREADSHEET</strong> (conforme
              extensão do arquivo), arquivo anexado para rastreabilidade e snapshot do dia para todos os lotes do loteamento.
            </p>
            {preview && preview.unmatchedRows.length > 0 ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950">
                Existem {preview.unmatchedRows.length} linha(s) que não casaram com o cadastro — elas serão ignoradas na
                atualização.
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="brand"
                className="gap-2"
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate()}
              >
                {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
