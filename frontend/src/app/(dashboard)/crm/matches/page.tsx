'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/dashboard/page-header';
import { useToast } from '@/components/ui/toaster';

type Suggestion = {
  id: string;
  kind: 'LOT' | 'PROPERTY';
  score: unknown;
  reasonsJson: unknown;
  lot?: { number: string; block?: { name: string; development?: { name: string } } };
  property?: { title: string; city: string };
};

export default function CrmMatchesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [leadId, setLeadId] = useState('');

  useEffect(() => {
    const l = searchParams.get('leadId');
    if (l) setLeadId(l);
  }, [searchParams]);

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['matching-suggestions', leadId],
    queryFn: async () => {
      const { data } = await api.get<Suggestion[]>(`/matching/leads/${leadId}/suggestions`);
      return data;
    },
    enabled: !!leadId,
  });

  const refresh = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Suggestion[]>(`/matching/leads/${leadId}/refresh`);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Matches atualizados', type: 'success' });
      qc.invalidateQueries({ queryKey: ['matching-suggestions', leadId] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao atualizar';
      toast({ title: msg, type: 'error' });
    },
  });

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="Match inteligente"
          description="Sugestões ranqueadas com base no perfil de interesse do lead. Use “Atualizar” após editar o perfil."
        />

        <Card className="flex flex-wrap items-end gap-4 p-6">
          <div className="min-w-[200px] flex-1 space-y-2">
            <Label>Lead (ID)</Label>
            <Input value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="ID do lead" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={!leadId || refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            {refresh.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar matches
          </Button>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
          </div>
        ) : suggestions?.length ? (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase text-gray-500">{s.kind}</p>
                    <p className="font-semibold text-primary-950">
                      {s.kind === 'LOT'
                        ? `Lote ${s.lot?.number} · ${s.lot?.block?.name} · ${s.lot?.block?.development?.name ?? ''}`
                        : s.property?.title}
                    </p>
                  </div>
                  <span className="rounded-lg bg-primary-100 px-2 py-1 text-sm font-bold text-primary-900">
                    Score {Number(s.score).toFixed(3)}
                  </span>
                </div>
                <pre className="mt-2 max-h-32 overflow-auto rounded bg-surface p-2 text-xs text-gray-700">
                  {JSON.stringify(s.reasonsJson, null, 2)}
                </pre>
              </Card>
            ))}
          </div>
        ) : leadId ? (
          <p className="text-center text-gray-600">Nenhuma sugestão. Atualize o perfil de interesse ou clique em “Atualizar”.</p>
        ) : null}
      </div>
    </main>
  );
}
