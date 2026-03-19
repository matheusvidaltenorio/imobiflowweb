'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Calendar, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDate, formatPrice } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';
import { ScheduleVisitModal } from '@/components/leads/schedule-visit-modal';

const COLUMNS = [
  { id: 'PROSPECCAO', label: 'Prospecção', color: 'gray' },
  { id: 'QUALIFICACAO', label: 'Qualificação', color: 'blue' },
  { id: 'NEGOCIACAO', label: 'Negociação', color: 'yellow' },
  { id: 'VENDIDO', label: 'Vendido', color: 'green' },
  { id: 'PERDIDO', label: 'Perdido', color: 'red' },
] as const;

type LeadStatus = (typeof COLUMNS)[number]['id'];

const COLUMN_COLORS: Record<LeadStatus, string> = {
  PROSPECCAO: 'bg-gray-100 border-gray-200',
  QUALIFICACAO: 'bg-blue-50 border-blue-200',
  NEGOCIACAO: 'bg-amber-50 border-amber-200',
  VENDIDO: 'bg-green-50 border-green-200',
  PERDIDO: 'bg-red-50 border-red-200',
};

const CARD_ACCENT: Record<LeadStatus, string> = {
  PROSPECCAO: 'border-l-gray-400',
  QUALIFICACAO: 'border-l-blue-500',
  NEGOCIACAO: 'border-l-amber-500',
  VENDIDO: 'border-l-green-600',
  PERDIDO: 'border-l-red-500',
};

const LEGACY_STATUS_MAP: Record<string, LeadStatus> = {
  NOVO: 'PROSPECCAO',
  EM_CONTATO: 'QUALIFICACAO',
  VISITA: 'NEGOCIACAO',
  CONVERTIDO: 'VENDIDO',
  PERDIDO: 'PERDIDO',
};

function normalizeStatus(s: string): LeadStatus {
  return (LEGACY_STATUS_MAP[s] || s || 'PROSPECCAO') as LeadStatus;
}

type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  status: string;
  property: { id: string; title: string; price?: unknown };
  createdAt: string;
};

function buildWhatsAppUrl(lead: Lead): string | null {
  const phone = (lead.phone || '').replace(/\D/g, '');
  if (phone.length < 10) return null;
  const msg = `Olá ${lead.name}, vi que você se interessou pelo imóvel ${lead.property?.title || 'imóvel'}. Vamos conversar?`;
  return `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
}

function LeadCard({
  lead,
  status,
  onScheduleVisit,
  onMarkLost,
  isDragging,
}: {
  lead: Lead;
  status: LeadStatus;
  onScheduleVisit: () => void;
  onMarkLost: () => void;
  isDragging?: boolean;
}) {
  const whatsappUrl = buildWhatsAppUrl(lead);
  const price = lead.property?.price != null ? formatPrice(Number(lead.property.price)) : null;

  return (
    <Card
      className={cn(
        'cursor-grab border-l-4 px-4 py-3 shadow-sm transition-shadow active:cursor-grabbing',
        CARD_ACCENT[status],
        isDragging && 'shadow-lg opacity-90'
      )}
    >
      <div className="space-y-2">
        <p className="font-semibold text-gray-900">{lead.name}</p>
        <p className="text-xs text-gray-600">{lead.phone || lead.email}</p>
        <Link
          href={`/property/${lead.property?.id}`}
          className="block text-sm font-medium text-primary-600 hover:underline"
        >
          {lead.property?.title}
          {price && <span className="ml-1 text-gray-500">• {price}</span>}
        </Link>
        <p className="text-xs text-gray-400">{formatDate(lead.createdAt)}</p>
        <div className="flex flex-wrap gap-1.5 pt-2">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
            >
              <MessageCircle className="h-3 w-3" />
              WhatsApp
            </a>
          )}
          {status !== 'VENDIDO' && status !== 'PERDIDO' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onScheduleVisit();
              }}
            >
              <Calendar className="h-3 w-3" />
              Agendar visita
            </Button>
          )}
          {status !== 'PERDIDO' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={(e) => {
                e.stopPropagation();
                onMarkLost();
              }}
            >
              <XCircle className="h-3 w-3" />
              Perdido
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function DraggableLeadCard({
  lead,
  status,
  onScheduleVisit,
  onMarkLost,
}: {
  lead: Lead;
  status: LeadStatus;
  onScheduleVisit: () => void;
  onMarkLost: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { type: 'lead', lead, status },
  });

  return (
    <div ref={setNodeRef} {...attributes} {...listeners}>
      <LeadCard
        lead={lead}
        status={status}
        onScheduleVisit={onScheduleVisit}
        onMarkLost={onMarkLost}
        isDragging={isDragging}
      />
    </div>
  );
}

function KanbanColumn({
  column,
  leads,
  onScheduleVisit,
  onMarkLost,
}: {
  column: (typeof COLUMNS)[number];
  leads: Lead[];
  onScheduleVisit: (lead: Lead) => void;
  onMarkLost: (lead: Lead) => void;
}) {
  const status = column.id;
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-w-[280px] flex-col rounded-lg border-2 transition-colors',
        COLUMN_COLORS[status],
        isOver && 'ring-2 ring-primary-400 ring-offset-2'
      )}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold text-gray-800">{column.label}</h3>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-medium text-gray-600">
          {leads.length}
        </span>
      </div>
      <div className="flex min-h-[200px] flex-1 flex-col gap-3 overflow-y-auto p-3">
        {leads.map((lead) => (
          <DraggableLeadCard
            key={lead.id}
            lead={lead}
            status={status}
            onScheduleVisit={() => onScheduleVisit(lead)}
            onMarkLost={() => onMarkLost(lead)}
          />
        ))}
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [scheduleLead, setScheduleLead] = useState<Lead | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [activeStatus, setActiveStatus] = useState<LeadStatus | null>(null);

  const { data: leads = [], isLoading } = useQuery({
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const leadsByStatus = COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = leads.filter((l: Lead) => normalizeStatus(l.status || '') === col.id);
      return acc;
    },
    {} as Record<LeadStatus, Lead[]>
  );

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current;
    if (data?.lead) {
      setActiveLead(data.lead as Lead);
      setActiveStatus((data.status as LeadStatus) || null);
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveLead(null);
    setActiveStatus(null);
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    const activeData = active.data.current;
    if (!activeData?.lead) return;

    const sourceStatus = (activeData.status as LeadStatus) || 'PROSPECCAO';
    const isOverColumn = COLUMNS.some((c) => c.id === overId);
    let targetStatus: LeadStatus | undefined = isOverColumn ? (overId as LeadStatus) : undefined;
    if (!targetStatus) {
      const col = COLUMNS.find((c) => leadsByStatus[c.id]?.some((l: Lead) => l.id === overId));
      targetStatus = col?.id;
    }
    if (targetStatus && targetStatus !== sourceStatus) {
      updateStatus.mutate({ id: activeData.lead.id, status: targetStatus });
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden p-8">
        <h1 className="mb-6 text-2xl font-bold">Funil de Leads</h1>

        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-80 min-w-[280px] animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {COLUMNS.map((col) => (
                <div
                  key={col.id}
                  data-droppable-id={col.id}
                  className="flex-shrink-0"
                  style={{ minHeight: 400 }}
                >
                  <KanbanColumn
                    column={col}
                    leads={leadsByStatus[col.id] || []}
                    onScheduleVisit={setScheduleLead}
                    onMarkLost={(lead) => updateStatus.mutate({ id: lead.id, status: 'PERDIDO' })}
                  />
                </div>
              ))}
            </div>

            <DragOverlay>
              {activeLead && activeStatus ? (
                <div className="w-[260px]">
                  <LeadCard
                    lead={activeLead}
                    status={activeStatus}
                    onScheduleVisit={() => {}}
                    onMarkLost={() => {}}
                    isDragging
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {scheduleLead && (
          <ScheduleVisitModal
            open
            onOpenChange={(o) => !o && setScheduleLead(null)}
            lead={{
              id: scheduleLead.id,
              name: scheduleLead.name,
              email: scheduleLead.email,
              phone: scheduleLead.phone ?? undefined,
              property: scheduleLead.property,
            }}
          />
        )}
      </main>
    </div>
  );
}
