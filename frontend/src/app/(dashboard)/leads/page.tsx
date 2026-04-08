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
import { MessageCircle, Calendar, XCircle, Flame, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDate, formatPrice } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';
import { ScheduleVisitModal } from '@/components/leads/schedule-visit-modal';
import { LeadMessageAssistantDialog } from '@/components/commercial-assistant/lead-message-assistant-dialog';

const COLUMNS = [
  { id: 'PROSPECCAO', label: 'Prospecção', color: 'gray' },
  { id: 'QUALIFICACAO', label: 'Qualificação', color: 'blue' },
  { id: 'NEGOCIACAO', label: 'Negociação', color: 'yellow' },
  { id: 'VENDIDO', label: 'Vendido', color: 'green' },
  { id: 'PERDIDO', label: 'Perdido', color: 'red' },
] as const;

type LeadStatus = (typeof COLUMNS)[number]['id'];

const COLUMN_COLORS: Record<LeadStatus, string> = {
  PROSPECCAO: 'bg-surface border-surface-muted shadow-sm',
  QUALIFICACAO: 'bg-primary-50/80 border-primary-200/80',
  NEGOCIACAO: 'bg-accent-50/60 border-accent-200/70',
  VENDIDO: 'bg-emerald-50/90 border-success-500/25',
  PERDIDO: 'bg-red-50/90 border-red-200',
};

const CARD_ACCENT: Record<LeadStatus, string> = {
  PROSPECCAO: 'border-l-primary-300',
  QUALIFICACAO: 'border-l-primary-600',
  NEGOCIACAO: 'border-l-accent-500',
  VENDIDO: 'border-l-success-600',
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

type LeadSort = 'default' | 'closing' | 'risk' | 'recent';

type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  status: string;
  isHot?: boolean;
  leadSource?: string | null;
  leadLastInteractionAt?: string | null;
  closingScore?: number | string | null;
  closingPrediction?: string | null;
  closingReason?: string | null;
  closingNextAction?: string | null;
  closingPriorityLevel?: string | null;
  previousClosingScore?: number | string | null;
  closingPositiveFactors?: string[] | null;
  closingRiskFactors?: string[] | null;
  property: { id: string; title: string; price?: unknown } | null;
  lot?: {
    id: string;
    number: string;
    price?: unknown;
    block?: { id: string; name: string; developmentId: string; development?: { id: string; name: string } };
  } | null;
  createdAt: string;
};

function numScore(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function closingVisualClasses(score: number | null): string {
  if (score == null) return 'ring-0';
  if (score >= 70) return 'ring-2 ring-success-500/35 ring-offset-1';
  if (score >= 50) return 'ring-2 ring-amber-400/40 ring-offset-1';
  return 'ring-2 ring-red-400/35 ring-offset-1';
}

function closingBadgeClass(cs: number): string {
  if (cs >= 85) return 'bg-emerald-100 text-emerald-900';
  if (cs >= 70) return 'bg-green-100 text-green-900';
  if (cs >= 50) return 'bg-amber-100 text-amber-900';
  if (cs >= 30) return 'bg-orange-100 text-orange-900';
  return 'bg-red-100 text-red-900';
}

function sortLeadsForKanban(leads: Lead[], sort: LeadSort): Lead[] {
  const copy = [...leads];
  if (sort === 'closing') {
    copy.sort((a, b) => (numScore(b.closingScore) ?? -1) - (numScore(a.closingScore) ?? -1));
  } else if (sort === 'risk') {
    copy.sort((a, b) => {
      const sa = numScore(a.closingScore);
      const sb = numScore(b.closingScore);
      const va = sa ?? 999;
      const vb = sb ?? 999;
      return va - vb;
    });
  } else if (sort === 'recent') {
    copy.sort((a, b) => {
      const ta = new Date(a.leadLastInteractionAt || a.createdAt).getTime();
      const tb = new Date(b.leadLastInteractionAt || b.createdAt).getTime();
      return tb - ta;
    });
  }
  return copy;
}

function buildWhatsAppUrl(lead: Lead): string | null {
  const phone = (lead.phone || '').replace(/\D/g, '');
  if (phone.length < 10) return null;
  let msg: string;
  if (lead.lot) {
    const dev = lead.lot.block?.development?.name ?? 'loteamento';
    const quadra = lead.lot.block?.name ?? 'quadra';
    msg = `Olá, tenho interesse no lote ${lead.lot.number} da ${quadra} do empreendimento ${dev}.`;
  } else {
    msg = `Olá ${lead.name}, vi que você se interessou pelo imóvel ${lead.property?.title || 'imóvel'}. Vamos conversar?`;
  }
  return `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
}

function LeadCard({
  lead,
  status,
  onScheduleVisit,
  onMarkLost,
  onOpenAssistant,
  isDragging,
}: {
  lead: Lead;
  status: LeadStatus;
  onScheduleVisit: () => void;
  onMarkLost: () => void;
  onOpenAssistant?: () => void;
  isDragging?: boolean;
}) {
  const whatsappUrl = buildWhatsAppUrl(lead);
  const price = lead.property?.price != null ? formatPrice(Number(lead.property.price)) : null;

  const cs = numScore(lead.closingScore);

  return (
    <Card
      className={cn(
        'cursor-grab border-l-4 px-4 py-3 shadow-sm transition-shadow active:cursor-grabbing',
        CARD_ACCENT[status],
        closingVisualClasses(cs),
        isDragging && 'shadow-lg opacity-90'
      )}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-gray-900">{lead.name}</p>
          {cs != null ? (
            <span
              className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums', closingBadgeClass(cs))}
              title={lead.closingPrediction ?? undefined}
            >
              {Math.round(cs)}
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">—</span>
          )}
          {lead.isHot ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-800">
              <Flame className="h-3 w-3" />
              Quente
            </span>
          ) : null}
        </div>
        {lead.closingPrediction ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-800">{lead.closingPrediction}</p>
        ) : null}
        <p className="text-xs text-gray-600">{lead.phone || lead.email}</p>
        {lead.lot ? (
          <Link
            href={`/lots/lots/edit/${lead.lot.id}?development=${lead.lot.block?.developmentId}&block=${lead.lot.block?.id}`}
            className="block text-sm font-medium text-primary-600 hover:underline"
          >
            Lote {lead.lot.number} — {lead.lot.block?.name}
            {lead.lot.block?.development?.name ? ` (${lead.lot.block.development.name})` : ''}
            {lead.lot.price != null && (
              <span className="ml-1 text-gray-500">• {formatPrice(Number(lead.lot.price))}</span>
            )}
          </Link>
        ) : (
          <Link
            href={`/property/${lead.property?.id}`}
            className="block text-sm font-medium text-primary-600 hover:underline"
          >
            {lead.property?.title}
            {price && <span className="ml-1 text-gray-500">• {price}</span>}
          </Link>
        )}
        <p className="text-xs text-gray-400">{formatDate(lead.createdAt)}</p>
        <div className="flex flex-wrap gap-1.5 pt-2">
          {onOpenAssistant && status !== 'VENDIDO' && status !== 'PERDIDO' ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 border-primary-200 bg-primary-50/80 px-2.5 text-xs font-bold text-primary-900 hover:bg-primary-100"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAssistant();
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              IA
            </Button>
          ) : null}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-lg bg-success-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-md shadow-success-600/25 transition hover:bg-success-700"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          )}
          {status !== 'VENDIDO' && status !== 'PERDIDO' && (
            <Button
              variant="default"
              size="sm"
              className="h-8 gap-1 px-2.5 text-xs font-bold"
              onClick={(e) => {
                e.stopPropagation();
                onScheduleVisit();
              }}
            >
              <Calendar className="h-3.5 w-3.5" />
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
  onOpenAssistant,
}: {
  lead: Lead;
  status: LeadStatus;
  onScheduleVisit: () => void;
  onMarkLost: () => void;
  onOpenAssistant?: () => void;
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
        onOpenAssistant={onOpenAssistant}
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
  onOpenAssistant,
}: {
  column: (typeof COLUMNS)[number];
  leads: Lead[];
  onScheduleVisit: (lead: Lead) => void;
  onMarkLost: (lead: Lead) => void;
  onOpenAssistant: (lead: Lead) => void;
}) {
  const status = column.id;
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-w-[280px] flex-col rounded-lg border-2 transition-colors',
        COLUMN_COLORS[status],
        isOver && 'ring-2 ring-accent-400 ring-offset-2'
      )}
    >
      <div className="flex items-center justify-between border-b border-inherit bg-white/50 px-4 py-3 backdrop-blur-sm">
        <h3 className="text-sm font-bold uppercase tracking-wide text-primary-950">{column.label}</h3>
        <span className="rounded-full bg-primary-950 px-2.5 py-0.5 text-xs font-bold text-white tabular-nums">
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
            onOpenAssistant={() => onOpenAssistant(lead)}
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
  const [assistantLead, setAssistantLead] = useState<Lead | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [activeStatus, setActiveStatus] = useState<LeadStatus | null>(null);
  const [sortMode, setSortMode] = useState<LeadSort>('default');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', sortMode],
    queryFn: async () => {
      const q =
        sortMode === 'default'
          ? ''
          : `?sort=${sortMode === 'closing' ? 'closing' : sortMode === 'risk' ? 'risk' : 'recent'}`;
      const { data } = await api.get(`/leads${q}`);
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
      const bucket = leads.filter((l: Lead) => normalizeStatus(l.status || '') === col.id);
      acc[col.id] = sortLeadsForKanban(bucket, sortMode);
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
    <main className="overflow-hidden bg-surface p-6 md:p-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary-950">Funil de leads</h1>
            <p className="mt-2 max-w-2xl text-gray-600">
              Arraste os cards entre etapas, responda rápido no WhatsApp e agende visitas — cada movimento aproxima a
              venda. O número no card é a chance de fechamento (0–100), com anel verde, âmbar ou vermelho.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="lead-sort" className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Ordenar dentro das colunas
            </label>
            <select
              id="lead-sort"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as LeadSort)}
              className="h-10 min-w-[220px] rounded-lg border border-surface-muted bg-white px-3 text-sm font-medium text-primary-950 shadow-sm"
            >
              <option value="default">Recentes (padrão)</option>
              <option value="closing">Maior chance de fechamento</option>
              <option value="risk">Leads em risco / menor score</option>
              <option value="recent">Mais contato recente</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-80 min-w-[280px] animate-pulse rounded-2xl bg-surface-muted/80" />
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
                    onOpenAssistant={setAssistantLead}
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
              property: scheduleLead.property ?? undefined,
              lot: scheduleLead.lot ?? undefined,
            }}
          />
        )}

        <LeadMessageAssistantDialog
          lead={
            assistantLead
              ? {
                  id: assistantLead.id,
                  name: assistantLead.name,
                  phone: assistantLead.phone,
                  closingScore: numScore(assistantLead.closingScore) ?? undefined,
                  closingPrediction: assistantLead.closingPrediction ?? undefined,
                  closingReason: assistantLead.closingReason ?? undefined,
                  closingNextAction: assistantLead.closingNextAction ?? undefined,
                  previousClosingScore: numScore(assistantLead.previousClosingScore) ?? undefined,
                  closingPositiveFactors: Array.isArray(assistantLead.closingPositiveFactors)
                    ? assistantLead.closingPositiveFactors
                    : undefined,
                  closingRiskFactors: Array.isArray(assistantLead.closingRiskFactors)
                    ? assistantLead.closingRiskFactors
                    : undefined,
                }
              : null
          }
          open={!!assistantLead}
          onOpenChange={(o) => !o && setAssistantLead(null)}
        />
    </main>
  );
}
