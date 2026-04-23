'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Mic } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/dashboard/page-header';
import { useToast } from '@/components/ui/toaster';

type Extraction = {
  clientName?: string;
  phone?: string;
  email?: string;
  budgetMax?: number;
  minAreaM2?: number;
  intent?: string;
  notes?: string;
  rawTranscript: string;
  parserVersion?: string;
};

export default function CrmAudioPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const defaultLeadId = searchParams.get('leadId') ?? '';
  const [leadId, setLeadId] = useState(defaultLeadId);
  const [draft, setDraft] = useState<Extraction | null>(null);
  const [audioId, setAudioId] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      if (leadId) fd.append('leadId', leadId);
      const { data } = await api.post<{
        id: string;
        extractionJson: Extraction | null;
        transcriptRaw: string | null;
      }>('/audio-ingestion/upload', fd);
      return data;
    },
    onSuccess: (data) => {
      setAudioId(data.id);
      const ex = data.extractionJson as Extraction | null;
      setDraft(ex ?? { rawTranscript: data.transcriptRaw ?? '', parserVersion: 'unknown' });
      setConfirmName(ex?.clientName ?? '');
      setConfirmEmail(ex?.email ?? '');
      toast({ title: 'Áudio processado — revise antes de salvar', type: 'success' });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao processar áudio';
      toast({ title: msg, type: 'error' });
    },
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!audioId || !draft) return;
      await api.post(`/audio-ingestion/${audioId}/apply`, {
        ...draft,
        confirmLeadName: confirmName || undefined,
        confirmLeadEmail: confirmEmail || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: 'Dados aplicados ao lead/perfil', type: 'success' });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao aplicar';
      toast({ title: msg, type: 'error' });
    },
  });

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Cadastro por áudio"
          description="Envie áudio para transcrever e gerar sugestões de dados. Revise antes de confirmar."
        />

        <Card className="space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="lead">Lead (ID)</Label>
            <Input
              id="lead"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              placeholder="Cole o ID do lead no CRM"
            />
          </div>
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/40 px-6 py-10 text-center">
            <Mic className="h-10 w-10 text-primary-700" />
            <span className="text-sm font-semibold text-primary-900">Toque para enviar áudio</span>
            <span className="text-xs text-gray-600">WebM, MP3, M4A ou WAV · até 15MB</span>
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              disabled={upload.isPending || !leadId}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) upload.mutate(f);
              }}
            />
          </label>
          {upload.isPending ? (
            <div className="flex flex-col items-center gap-2 py-4 text-sm text-gray-600">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              Transcrevendo e extraindo…
            </div>
          ) : null}
        </Card>

        {draft ? (
          <Card className="space-y-4 p-6">
            <h3 className="mb-2 text-sm font-bold text-primary-950">Revisar texto</h3>
            <div className="space-y-2">
              <Label>Transcrição</Label>
              <textarea
                className="min-h-[120px] w-full rounded-lg border border-surface-muted bg-white px-3 py-2 text-sm"
                value={draft.rawTranscript}
                onChange={(e) => setDraft({ ...draft, rawTranscript: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome (confirmar)</Label>
                <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>E-mail (confirmar)</Label>
                <Input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={draft.phone ?? ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Orçamento máx. (R$)</Label>
                <Input
                  type="number"
                  value={draft.budgetMax ?? ''}
                  onChange={(e) =>
                    setDraft({ ...draft, budgetMax: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              variant="brand"
              disabled={apply.isPending || !audioId}
              onClick={() => apply.mutate()}
            >
              {apply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Aplicar ao lead
            </Button>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
