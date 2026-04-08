'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Copy, Loader2, RefreshCw, Share2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const CONTENT_TYPES = [
  { value: 'FEED', label: 'Feed' },
  { value: 'STORY', label: 'Story' },
  { value: 'REEL', label: 'Reel' },
  { value: 'CARROSSEL', label: 'Carrossel' },
  { value: 'ANUNCIO_PATROCINADO', label: 'Anúncio patrocinado' },
  { value: 'WHATSAPP_BRIDGE', label: 'Ponte WhatsApp' },
] as const;

const OBJECTIVES = [
  { value: 'AUTO', label: 'Automático (ranking)' },
  { value: 'CAPTAR_LEADS', label: 'Captar leads' },
  { value: 'WHATSAPP', label: 'Mensagens no WhatsApp' },
  { value: 'DESTACAR_CAMPEAO', label: 'Destacar lote campeão' },
  { value: 'REATIVAR_ENCALHADO', label: 'Reativar lote parado' },
  { value: 'LANCAMENTO', label: 'Lançamento' },
  { value: 'OPORTUNIDADE', label: 'Oportunidade' },
  { value: 'CONDICAO_ESPECIAL', label: 'Condição especial' },
  { value: 'LOCALIZACAO', label: 'Localização' },
  { value: 'VISITA', label: 'Convidar para visita' },
] as const;

const TONES = [
  { value: 'AUTO', label: 'Automático (ranking)' },
  { value: 'PROFISSIONAL', label: 'Profissional' },
  { value: 'CONSULTIVO', label: 'Consultivo' },
  { value: 'PERSUASIVO', label: 'Persuasivo' },
  { value: 'PREMIUM', label: 'Premium' },
  { value: 'POPULAR', label: 'Popular / comercial' },
  { value: 'URGENTE_SUAVE', label: 'Urgente (suave)' },
] as const;

export type InstagramVariation = {
  label: string;
  headline: string;
  feedCaption: string;
  storyText: string;
  reelScript: { hook: string; body: string; closing: string };
  carouselSlides: string[];
  sponsoredText: string;
  whatsappBridge: string;
  cta: string;
  hashtags: string;
  keyArguments: string[];
};

export type InstagramAdPack = {
  scope: string;
  resolvedObjective: string;
  resolvedTone: string;
  strategicJustification: string;
  visualBullets: string[];
  extraHooks: string[];
  extraCTAs: string[];
  variations: InstagramVariation[];
  publishing: { ready: boolean; note: string };
};

type GenerateResponse = {
  pack: InstagramAdPack;
  publishing: { ready: boolean; note: string };
  savedId?: string;
};

type Props = {
  mode: 'lot' | 'development';
  lotId?: string;
  developmentId?: string;
  title?: string;
};

export function InstagramAdGenerator({ mode, lotId, developmentId, title }: Props) {
  const { toast } = useToast();
  const [contentType, setContentType] = useState<string>('FEED');
  const [objective, setObjective] = useState<string>('AUTO');
  const [tone, setTone] = useState<string>('AUTO');
  const [leadId, setLeadId] = useState('');
  const [saveHistory, setSaveHistory] = useState(false);
  const [pack, setPack] = useState<InstagramAdPack | null>(null);
  const [publishingNote, setPublishingNote] = useState<string | null>(null);
  const [varIndex, setVarIndex] = useState(0);

  const generate = useMutation({
    mutationFn: async (regenerate: boolean) => {
      const body = {
        contentType,
        objective,
        tone,
        leadId: mode === 'lot' && leadId.trim() ? leadId.trim() : undefined,
        save: saveHistory,
        regenerate,
      };
      const url =
        mode === 'lot' && lotId
          ? `/instagram-ads/lots/${lotId}/generate`
          : `/instagram-ads/developments/${developmentId}/generate`;
      const { data } = await api.post<GenerateResponse>(url, body);
      return data;
    },
    onSuccess: (data) => {
      setPack(data.pack);
      setPublishingNote(data.publishing?.note ?? null);
      setVarIndex(0);
      if (data.savedId) toast({ title: 'Rascunho salvo no histórico', type: 'success' });
      else toast({ title: 'Anúncio gerado', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao gerar anúncio', type: 'error' }),
  });

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado', type: 'success' });
    } catch {
      toast({ title: 'Não foi possível copiar', type: 'error' });
    }
  }

  const v = pack?.variations[varIndex];

  function previewBody(): { title: string; body: string } {
    if (!v) return { title: '', body: '' };
    switch (contentType) {
      case 'STORY':
        return { title: 'Story', body: v.storyText };
      case 'REEL':
        return {
          title: 'Roteiro de reel',
          body: `${v.reelScript.hook}\n\n${v.reelScript.body}\n\n${v.reelScript.closing}`,
        };
      case 'CARROSSEL':
        return {
          title: 'Slides do carrossel',
          body: v.carouselSlides.map((s, i) => `Slide ${i + 1}:\n${s}`).join('\n\n'),
        };
      case 'ANUNCIO_PATROCINADO':
        return { title: 'Texto para anúncio', body: v.sponsoredText };
      case 'WHATSAPP_BRIDGE':
        return { title: 'Mensagem ponte Instagram → WhatsApp', body: v.whatsappBridge };
      default:
        return { title: 'Legenda (feed)', body: `${v.headline}\n\n${v.feedCaption}\n\n${v.cta}\n\n${v.hashtags}` };
    }
  }

  const preview = previewBody();

  const copyAllPieces = () => {
    if (!v || !pack) return '';
    return [
      `Objetivo: ${pack.resolvedObjective} · Tom: ${pack.resolvedTone}`,
      '',
      `— ${v.headline} —`,
      '',
      v.feedCaption,
      '',
      `Story: ${v.storyText}`,
      '',
      `Reel:\n${v.reelScript.hook}\n${v.reelScript.body}\n${v.reelScript.closing}`,
      '',
      `Carrossel:\n${v.carouselSlides.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
      '',
      `Patrocinado: ${v.sponsoredText}`,
      '',
      `WhatsApp: ${v.whatsappBridge}`,
      '',
      `CTA: ${v.cta}`,
      v.hashtags,
    ].join('\n');
  };

  if (mode === 'lot' && !lotId) return null;
  if (mode === 'development' && !developmentId) return null;

  return (
    <Card className="mt-8 max-w-4xl border-primary-100 bg-gradient-to-br from-white to-primary-50/20 p-6 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-primary-700" />
          <h2 className="text-lg font-bold text-primary-950">
            {title ?? 'Gerar anúncio para Instagram'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="brand"
            className="gap-1.5"
            disabled={generate.isPending}
            onClick={() => generate.mutate(false)}
          >
            {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Gerar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={generate.isPending || !pack}
            onClick={() => generate.mutate(true)}
          >
            <RefreshCw className="h-4 w-4" />
            Regenerar
          </Button>
        </div>
      </div>

      <p className="mb-4 text-sm text-gray-600">
        Três versões (objetiva, consultiva, persuasiva) usando dados do lote, loteamento e tags do ranking
        comercial. Revise antes de publicar.
      </p>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label>Tipo de conteúdo</Label>
          <select
            className="mt-1 flex h-10 w-full rounded-lg border px-3 py-2 text-sm"
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
          >
            {CONTENT_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Objetivo</Label>
          <select
            className="mt-1 flex h-10 w-full rounded-lg border px-3 py-2 text-sm"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          >
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Tom</Label>
          <select
            className="mt-1 flex h-10 w-full rounded-lg border px-3 py-2 text-sm"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
          >
            {TONES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mode === 'lot' ? (
        <div className="mb-4 max-w-md">
          <Label>Lead (opcional — previsão de fechamento)</Label>
          <Input
            className="mt-1"
            placeholder="ID do lead vinculado ao lote"
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">
            Se informado, o gerador usa score e próximo passo da previsão para ajustar CTA.
          </p>
        </div>
      ) : null}

      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={saveHistory}
          onChange={(e) => setSaveHistory(e.target.checked)}
          className="rounded border-gray-300"
        />
        Salvar no histórico do sistema
      </label>

      {pack && v ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
            <p className="font-semibold">Observação estratégica</p>
            <p className="mt-1 text-amber-900/90">{pack.strategicJustification}</p>
            <p className="mt-2 text-xs text-amber-800/80">
              Formato focado: <strong>{CONTENT_TYPES.find((c) => c.value === contentType)?.label}</strong> ·
              Objetivo resolvido: <strong>{pack.resolvedObjective}</strong> · Tom:{' '}
              <strong>{pack.resolvedTone}</strong>
            </p>
          </div>

          {pack.visualBullets.length ? (
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">Resumo visual (tópicos)</p>
              <ul className="mt-2 list-inside list-disc text-sm text-gray-800">
                {pack.visualBullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {pack.variations.map((x, i) => (
              <button
                key={x.label}
                type="button"
                onClick={() => setVarIndex(i)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-bold transition',
                  varIndex === i
                    ? 'bg-primary-800 text-white'
                    : 'bg-white text-primary-800 ring-1 ring-primary-200 hover:bg-primary-50',
                )}
              >
                {x.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-surface-muted bg-white p-4">
            <p className="text-xs font-bold uppercase text-primary-800">Pré-visualização — {preview.title}</p>
            <p className="mt-1 text-lg font-bold text-primary-950">{v.headline}</p>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-900">
              {preview.body}
            </pre>
          </div>

          {v.keyArguments.length ? (
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">Argumentos-chave</p>
              <ul className="mt-2 list-inside list-disc text-sm text-gray-800">
                {v.keyArguments.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-xs font-bold uppercase text-gray-500">Ganchos extras</p>
            <ul className="space-y-1 text-sm text-gray-700">
              {pack.extraHooks.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => copyText(copyAllPieces())}>
              <Copy className="h-3.5 w-3.5" />
              Copiar tudo
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => copyText(v.feedCaption)}>
              <Copy className="h-3.5 w-3.5" />
              Legenda feed
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => copyText(v.hashtags)}>
              <Copy className="h-3.5 w-3.5" />
              Hashtags
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => copyText(v.cta)}>
              <Copy className="h-3.5 w-3.5" />
              CTA
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => copyText(v.storyText)}>
              <Copy className="h-3.5 w-3.5" />
              Story
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() =>
                copyText(`${v.reelScript.hook}\n${v.reelScript.body}\n${v.reelScript.closing}`)
              }
            >
              <Copy className="h-3.5 w-3.5" />
              Roteiro reel
            </Button>
          </div>

          {publishingNote ? (
            <p className="text-xs text-gray-500">
              Publicação automática: {publishingNote}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Clique em Gerar para criar o pacote de anúncios.</p>
      )}
    </Card>
  );
}
