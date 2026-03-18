'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';
import { ScheduleVisitModal } from '@/components/leads/schedule-visit-modal';

const LEAD_STATUS = [
  { value: 'NOVO', label: 'Novo' },
  { value: 'EM_CONTATO', label: 'Em contato' },
  { value: 'VISITA', label: 'Visita' },
  { value: 'CONVERTIDO', label: 'Convertido' },
  { value: 'PERDIDO', label: 'Perdido' },
];

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [scheduleLeadId, setScheduleLeadId] = useState<string | null>(null);

  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data } = await api.get('/leads');
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/leads/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Status atualizado', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao atualizar', type: 'error' }),
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="mb-8 text-2xl font-bold">Leads</h1>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : leads?.length ? (
          <div className="space-y-4">
            {leads.map((l: {
              id: string;
              name: string;
              email: string;
              phone?: string;
              message?: string;
              status: string;
              property: { id: string; title: string };
              createdAt: string;
            }) => {
              const whatsappNumber = (l.phone || '').replace(/\D/g, '');
              const hasWhatsApp = whatsappNumber.length >= 10;
              const whatsappLink = hasWhatsApp
                ? `https://wa.me/55${whatsappNumber}?text=Olá ${encodeURIComponent(l.name)}! Vi seu interesse no imóvel ${encodeURIComponent(l.property?.title || '')}.`
                : null;
              return (
                <Card key={l.id} className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-lg">{l.name}</p>
                        <select
                          value={l.status || 'NOVO'}
                          onChange={(e) => updateStatus.mutate({ id: l.id, status: e.target.value })}
                          className={`rounded px-2 py-1 text-sm font-medium ${
                            l.status === 'CONVERTIDO' ? 'bg-green-100 text-green-700' :
                            l.status === 'PERDIDO' ? 'bg-red-100 text-red-700' :
                            l.status === 'VISITA' ? 'bg-blue-100 text-blue-700' :
                            l.status === 'EM_CONTATO' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {LEAD_STATUS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-sm text-gray-500">{l.email} {l.phone && `• ${l.phone}`}</p>
                      <Link
                        href={`/property/${l.property?.id}`}
                        className="mt-1 inline-block text-sm text-primary-600 hover:underline"
                      >
                        📍 {l.property?.title}
                      </Link>
                      {l.message && (
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{l.message}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">{formatDate(l.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {whatsappLink && (
                        <a
                          href={whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                        >
                          WhatsApp
                        </a>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setScheduleLeadId(l.id)}
                      >
                        Agendar visita
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500">Nenhum lead recebido.</p>
        )}

        {scheduleLeadId && (() => {
          const l = leads?.find((x: { id: string }) => x.id === scheduleLeadId);
          if (!l) return null;
          return (
            <ScheduleVisitModal
              open
              onOpenChange={(o) => !o && setScheduleLeadId(null)}
              lead={{
                id: l.id,
                name: l.name,
                email: l.email,
                phone: l.phone,
                property: l.property,
              }}
            />
          );
        })()}
      </main>
    </div>
  );
}
