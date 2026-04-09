'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import { AxiosError } from 'axios';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import type { InstagramAdPack } from './instagram-ad-generator';

import { CampaignPlatformPreview, WhatsAppActionHint } from './campaign-previews';
import { buildWhatsAppShareUrl } from '@/lib/whatsapp';

const PLATFORMS: { id: string; label: string; hint: string }[] = [
  { id: 'INSTAGRAM_FEED', label: 'Instagram — feed', hint: '4:5 / 1:1' },
  { id: 'INSTAGRAM_STORY', label: 'Instagram — story', hint: '9:16' },
  { id: 'INSTAGRAM_REEL', label: 'Instagram — reel', hint: 'roteiro + capa' },
  { id: 'FACEBOOK_POST', label: 'Facebook — post', hint: 'texto mais longo' },
  { id: 'WHATSAPP', label: 'WhatsApp', hint: 'texto curto' },
  { id: 'EXPORT_PACKAGE', label: 'Pacote exportação', hint: 'tudo junto' },
];

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

type BankImage = {
  id: string;
  url: string;
  publicId: string | null;
  source: string;
  label: string | null;
};

type CampaignListItem = {
  id: string;
  title: string;
  status: string;
  development: { name: string; city: string };
  lot: { number: string } | null;
  _count: { assets: number; copies: number };
};

type CampaignDetail = {
  id: string;
  title: string;
  status: string;
  packJson: unknown;
  assets: Array<{
    id: string;
    url: string;
    origin: string;
    kind: string;
    isPrimary: boolean;
    sortOrder: number;
  }>;
  copies: Array<{
    id: string;
    platform: string;
    title: string | null;
    caption: string | null;
    shortCaption: string | null;
    cta: string | null;
    hashtags: string | null;
    professionalTone: string | null;
    persuasiveTone: string | null;
    directTone: string | null;
  }>;
  targets: Array<{ platform: string; status: string; aspectHint: string | null }>;
};

type Props = {
  mode: 'lot' | 'development';
  developmentId: string;
  lotId?: string;
  defaultTitle?: string;
  /** Título da seção (ex.: no Centro de publicação) */
  title?: string;
  /** Nome do empreendimento para prévias realistas */
  developmentName?: string;
};

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
  }
  return fallback;
}

const STEPS = [
  { n: 1, label: 'Plataformas e rascunho' },
  { n: 2, label: 'Texto (IA)' },
  { n: 3, label: 'Imagens' },
  { n: 4, label: 'Pré-visualização' },
  { n: 5, label: 'Exportar / WhatsApp' },
] as const;

export function CampaignStudioWizard({
  mode,
  developmentId,
  lotId,
  defaultTitle,
  title,
  developmentName,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaignTitle, setCampaignTitle] = useState(
    defaultTitle ?? (mode === 'lot' ? 'Campanha do lote' : 'Campanha do loteamento'),
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    'INSTAGRAM_FEED',
    'INSTAGRAM_STORY',
    'WHATSAPP',
    'EXPORT_PACKAGE',
  ]);
  const [contentType, setContentType] = useState<string>('FEED');
  const [objective, setObjective] = useState<string>('AUTO');
  const [tone, setTone] = useState<string>('AUTO');
  const [leadId, setLeadId] = useState('');
  const [varIndex, setVarIndex] = useState(0);
  const [saveIgHistory, setSaveIgHistory] = useState(false);
  const [bankSelection, setBankSelection] = useState<Set<string>>(new Set());
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiCount, setAiCount] = useState<2 | 4>(2);
  const [previewPlatform, setPreviewPlatform] = useState<string>('INSTAGRAM_FEED');
  const [useGeminiLlm, setUseGeminiLlm] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<Array<{ file: File; url: string }>>([]);

  const { data: capabilities } = useQuery({
    queryKey: ['campaign-studio', 'capabilities'],
    queryFn: async () => {
      const { data } = await api.get<{
        geminiConfigured: boolean;
        imageGenerationProvider: string;
        publishingNote: string;
      }>('/campaign-studio/capabilities');
      return data;
    },
  });

  const { data: campaignList } = useQuery({
    queryKey: ['campaign-studio', 'list', developmentId],
    queryFn: async () => {
      const { data } = await api.get<CampaignListItem[]>('/campaign-studio/campaigns', {
        params: { developmentId },
      });
      return data;
    },
    enabled: !!developmentId,
  });

  const { data: bankImages } = useQuery({
    queryKey: ['campaign-studio', 'bank', developmentId],
    queryFn: async () => {
      const { data } = await api.get<{ items: BankImage[] }>('/campaign-studio/available-images', {
        params: { developmentId, lotId },
      });
      return data.items;
    },
    enabled: !!developmentId,
  });

  const { data: campaign, refetch: refetchCampaign } = useQuery({
    queryKey: ['campaign-studio', 'campaign', campaignId],
    queryFn: async () => {
      const { data } = await api.get<CampaignDetail>(`/campaign-studio/campaigns/${campaignId}`);
      return data;
    },
    enabled: !!campaignId,
  });

  const pack = campaign?.packJson as InstagramAdPack | null | undefined;
  const v = pack?.variations[varIndex];

  const createCampaign = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<CampaignDetail>('/campaign-studio/campaigns', {
        developmentId,
        lotId: mode === 'lot' ? lotId : undefined,
        title: campaignTitle.trim(),
        platforms: selectedPlatforms,
      });
      return data;
    },
    onSuccess: (d) => {
      setCampaignId(d.id);
      qc.setQueryData(['campaign-studio', 'campaign', d.id], d);
      void qc.invalidateQueries({ queryKey: ['campaign-studio', 'list', developmentId] });
      toast({ title: 'Rascunho criado', type: 'success' });
      setStep(2);
    },
    onError: (err) =>
      toast({
        title: apiErrorMessage(err, 'Erro ao criar campanha'),
        type: 'error',
      }),
  });

  const generateText = useMutation({
    mutationFn: async () => {
      if (!campaignId) throw new Error('no campaign');
      const { data } = await api.post(`/campaign-studio/campaigns/${campaignId}/generate-text`, {
        contentType,
        objective,
        tone,
        leadId: mode === 'lot' && leadId.trim() ? leadId.trim() : undefined,
        variationIndex: varIndex,
        saveInstagramHistory: saveIgHistory,
        useGeminiLlm: useGeminiLlm && !!capabilities?.geminiConfigured,
      });
      return data as { geminiRefined?: boolean };
    },
    onSuccess: async (data) => {
      toast({
        title: data?.geminiRefined ? 'Texto gerado e refinado com Gemini' : 'Texto gerado e cópias sincronizadas',
        type: 'success',
      });
      await refetchCampaign();
      setStep(4);
    },
    onError: () => toast({ title: 'Erro ao gerar texto', type: 'error' }),
  });

  const addBank = useMutation({
    mutationFn: async () => {
      if (!campaignId || !bankImages?.length) return;
      const items = bankImages
        .filter((b) => bankSelection.has(b.id))
        .map((b) => ({ url: b.url, publicId: b.publicId ?? undefined, fileName: b.label ?? undefined }));
      if (!items.length) return;
      await api.post(`/campaign-studio/campaigns/${campaignId}/assets/from-bank`, { items });
    },
    onSuccess: async () => {
      toast({ title: 'Imagens do banco adicionadas', type: 'success' });
      setBankSelection(new Set());
      await refetchCampaign();
    },
    onError: () => toast({ title: 'Erro ao adicionar imagens', type: 'error' }),
  });

  const uploadFiles = useMutation({
    mutationFn: async (files: File[]) => {
      if (!campaignId || !files.length) return;
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      await api.post(`/campaign-studio/campaigns/${campaignId}/assets/upload`, fd, {
        transformRequest: [
          (data, headers) => {
            delete (headers as Record<string, string>)['Content-Type'];
            return data;
          },
        ],
      });
    },
    onSuccess: async () => {
      pendingFiles.forEach((p) => URL.revokeObjectURL(p.url));
      setPendingFiles([]);
      toast({ title: 'Upload concluído', type: 'success' });
      await refetchCampaign();
    },
    onError: () => toast({ title: 'Erro no upload', type: 'error' }),
  });

  const setPrimary = useMutation({
    mutationFn: async (assetId: string) => {
      if (!campaignId) return;
      await api.patch(`/campaign-studio/campaigns/${campaignId}/assets/${assetId}`, { isPrimary: true });
    },
    onSuccess: () => refetchCampaign(),
  });

  const removeAsset = useMutation({
    mutationFn: async (assetId: string) => {
      if (!campaignId) return;
      await api.delete(`/campaign-studio/campaigns/${campaignId}/assets/${assetId}`);
    },
    onSuccess: () => {
      toast({ title: 'Imagem removida', type: 'success' });
      refetchCampaign();
    },
  });

  const suggestPrompt = useMutation({
    mutationFn: async () => {
      if (!campaignId) throw new Error('no campaign');
      const { data } = await api.post<{ prompt: string }>(
        `/campaign-studio/campaigns/${campaignId}/ai-image/suggested-prompt`,
        { platform: previewPlatform },
      );
      return data.prompt;
    },
    onSuccess: (p) => {
      setAiPrompt(p);
      toast({ title: 'Prompt sugerido preenchido', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao sugerir prompt', type: 'error' }),
  });

  const generateAi = useMutation({
    mutationFn: async () => {
      if (!campaignId) throw new Error('no campaign');
      const { data } = await api.post(`/campaign-studio/campaigns/${campaignId}/ai-image/generate`, {
        prompt: aiPrompt,
        variationCount: aiCount,
      });
      return data;
    },
    onSuccess: async () => {
      toast({ title: `Variações geradas (${capabilities?.imageGenerationProvider ?? 'mock'})`, type: 'success' });
      await refetchCampaign();
    },
    onError: () => toast({ title: 'Erro na geração de imagem', type: 'error' }),
  });

  const markReady = useMutation({
    mutationFn: async () => {
      if (!campaignId) return;
      await api.patch(`/campaign-studio/campaigns/${campaignId}`, { status: 'READY' });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaign-studio', 'list', developmentId] });
      toast({ title: 'Campanha marcada como pronta (não publicada automaticamente)', type: 'success' });
      refetchCampaign();
    },
  });

  const duplicateCampaign = useMutation({
    mutationFn: async () => {
      if (!campaignId) throw new Error('no campaign');
      const { data } = await api.post<CampaignDetail>(`/campaign-studio/campaigns/${campaignId}/duplicate`, {});
      return data;
    },
    onSuccess: (d) => {
      setCampaignId(d.id);
      qc.setQueryData(['campaign-studio', 'campaign', d.id], d);
      void qc.invalidateQueries({ queryKey: ['campaign-studio', 'list', developmentId] });
      toast({ title: 'Campanha duplicada como novo rascunho', type: 'success' });
      setStep(2);
    },
    onError: () => toast({ title: 'Não foi possível duplicar', type: 'error' }),
  });

  const copyText = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Copiado', type: 'success' });
      } catch {
        toast({ title: 'Não foi possível copiar', type: 'error' });
      }
    },
    [toast],
  );

  const downloadExport = useCallback(async () => {
    if (!campaignId) return;
    try {
      const { data } = await api.get(`/campaign-studio/campaigns/${campaignId}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campanha-${campaignId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Pacote baixado', type: 'success' });
    } catch {
      toast({ title: 'Erro ao exportar', type: 'error' });
    }
  }, [campaignId, toast]);

  const copyForPreview = useMemo(() => {
    const c = campaign?.copies.find((x) => x.platform === previewPlatform);
    if (!c) return '';
    return [c.title, '', c.caption, '', c.cta, '', c.hashtags].filter(Boolean).join('\n');
  }, [campaign?.copies, previewPlatform]);

  const previewCopy = useMemo(() => {
    const c = campaign?.copies.find((x) => x.platform === previewPlatform);
    if (!c) return undefined;
    return {
      title: c.title,
      caption: c.caption,
      cta: c.cta,
      hashtags: c.hashtags,
    };
  }, [campaign?.copies, previewPlatform]);

  const whatsappCaption = useMemo(
    () => campaign?.copies.find((x) => x.platform === 'WHATSAPP')?.caption?.trim() ?? '',
    [campaign?.copies],
  );

  const whatsappWaUrl = useMemo(() => buildWhatsAppShareUrl(whatsappCaption), [whatsappCaption]);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  useEffect(() => {
    return () => {
      pendingFiles.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [pendingFiles]);

  useEffect(() => {
    if (!campaignId || !campaignList?.length) return;
    const row = campaignList.find((c) => c.id === campaignId);
    if (row?.title) setCampaignTitle(row.title);
  }, [campaignId, campaignList]);

  const primaryPreviewUrl =
    campaign?.assets.find((a) => a.isPrimary)?.url ?? campaign?.assets[0]?.url ?? null;

  const previewPlatformOptions = useMemo(() => {
    const sel = PLATFORMS.filter((p) => selectedPlatforms.includes(p.id));
    if (sel.length) return sel;
    const ids = campaign?.copies.map((c) => c.platform) ?? [];
    const uniq = Array.from(new Set(ids));
    if (uniq.length) return PLATFORMS.filter((p) => uniq.includes(p.id));
    return PLATFORMS;
  }, [selectedPlatforms, campaign?.copies]);

  return (
    <Card className="mt-8 max-w-4xl border-primary-200 bg-gradient-to-br from-white to-primary-50/25 p-6 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary-950">
            {title ?? 'Estúdio de divulgação (campanha)'}
          </h2>
          <p className="text-sm text-gray-600">
            Gere texto, una imagens do sistema, upload e (opcional) IA visual — depois pré-visualize e exporte.
            Publicação automática nas redes ainda não está ativa; use copiar/baixar.
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <button
            key={s.n}
            type="button"
            onClick={() => setStep(s.n)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold transition',
              step === s.n
                ? 'bg-primary-800 text-white'
                : 'bg-white text-primary-800 ring-1 ring-primary-200 hover:bg-primary-50',
            )}
          >
            {s.n}. {s.label}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          {campaignList && campaignList.length > 0 ? (
            <div>
              <Label>Continuar campanha salva</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-lg border bg-white px-3 text-sm"
                value={campaignId ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) {
                    setCampaignId(null);
                    return;
                  }
                  setCampaignId(v);
                  setStep(2);
                }}
              >
                <option value="">— Nova campanha —</option>
                {campaignList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} · {c.development.name}
                    {c.lot ? ` · lote ${c.lot.number}` : ''} ({c.status})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Escolha uma campanha existente para editar texto, imagens e exportação.
              </p>
              {campaignId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1.5"
                  disabled={duplicateCampaign.isPending}
                  onClick={() => duplicateCampaign.mutate()}
                >
                  {duplicateCampaign.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Duplicar esta campanha
                </Button>
              ) : null}
            </div>
          ) : null}
          <div>
            <Label>Título da campanha</Label>
            <Input className="mt-1" value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-primary-900">Onde pretende divulgar</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PLATFORMS.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-surface-muted bg-white p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(p.id)}
                    onChange={() => togglePlatform(p.id)}
                    className="mt-1 rounded border-gray-300"
                  />
                  <span>
                    <span className="font-semibold text-gray-900">{p.label}</span>
                    <span className="block text-xs text-gray-500">{p.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Button
            type="button"
            variant="brand"
            disabled={
              createCampaign.isPending ||
              !!campaignId ||
              !campaignTitle.trim() ||
              selectedPlatforms.length === 0
            }
            onClick={() => createCampaign.mutate()}
            className="gap-2"
          >
            {createCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Criar rascunho e avançar
          </Button>
          {campaignId ? (
            <p className="text-xs text-amber-800">
              Campanha ativa carregada. Para criar outra do zero, selecione &quot;— Nova campanha —&quot; acima.
            </p>
          ) : null}
        </div>
      )}

      {step === 2 && !campaignId ? (
        <p className="text-sm text-amber-800">Crie o rascunho na etapa 1 para habilitar a geração de texto.</p>
      ) : null}

      {step === 2 && campaignId ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Usa o mesmo motor de contexto do ranking comercial (lote / loteamento). Depois de gerar, as legendas são
            gravadas por plataforma.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Tipo de conteúdo</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-lg border px-3 text-sm"
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
                className="mt-1 flex h-10 w-full rounded-lg border px-3 text-sm"
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
                className="mt-1 flex h-10 w-full rounded-lg border px-3 text-sm"
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
            <div>
              <Label>Lead (opcional — previsão de fechamento)</Label>
              <Input className="mt-1" value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="ID do lead" />
            </div>
          ) : null}
          <div>
            <Label>Versão base (objetiva / consultiva / persuasiva)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setVarIndex(i)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-bold',
                    varIndex === i ? 'bg-primary-800 text-white' : 'bg-white ring-1 ring-primary-200',
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={saveIgHistory}
              onChange={(e) => setSaveIgHistory(e.target.checked)}
              className="rounded border-gray-300"
            />
            Também salvar no histórico de sugestões Instagram (legado)
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-surface-muted bg-white p-3 text-sm">
            <input
              type="checkbox"
              checked={useGeminiLlm}
              onChange={(e) => setUseGeminiLlm(e.target.checked)}
              disabled={!capabilities?.geminiConfigured}
              className="mt-1 rounded border-gray-300"
            />
            <span>
              <span className="font-semibold text-gray-900">Refinar textos com Google Gemini</span>
              <span className="block text-xs text-gray-500">
                {capabilities?.geminiConfigured
                  ? 'Reescreve o pacote em português com o modelo configurado no servidor.'
                  : 'Indisponível: defina GEMINI_API_KEY no backend.'}
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="brand"
              className="gap-2"
              disabled={generateText.isPending}
              onClick={() => generateText.mutate()}
            >
              {generateText.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar texto com IA
            </Button>
            <Button type="button" variant="outline" onClick={() => setStep(3)}>
              Ir para imagens
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 && !campaignId ? (
        <p className="text-sm text-amber-800">Crie o rascunho na etapa 1.</p>
      ) : null}

      {step === 3 && campaignId ? (
        <div className="space-y-6">
          <section>
            <p className="mb-2 flex items-center gap-2 text-sm font-bold text-primary-900">
              <ImageIcon className="h-4 w-4" />
              Imagens já cadastradas
            </p>
            <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {(bankImages ?? []).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBankSelection((prev) => {
                      const n = new Set(prev);
                      if (n.has(b.id)) n.delete(b.id);
                      else n.add(b.id);
                      return n;
                    });
                  }}
                  className={cn(
                    'relative overflow-hidden rounded-lg border-2 text-left',
                    bankSelection.has(b.id) ? 'border-primary-600 ring-2 ring-primary-300' : 'border-transparent',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.url} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 gap-1"
              disabled={addBank.isPending || bankSelection.size === 0}
              onClick={() => addBank.mutate()}
            >
              Adicionar selecionadas à campanha
            </Button>
          </section>

          <section>
            <p className="mb-2 flex items-center gap-2 text-sm font-bold text-primary-900">
              <Upload className="h-4 w-4" />
              Upload (celular / computador)
            </p>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="cursor-pointer"
              onChange={(e) => {
                const list = e.target.files;
                if (!list?.length) return;
                setPendingFiles((prev) => {
                  const add: Array<{ file: File; url: string }> = [];
                  for (const f of Array.from(list)) {
                    add.push({ file: f, url: URL.createObjectURL(f) });
                  }
                  return [...prev, ...add];
                });
                e.target.value = '';
              }}
            />
            <p className="mt-1 text-xs text-gray-500">JPEG, PNG, WebP ou GIF · até 5MB por arquivo (limite Cloudinary)</p>
            {pendingFiles.length ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-700">Pré-visualização antes de enviar</p>
                <div className="flex flex-wrap gap-2">
                  {pendingFiles.map((p, idx) => (
                    <div key={p.url} className="relative w-20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" className="aspect-square w-full rounded-lg object-cover ring-1 ring-gray-200" />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="absolute -right-1 -top-1 h-6 w-6 rounded-full bg-white p-0 text-xs shadow"
                        onClick={() => {
                          URL.revokeObjectURL(p.url);
                          setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="brand"
                  disabled={uploadFiles.isPending}
                  onClick={() => uploadFiles.mutate(pendingFiles.map((p) => p.file))}
                >
                  {uploadFiles.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Enviar {pendingFiles.length} foto(s)
                </Button>
              </div>
            ) : null}
          </section>

          <section>
            <p className="mb-2 flex items-center gap-2 text-sm font-bold text-primary-900">
              <Wand2 className="h-4 w-4" />
              Imagem com IA (opcional — {capabilities?.imageGenerationProvider ?? 'mock'})
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={suggestPrompt.isPending} onClick={() => suggestPrompt.mutate()}>
                {suggestPrompt.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Prompt assistido
              </Button>
              <select
                className="h-9 rounded-lg border px-2 text-sm"
                value={aiCount}
                onChange={(e) => setAiCount(Number(e.target.value) as 2 | 4)}
              >
                <option value={2}>2 variações</option>
                <option value={4}>4 variações</option>
              </select>
            </div>
            <textarea
              className="mt-2 min-h-[100px] w-full rounded-lg border px-3 py-2 text-sm"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Descreva o criativo desejado ou use “Prompt assistido”."
            />
            <Button
              type="button"
              size="sm"
              variant="brand"
              className="mt-2 gap-1"
              disabled={generateAi.isPending || aiPrompt.trim().length < 8}
              onClick={() => generateAi.mutate()}
            >
              {generateAi.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Gerar imagens
            </Button>
          </section>

          <div>
            <p className="mb-2 text-sm font-bold text-primary-900">Na campanha agora</p>
            <div className="flex flex-wrap gap-3">
              {(campaign?.assets ?? []).map((a) => (
                <div key={a.id} className="relative w-24">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt="" className="aspect-square w-full rounded-lg object-cover ring-1 ring-gray-200" />
                  {a.isPrimary ? (
                    <span className="absolute left-1 top-1 rounded bg-primary-800 px-1 text-[9px] text-white">Capa</span>
                  ) : null}
                  <div className="mt-1 flex flex-col gap-1">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] px-1" onClick={() => setPrimary.mutate(a.id)}>
                      Capa
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px] text-red-600"
                      onClick={() => removeAsset.mutate(a.id)}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button type="button" variant="outline" onClick={() => setStep(4)}>
            Ir para preview
          </Button>
        </div>
      ) : null}

      {step === 4 && !campaignId ? (
        <p className="text-sm text-amber-800">Crie o rascunho na etapa 1.</p>
      ) : null}

      {step === 4 && campaignId ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs uppercase text-gray-500">Plataforma da prévia</Label>
            <select
              className="h-10 rounded-lg border px-3 text-sm"
              value={previewPlatform}
              onChange={(e) => setPreviewPlatform(e.target.value)}
            >
              {previewPlatformOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-xs font-bold uppercase text-gray-500">Simulação visual</p>
              <CampaignPlatformPreview
                platform={previewPlatform}
                imageUrl={primaryPreviewUrl}
                copy={previewCopy}
                developmentName={developmentName}
              />
              <p className="text-[10px] text-gray-500">
                {PLATFORMS.find((p) => p.id === previewPlatform)?.hint ?? ''}
              </p>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="rounded-xl border border-surface-muted bg-white p-4">
                <p className="text-xs font-bold uppercase text-gray-500">Texto completo — {previewPlatform}</p>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-sans text-sm text-gray-900">
                  {copyForPreview || 'Gere o texto na etapa 2 para preencher as cópias por plataforma.'}
                </pre>
              </div>
              {previewPlatform === 'WHATSAPP' ? (
                <div className="space-y-2">
                  <WhatsAppActionHint />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="brand"
                      className="gap-2"
                      disabled={!whatsappCaption}
                      onClick={() => window.open(whatsappWaUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Enviar para WhatsApp
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1"
                      disabled={!whatsappCaption}
                      onClick={() => copyText(whatsappCaption)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar mensagem
                    </Button>
                  </div>
                </div>
              ) : null}
              {pack && v ? (
                <div className="rounded-lg border border-amber-100 bg-amber-50/80 p-3 text-sm">
                  <p className="font-semibold text-amber-950">Variação base {varIndex + 1}</p>
                  <p className="mt-1 text-amber-900/90 line-clamp-3">Curta: {v.shortCaption}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="gap-1" onClick={() => copyText(copyForPreview)}>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar bloco da prévia
                </Button>
                <Button type="button" variant="outline" onClick={() => setStep(5)}>
                  Ir para exportar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === 5 && !campaignId ? (
        <p className="text-sm text-amber-800">Crie o rascunho na etapa 1.</p>
      ) : null}

      {step === 5 && campaignId ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            <strong>Modo manual:</strong> copie textos, baixe o pacote JSON ou envie ao WhatsApp. Integração direta com
            Instagram/Facebook fica para uma etapa futura (tokens e revisão de políticas).
          </p>
          <WhatsAppActionHint />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="brand"
              className="gap-2"
              disabled={!whatsappCaption}
              onClick={() => window.open(whatsappWaUrl, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-4 w-4" />
              Enviar para WhatsApp
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={!whatsappCaption}
              onClick={() => copyText(whatsappCaption)}
            >
              <Copy className="h-4 w-4" />
              Copiar mensagem WhatsApp
            </Button>
            <Button type="button" variant="brand" className="gap-2" onClick={() => downloadExport()}>
              <Download className="h-4 w-4" />
              Baixar pacote (JSON)
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={() => markReady.mutate()}>
              Marcar como pronta
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            ID da campanha: {campaignId} · Status alvo nas redes: <code className="rounded bg-slate-100 px-1">EXPORT_PENDING</code> até
            existir integração oficial.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
