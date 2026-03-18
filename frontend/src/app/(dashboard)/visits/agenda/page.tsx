'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Button } from '@/components/ui/button';

const STATUS_COLORS: Record<string, string> = {
  AGENDADA: '#2563eb',
  REALIZADA: '#16a34a',
  CANCELADA: '#dc2626',
  REMARCADA: '#d97706',
};

const STATUS_LABELS: Record<string, string> = {
  AGENDADA: 'Agendada',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
  REMARCADA: 'Remarcada',
};

export default function AgendaPage() {
  const { data: visits, isLoading } = useQuery({
    queryKey: ['visits'],
    queryFn: async () => {
      const { data } = await api.get('/visits');
      return data;
    },
  });

  const events = useMemo(() => {
    if (!visits?.length) return [];
    return visits.map((v: {
      id: string;
      scheduledAt: string;
      status: string;
      property: { id: string; title: string };
      client?: { name: string };
      lead?: { name: string };
    }) => {
      const contactName = v.client?.name || v.lead?.name || '';
      const title = contactName ? `${v.property?.title} - ${contactName}` : v.property?.title || 'Visita';
      return {
        id: v.id,
        title,
        start: v.scheduledAt,
        backgroundColor: STATUS_COLORS[v.status] || '#64748b',
        borderColor: STATUS_COLORS[v.status] || '#64748b',
        extendedProps: {
          status: v.status,
          statusLabel: STATUS_LABELS[v.status] || v.status,
          propertyId: v.property?.id,
        },
      };
    });
  }, [visits]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Agenda</h1>
          <div className="flex gap-2">
            <Link href="/visits/new">
              <Button>Nova Visita</Button>
            </Link>
            <Link href="/visits">
              <Button variant="outline">Lista de Visitas</Button>
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
              {STATUS_LABELS[status]}
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="h-[600px] animate-pulse rounded-xl bg-gray-200" />
        ) : (
          <div className="rounded-xl border bg-white p-4">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
              }}
              buttonText={{
                today: 'Hoje',
                month: 'Mês',
                week: 'Semana',
                day: 'Dia',
                list: 'Lista',
              }}
              locale={ptBrLocale}
              events={events}
              eventClick={(info) => {
                const id = info.event.id;
                if (id) window.location.href = `/visits/edit/${id}`;
              }}
              height="auto"
            />
          </div>
        )}
      </main>
    </div>
  );
}
