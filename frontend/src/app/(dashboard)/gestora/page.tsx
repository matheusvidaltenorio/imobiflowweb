'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ChevronRight, MapPinned } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/dashboard/page-header';

type GestoraAccessRow = {
  id: string;
  developmentId: string;
  assistedImageEnabled: boolean;
  spreadsheetImportEnabled: boolean;
  publishMode: 'IMMEDIATE' | 'PENDING_REVIEW';
  development: { id: string; name: string; city: string };
};

export default function GestoraHubPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['gestora-my-developments'],
    queryFn: async () => {
      const { data } = await api.get<GestoraAccessRow[]>('/gestora/my-developments');
      return data;
    },
  });

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader
          title="Meus loteamentos"
          description="Abra a disponibilidade do dia apenas nos empreendimentos autorizados para sua conta."
        />

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200/80" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-rose-700">Não foi possível carregar seus loteamentos. Tente novamente.</p>
        ) : !data?.length ? (
          <Card className="p-6 text-sm text-slate-600">
            Nenhum loteamento vinculado ainda. Peça ao administrador da ImobiFlow para autorizar seu acesso.
          </Card>
        ) : (
          <ul className="space-y-3">
            {data.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/gestora/daily-availability/${row.developmentId}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-surface-muted bg-white p-4 shadow-sm transition hover:border-primary-300 hover:bg-primary-50/40"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold text-primary-950">
                      <MapPinned className="h-4 w-4 shrink-0 text-primary-700" strokeWidth={1.75} />
                      <span className="truncate">{row.development.name}</span>
                    </p>
                    <p className="mt-1 truncate text-sm text-slate-600">{row.development.city}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {row.publishMode === 'PENDING_REVIEW' ? (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-900">Revisão admin</span>
                      ) : (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-900">Publicação imediata</span>
                      )}
                      {row.assistedImageEnabled ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">Imagem</span>
                      ) : null}
                      {row.spreadsheetImportEnabled ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">Planilha</span>
                      ) : null}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-700">
                    <CalendarClock className="h-4 w-4" />
                    Abrir
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
