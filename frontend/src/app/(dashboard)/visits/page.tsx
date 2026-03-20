'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';

const STATUS_LABELS: Record<string, string> = {
  AGENDADA: 'Agendada',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
  REMARCADA: 'Remarcada',
};

type VisitRow = {
  id: string;
  scheduledAt: string;
  status: string;
  property: { id: string; title: string };
  client?: { name: string };
  lead?: { name: string; email: string; phone?: string };
};

export default function VisitsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: visits, isLoading } = useQuery({
    queryKey: ['visits'],
    queryFn: async () => {
      const { data } = await api.get('/visits');
      return data;
    },
  });

  const visitsByDate = useMemo((): [string, VisitRow[]][] => {
    if (!visits?.length) return [];
    const grouped = new Map<string, VisitRow[]>();
    for (const v of visits as VisitRow[]) {
      const dateKey = formatDate(v.scheduledAt);
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey)!.push(v);
    }
    for (const arr of Array.from(grouped.values())) {
      arr.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => {
      const dateA = new Date(a.split('/').reverse().join('-'));
      const dateB = new Date(b.split('/').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });
  }, [visits]);

  const deleteVisit = useMutation({
    mutationFn: (id: string) => api.delete(`/visits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      toast({ title: 'Visita removida', type: 'success' });
      setDeleting(null);
    },
    onError: () => {
      toast({ title: 'Erro ao remover', type: 'error' });
      setDeleting(null);
    },
  });

  function confirmDelete(id: string) {
    if (confirm('Excluir esta visita?')) {
      setDeleting(id);
      deleteVisit.mutate(id);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Agenda de Visitas</h1>
          <Link href="/visits/new">
            <Button>Nova Visita</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : visits?.length ? (
          <div className="space-y-8">
            {visitsByDate.map(([dateKey, dateVisits]) => (
              <div key={dateKey}>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
                  <span className="rounded bg-primary-100 px-2 py-1 text-primary-700">{dateKey}</span>
                  <span className="text-sm font-normal text-gray-500">({dateVisits.length} visita(s))</span>
                </h2>
                <div className="space-y-3">
                  {dateVisits.map((v: VisitRow) => {
                    const contactName = v.client?.name || v.lead?.name || 'Sem cliente';
                    return (
                      <Card key={v.id} className="overflow-hidden">
                        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-gray-500">
                                {new Date(v.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                                v.status === 'REALIZADA' ? 'bg-green-100 text-green-700' :
                                v.status === 'CANCELADA' ? 'bg-red-100 text-red-700' :
                                v.status === 'REMARCADA' ? 'bg-amber-100 text-amber-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {STATUS_LABELS[v.status] || v.status}
                              </span>
                            </div>
                            <Link href={`/property/${v.property?.id}`} className="mt-1 block font-semibold text-gray-900 hover:text-primary-600">
                              {v.property?.title}
                            </Link>
                            <p className="text-sm text-gray-500">{contactName}</p>
                            {v.lead && !v.client && (
                              <p className="text-xs text-gray-400">Lead vinculado</p>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Link href={`/visits/edit/${v.id}`}>
                              <Button variant="outline" size="sm">Editar</Button>
                            </Link>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => confirmDelete(v.id)}
                              disabled={deleting === v.id}
                            >
                              Excluir
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-gray-500 mb-4">Nenhuma visita agendada.</p>
            <Link href="/visits/new">
              <Button>Agendar primeira visita</Button>
            </Link>
          </Card>
        )}
      </main>
    </div>
  );
}
