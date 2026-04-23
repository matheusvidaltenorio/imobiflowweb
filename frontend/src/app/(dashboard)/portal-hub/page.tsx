'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Radio } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/dashboard/page-header';

type Listing = {
  id: string;
  portal: string;
  publicationStatus: string;
  title: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  lot?: { number: string; block?: { name: string } };
  property?: { title: string };
};

export default function PortalHubPage() {
  const { data: listings, isLoading } = useQuery({
    queryKey: ['portal-hub-listings'],
    queryFn: async () => {
      const { data } = await api.get<Listing[]>('/portal-hub/listings');
      return data;
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ['portal-hub-analytics'],
    queryFn: async () => {
      const { data } = await api.get<
        Record<string, unknown> & { portalListingsTotal?: number; externalLeadsByPortal?: Record<string, number> }
      >('/portal-hub/analytics/summary');
      return data;
    },
  });

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Hub de portais"
          description="Publicações unificadas por conector. Conectores reais podem ser plugados sem alterar o core."
        />

        {analytics ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs font-bold uppercase text-gray-500">Anúncios rastreados</p>
              <p className="text-2xl font-bold text-primary-950">{analytics.portalListingsTotal ?? 0}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-bold uppercase text-gray-500">Leads externos (por portal)</p>
              <pre className="mt-1 text-xs text-gray-700">
                {JSON.stringify(analytics.externalLeadsByPortal ?? {}, null, 2)}
              </pre>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-bold uppercase text-gray-500">Webhook</p>
              <p className="mt-1 text-xs text-gray-600">
                POST <code className="rounded bg-slate-100 px-1">/api/portal-hub/webhooks/:portal/leads</code>
              </p>
            </Card>
          </div>
        ) : null}

        <Card className="overflow-hidden">
          <div className="border-b border-surface-muted bg-surface px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-primary-950">
              <Radio className="h-4 w-4" />
              Listagens
            </h2>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : listings?.length ? (
            <ul className="divide-y divide-surface-muted">
              {listings.map((l) => (
                <li key={l.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-primary-950">{l.title ?? '(sem título)'}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold">{l.publicationStatus}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    {l.portal} · {l.lot ? `Lote ${l.lot.number}` : l.property?.title ?? '—'}
                  </p>
                  {l.lastError ? (
                    <p className="mt-1 text-xs text-red-600">{l.lastError}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-gray-600">Nenhuma publicação ainda. Crie rascunhos via API ou próxima evolução da UI.</p>
          )}
        </Card>
      </div>
    </main>
  );
}
