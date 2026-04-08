'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  MessageCircle,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toaster';

type Bundle = {
  primaryType: string;
  typeLabel: string;
  contactTiming: string;
  recommendedTone: string;
  nextAction: string;
  strategySummary: string;
  lotSummary: string[];
  suggestions: Array<{ tone: string; message: string; justification: string }>;
};

type LeadRef = {
  id: string;
  name: string;
  phone?: string | null;
  closingScore?: number;
  closingPrediction?: string;
  closingReason?: string;
  closingNextAction?: string;
  previousClosingScore?: number;
  closingPositiveFactors?: string[];
  closingRiskFactors?: string[];
};

type PredictionSnapshot = {
  id: string;
  closingScore: string | number;
  closingPrediction: string;
  closingReason: string;
  nextRecommendedAction: string;
  previousScore: string | number | null;
  createdAt: string;
};

function snapNum(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function trendIcon(cur: number | null, prev: number | null) {
  if (cur == null || prev == null) return <Minus className="h-3.5 w-3.5 text-gray-400" aria-hidden />;
  if (cur > prev + 2) return <TrendingUp className="h-3.5 w-3.5 text-success-600" aria-hidden />;
  if (cur < prev - 2) return <TrendingDown className="h-3.5 w-3.5 text-red-600" aria-hidden />;
  return <Minus className="h-3.5 w-3.5 text-amber-600" aria-hidden />;
}

function whatsappUrlForText(phone: string | undefined | null, text: string): string {
  const d = (phone || '').replace(/\D/g, '');
  const enc = encodeURIComponent(text);
  if (d.length >= 10) return `https://wa.me/55${d}?text=${enc}`;
  return `https://wa.me/?text=${enc}`;
}

export function LeadMessageAssistantDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: LeadRef | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const generate = useMutation({
    mutationFn: (regenerate: boolean) =>
      api.post<Bundle>(`/commercial-assistant/leads/${lead!.id}/suggestions`, { regenerate }),
    onSuccess: (res) => {
      setBundle(res.data);
    },
    onError: () => {
      toast({ title: 'Não foi possível gerar sugestões', type: 'error' });
    },
  });

  useEffect(() => {
    if (!open || !lead?.id) return;
    setBundle(null);
    setHistoryOpen(false);
    generate.mutate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- abrir modal / trocar lead
  }, [open, lead?.id]);

  const historyQuery = useQuery({
    queryKey: ['closing-prediction-history', lead?.id],
    queryFn: async () => {
      const { data } = await api.get<PredictionSnapshot[]>(`/closing-prediction/leads/${lead!.id}/history`);
      return data;
    },
    enabled: open && !!lead?.id && historyOpen,
  });

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado', type: 'success' });
    } catch {
      toast({ title: 'Não foi possível copiar', type: 'error' });
    }
  }

  const toneLabel: Record<string, string> = {
    OBJETIVO: 'Objetiva',
    CONSULTIVO: 'Consultiva',
    PERSUASIVO: 'Persuasiva',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-primary-100 bg-[#F5F6F8]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary-950">
            <Sparkles className="h-5 w-5 text-primary-700" />
            IA sugere o que enviar agora
          </DialogTitle>
          {lead ? (
            <p className="text-left text-sm text-gray-600">
              {lead.name} — sugestões usam dados reais do funil, do lote e do ranking comercial.
            </p>
          ) : null}
        </DialogHeader>

        {generate.isPending ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm font-medium text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Gerando mensagens personalizadas…
          </div>
        ) : bundle ? (
          <div className="space-y-4">
            {lead &&
            (lead.closingScore != null ||
              lead.closingPrediction ||
              lead.closingReason ||
              lead.closingNextAction) ? (
              <div className="rounded-xl border border-success-200/80 bg-gradient-to-br from-white to-success-50/30 p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-success-900">
                  Previsão de fechamento (regras de negócio)
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {lead.closingScore != null ? (
                    <span className="rounded-lg bg-success-600 px-2.5 py-1 text-lg font-black tabular-nums text-white shadow-sm">
                      {Math.round(lead.closingScore)}
                    </span>
                  ) : null}
                  {lead.closingPrediction ? (
                    <span className="text-sm font-bold text-primary-950">{lead.closingPrediction}</span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                    Tendência:
                    {trendIcon(lead.closingScore ?? null, lead.previousClosingScore ?? null)}
                  </span>
                </div>
                {lead.closingReason ? (
                  <p className="mt-2 text-sm leading-relaxed text-gray-800">{lead.closingReason}</p>
                ) : null}
                {lead.closingNextAction ? (
                  <p className="mt-2 text-xs font-bold text-success-900">
                    Próxima ação sugerida: {lead.closingNextAction}
                  </p>
                ) : null}
                {(lead.closingPositiveFactors?.length || lead.closingRiskFactors?.length) ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {lead.closingPositiveFactors?.length ? (
                      <div className="rounded-lg bg-white/90 px-3 py-2 text-xs">
                        <p className="font-bold text-success-800">Fatores positivos</p>
                        <ul className="mt-1 list-inside list-disc text-gray-700">
                          {lead.closingPositiveFactors.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {lead.closingRiskFactors?.length ? (
                      <div className="rounded-lg bg-white/90 px-3 py-2 text-xs">
                        <p className="font-bold text-red-800">Riscos</p>
                        <ul className="mt-1 list-inside list-disc text-gray-700">
                          {lead.closingRiskFactors.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setHistoryOpen((o) => !o)}
                  className="mt-3 flex w-full items-center justify-between rounded-lg border border-surface-muted bg-white px-3 py-2 text-left text-xs font-bold text-primary-800 transition hover:bg-primary-50/80"
                >
                  Histórico do score
                  {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {historyOpen ? (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-surface-muted bg-white p-2 text-xs">
                    {historyQuery.isLoading ? (
                      <p className="py-4 text-center text-gray-500">Carregando…</p>
                    ) : historyQuery.data?.length ? (
                      <ul className="space-y-2">
                        {historyQuery.data.map((row) => (
                          <li
                            key={row.id}
                            className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-muted pb-2 last:border-0"
                          >
                            <span className="font-mono tabular-nums text-gray-500">
                              {new Date(row.createdAt).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="font-bold tabular-nums text-primary-950">
                              {Math.round(snapNum(row.closingScore) ?? 0)}
                              {row.previousScore != null ? (
                                <span className="ml-1 font-normal text-gray-500">
                                  (antes {Math.round(snapNum(row.previousScore) ?? 0)})
                                </span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="py-3 text-center text-gray-500">Sem histórico ainda.</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-xl border border-primary-200/80 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-primary-800">
                Momento e estratégia
              </p>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                <li>
                  <span className="font-semibold text-primary-900">Tipo:</span> {bundle.typeLabel}
                </li>
                <li>
                  <span className="font-semibold text-primary-900">Contato:</span> {bundle.contactTiming}
                </li>
                <li>
                  <span className="font-semibold text-primary-900">Tom recomendado:</span>{' '}
                  {toneLabel[bundle.recommendedTone] ?? bundle.recommendedTone}
                </li>
                <li>
                  <span className="font-semibold text-primary-900">Próxima ação:</span> {bundle.nextAction}
                </li>
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-gray-600">{bundle.strategySummary}</p>
              {bundle.lotSummary.length ? (
                <div className="mt-3 rounded-lg bg-primary-50/80 px-3 py-2 text-xs text-primary-900">
                  <p className="font-bold">Resumo do lote</p>
                  {bundle.lotSummary.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              {bundle.suggestions.map((s) => (
                <div
                  key={s.tone}
                  className={cn(
                    'rounded-xl border bg-white p-4 shadow-sm',
                    s.tone === bundle.recommendedTone
                      ? 'border-success-500/50 ring-1 ring-success-500/20'
                      : 'border-surface-muted',
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-900">
                      {bundle.typeLabel}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-700">
                      {toneLabel[s.tone] ?? s.tone}
                    </span>
                    {s.tone === bundle.recommendedTone ? (
                      <span className="text-[10px] font-bold uppercase text-success-700">Recomendado</span>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{s.message}</p>
                  <p className="mt-2 text-xs italic text-gray-600">{s.justification}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => copyText(s.message)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </Button>
                    <a
                      href={whatsappUrlForText(lead?.phone, s.message)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border-2 border-surface-muted bg-success-600 px-3.5 text-xs font-bold text-white shadow-sm hover:bg-success-700',
                      )}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-500">Nenhum dado ainda.</p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={generate.isPending || !lead}
            onClick={() => lead && generate.mutate(true)}
          >
            <RefreshCw className={cn('h-4 w-4', generate.isPending && 'animate-spin')} />
            Gerar novas versões
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
