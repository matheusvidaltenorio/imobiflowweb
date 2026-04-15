'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Building2, Megaphone } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/dashboard/page-header';
import { CampaignStudioWizard } from '@/components/marketing/campaign-studio-wizard';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toaster';

type DevelopmentOption = {
  id: string;
  name: string;
  city: string;
};

type MapLot = {
  id: string;
  number: string;
  blockId: string;
};

export default function PublicationCenterPage() {
  const pathname = usePathname();
  const { toast } = useToast();
  const [developmentId, setDevelopmentId] = useState<string>('');
  const [lotId, setLotId] = useState<string>('');
  const [scope, setScope] = useState<'development' | 'lot'>('development');

  const { data: developments, isLoading: devLoading } = useQuery({
    queryKey: ['developments'],
    queryFn: async () => {
      const { data } = await api.get<DevelopmentOption[]>('/developments');
      return data;
    },
  });

  const selectedDev = useMemo(
    () => developments?.find((d) => d.id === developmentId),
    [developments, developmentId],
  );

  const { data: mapData } = useQuery({
    queryKey: ['lot-map', developmentId, 'publication-picker'],
    queryFn: async () => {
      const { data } = await api.get<{ lots: MapLot[] }>(
        `/lots/development/${developmentId}/map?nearbyRadius=3000&nearbyMode=driving`,
      );
      return data;
    },
    enabled: !!developmentId,
  });

  const lotOptions = useMemo(() => {
    const list = mapData?.lots ?? [];
    return [...list].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  }, [mapData?.lots]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const ok = sp.get('meta_connected');
    const err = sp.get('meta_error');
    const errCode = sp.get('meta_error_code');
    if (!ok && !err) return;
    if (ok) {
      toast({ title: 'Conta Meta conectada', description: 'Páginas sincronizadas para publicação.', type: 'success' });
    }
    if (err) {
      const titles: Record<string, string> = {
        redirect_uri: 'redirect_uri — app Meta e servidor devem coincidir',
        scopes: 'Permissões Meta',
        access_denied: 'Autorização cancelada',
        url_blocked: 'URL bloqueada ou contexto inválido',
        session: 'Sessão OAuth expirada',
        token: 'Token inválido',
        callback: 'Erro ao finalizar conexão',
        incomplete: 'Resposta incompleta da Meta',
        meta_oauth: 'Conexão Meta',
      };
      toast({
        title: (errCode && titles[errCode]) || 'Erro ao conectar com a Meta',
        description: decodeURIComponent(err),
        type: 'error',
      });
    }
    window.history.replaceState({}, '', pathname || '/publication');
  }, [pathname, toast]);

  return (
    <main className="min-h-0 bg-slate-50/30 p-4 sm:p-6 md:p-8 lg:p-10">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Centro de publicação"
          description="Monte campanhas para Instagram, Facebook e WhatsApp: texto com IA, imagens do banco, upload ou geração por IA, pré-visualização e publicação direta quando a Meta estiver conectada — ou fluxo assistido (copiar, baixar, WhatsApp)."
          breadcrumbs={[{ label: 'Centro de publicação' }]}
        />

        <Card className="mb-8 border-primary-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-800">
              <Megaphone className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-bold text-primary-950">1. O que você vai divulgar</h2>
              <p className="mt-1 text-sm text-slate-600">
                Escolha o empreendimento e, se quiser, um lote específico. Depois use o construtor abaixo para texto,
                imagens e canais.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="pub-dev">Loteamento</Label>
              <select
                id="pub-dev"
                className={cn(
                  'mt-1 flex h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                )}
                value={developmentId}
                disabled={devLoading}
                onChange={(e) => {
                  const v = e.target.value;
                  setDevelopmentId(v);
                  setLotId('');
                  setScope('development');
                }}
              >
                <option value="">{devLoading ? 'Carregando…' : 'Selecione…'}</option>
                {(developments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Escopo</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!developmentId}
                  onClick={() => {
                    setScope('development');
                    setLotId('');
                  }}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-semibold transition',
                    scope === 'development'
                      ? 'bg-primary-800 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                    !developmentId && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <Building2 className="h-4 w-4" aria-hidden />
                    Loteamento inteiro
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!developmentId || !lotOptions.length}
                  onClick={() => setScope('lot')}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-semibold transition',
                    scope === 'lot'
                      ? 'bg-primary-800 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                    (!developmentId || !lotOptions.length) && 'cursor-not-allowed opacity-50',
                  )}
                >
                  Lote específico
                </button>
              </div>
              {developmentId && !lotOptions.length ? (
                <p className="mt-2 text-xs text-amber-800">Nenhum lote com mapa cadastrado neste empreendimento.</p>
              ) : null}
            </div>
          </div>

          {scope === 'lot' && developmentId && lotOptions.length > 0 ? (
            <div className="mt-4 max-w-md">
              <Label htmlFor="pub-lot">Lote</Label>
              <select
                id="pub-lot"
                className="mt-1 flex h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                value={lotId}
                onChange={(e) => setLotId(e.target.value)}
              >
                <option value="">Selecione o lote…</option>
                {lotOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    #{l.number}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </Card>

        {developmentId && (scope === 'development' || (scope === 'lot' && lotId)) ? (
          <CampaignStudioWizard
            mode={scope === 'lot' ? 'lot' : 'development'}
            developmentId={developmentId}
            lotId={scope === 'lot' ? lotId : undefined}
            developmentName={selectedDev?.name}
            title="2. Construtor de campanha"
          />
        ) : developmentId && scope === 'lot' && !lotId ? (
          <Card className="border-dashed border-amber-200 bg-amber-50/50 p-6 text-sm text-amber-950">
            Selecione um lote acima para abrir o construtor de campanha.
          </Card>
        ) : (
          <Card className="border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-sm text-slate-600">
            Escolha um loteamento para habilitar o construtor de campanha e o histórico de rascunhos.
          </Card>
        )}
      </div>
    </main>
  );
}
