'use client';

import { useMemo, useState } from 'react';
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
import {
  Banknote,
  Calendar,
  CheckCircle2,
  Filter,
  Flame,
  Home,
  Loader2,
  MessageCircle,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn, formatDate, formatPrice } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import { ScheduleVisitModal } from '@/components/leads/schedule-visit-modal';
import { LeadMessageAssistantDialog } from '@/components/commercial-assistant/lead-message-assistant-dialog';

/** Pipeline comercial (alinhado ao LeadStatus do backend). */
const COLUMNS = [
  { id: 'NOVO_LEAD', label: 'Novo lead', color: 'gray' },
  { id: 'EM_ATENDIMENTO', label: 'Atendimento', color: 'blue' },
  { id: 'VISITA_AGENDADA', label: 'Visita', color: 'indigo' },
  { id: 'PROPOSTA_ENVIADA', label: 'Proposta', color: 'amber' },
  { id: 'RESERVADO', label: 'Reservado', color: 'orange' },
  { id: 'VENDIDO', label: 'Vendido', color: 'green' },
  { id: 'PERDIDO', label: 'Perdido', color: 'red' },
] as const;

type LeadStatus = (typeof COLUMNS)[number]['id'];

const COLUMN_COLORS: Record<LeadStatus, string> = {
  NOVO_LEAD: 'bg-surface border-surface-muted shadow-sm',
  EM_ATENDIMENTO: 'bg-primary-50/80 border-primary-200/80',
  VISITA_AGENDADA: 'bg-indigo-50/90 border-indigo-200/80',
  PROPOSTA_ENVIADA: 'bg-amber-50/90 border-amber-200/80',
  RESERVADO: 'bg-orange-50/90 border-orange-200/80',
  VENDIDO: 'bg-emerald-50/90 border-success-500/25',
  PERDIDO: 'bg-red-50/90 border-red-200',
};

const CARD_ACCENT: Record<LeadStatus, string> = {
  NOVO_LEAD: 'border-l-slate-400',
  EM_ATENDIMENTO: 'border-l-primary-600',
  VISITA_AGENDADA: 'border-l-indigo-500',
  PROPOSTA_ENVIADA: 'border-l-amber-500',
  RESERVADO: 'border-l-orange-500',
  VENDIDO: 'border-l-success-600',
  PERDIDO: 'border-l-red-500',
};

/** Compatibilidade com dados antigos ou migrações parciais. */
const LEGACY_STATUS_MAP: Record<string, LeadStatus> = {
  PROSPECCAO: 'NOVO_LEAD',
  QUALIFICACAO: 'EM_ATENDIMENTO',
  NEGOCIACAO: 'PROPOSTA_ENVIADA',
  NOVO: 'NOVO_LEAD',
  EM_CONTATO: 'EM_ATENDIMENTO',
  VISITA: 'VISITA_AGENDADA',
  CONVERTIDO: 'VENDIDO',
  PERDIDO: 'PERDIDO',
};

function normalizeStatus(s: string): LeadStatus {
  const raw = (LEGACY_STATUS_MAP[s] || s || 'NOVO_LEAD') as string;
  const col = COLUMNS.find((c) => c.id === raw);
  return (col?.id ?? 'NOVO_LEAD') as LeadStatus;
}

type LeadSort = 'default' | 'closing' | 'risk' | 'recent';

const LEAD_SOURCE_FILTER_OPTIONS = [
  { value: '', label: 'Todas as origens' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'SITE', label: 'Site' },
  { value: 'INDICACAO', label: 'Indicação' },
  { value: 'TRAFICO_PAGO', label: 'Tráfego pago' },
  { value: 'OUTRO', label: 'Outro' },
] as const;

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
  development?: { id: string; name: string; city?: string } | null;
  nextFollowUpAt?: string | null;
  lostReason?: string | null;
  closingInterestLevel?: string | null;
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

function daysSinceLast(iso?: string | null): number | null {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d >= 0 ? d : null;
}

function buildWhatsAppUrl(lead: Lead): string | null {
  const phone = (lead.phone || '').replace(/\D/g, '');
  if (phone.length < 10) return null;
  let msg: string;
  if (lead.lot) {
    const dev = lead.lot.block?.development?.name ?? 'loteamento';
    const quadra = lead.lot.block?.name ?? 'quadra';
    msg = `Olá, tenho interesse no lote ${lead.lot.number} da ${quadra} do empreendimento ${dev}.`;
  } else if (lead.development?.name) {
    msg = `Olá ${lead.name}, acompanho seu interesse no empreendimento ${lead.development.name}. Posso ajudar?`;
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
  onCommercial,
  commercialPending,
  isDragging,
}: {
  lead: Lead;
  status: LeadStatus;
  onScheduleVisit: () => void;
  onMarkLost: () => void;
  onOpenAssistant?: () => void;
  onCommercial?: (action: 'WHATSAPP' | 'PROPOSTA' | 'RESERVA' | 'VENDA') => void;
  commercialPending?: boolean;
  isDragging?: boolean;
}) {
  const whatsappUrl = buildWhatsAppUrl(lead);
  const price = lead.property?.price != null ? formatPrice(Number(lead.property.price)) : null;

  const cs = numScore(lead.closingScore);
  const stale = daysSinceLast(lead.leadLastInteractionAt);

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
          {lead.closingInterestLevel ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-700">
              {lead.closingInterestLevel}
            </span>
          ) : null}
        </div>
        <p className="text-[10px] text-gray-500">
          {stale === null
            ? 'Sem interação registrada'
            : stale === 0
              ? 'Contato hoje'
              : `${stale}d sem contato`}
        </p>
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
        ) : lead.development ? (
          <Link
            href={`/developments/edit/${lead.development.id}`}
            className="block text-sm font-medium text-primary-600 hover:underline"
          >
            <span className="inline-flex items-center gap-1">
              <Home className="h-3.5 w-3.5" />
              {lead.development.name}
              {lead.development.city ? ` · ${lead.development.city}` : ''}
            </span>
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
              onClick={(e) => {
                e.stopPropagation();
                onCommercial?.('WHATSAPP');
              }}
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
              Visita
            </Button>
          )}
          {onCommercial && status !== 'VENDIDO' && status !== 'PERDIDO' ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={commercialPending}
                className="h-8 gap-1 px-2 text-[11px] font-bold"
                onClick={(e) => {
                  e.stopPropagation();
                  onCommercial('PROPOSTA');
                }}
              >
                {commercialPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Banknote className="h-3 w-3" />}
                Proposta
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={commercialPending || !lead.lot}
                title={!lead.lot ? 'Associe um lote ao lead' : undefined}
                className="h-8 gap-1 px-2 text-[11px] font-bold"
                onClick={(e) => {
                  e.stopPropagation();
                  onCommercial('RESERVA');
                }}
              >
                Reserva
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={commercialPending || !lead.lot}
                title={!lead.lot ? 'Associe um lote ao lead' : undefined}
                className="h-8 gap-1 px-2 text-[11px] font-bold text-success-800"
                onClick={(e) => {
                  e.stopPropagation();
                  onCommercial('VENDA');
                }}
              >
                <CheckCircle2 className="h-3 w-3" />
                Venda
              </Button>
            </>
          ) : null}
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
  onCommercial,
  commercialPending,
}: {
  lead: Lead;
  status: LeadStatus;
  onScheduleVisit: () => void;
  onMarkLost: () => void;
  onOpenAssistant?: () => void;
  onCommercial?: (action: 'WHATSAPP' | 'PROPOSTA' | 'RESERVA' | 'VENDA') => void;
  commercialPending?: boolean;
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
        onCommercial={onCommercial}
        commercialPending={commercialPending}
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
  onCommercial,
  commercialPendingId,
}: {
  column: (typeof COLUMNS)[number];
  leads: Lead[];
  onScheduleVisit: (lead: Lead) => void;
  onMarkLost: (lead: Lead) => void;
  onOpenAssistant: (lead: Lead) => void;
  onCommercial: (lead: Lead, action: 'WHATSAPP' | 'PROPOSTA' | 'RESERVA' | 'VENDA') => void;
  commercialPendingId: string | null;
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
            onCommercial={(a) => onCommercial(lead, a)}
            commercialPending={commercialPendingId === lead.id}
          />
        ))}
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [scheduleLead, setScheduleLead] = useState<Lead | null>(null);
  const [assistantLead, setAssistantLead] = useState<Lead | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [activeStatus, setActiveStatus] = useState<LeadStatus | null>(null);
  const [sortMode, setSortMode] = useState<LeadSort>('default');
  const [filterDevelopmentId, setFilterDevelopmentId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLeadSource, setFilterLeadSource] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterPriority, setFilterPriority] = useState<'hot' | 'stale' | ''>('');
  const [filterAssignedUserId, setFilterAssignedUserId] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const leadsQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (sortMode !== 'default') {
      p.set(
        'sort',
        sortMode === 'closing' ? 'closing' : sortMode === 'risk' ? 'risk' : 'recent'
      );
    }
    if (filterDevelopmentId) p.set('developmentId', filterDevelopmentId);
    if (filterStatus) p.set('status', filterStatus);
    if (filterLeadSource) p.set('leadSource', filterLeadSource);
    if (filterFrom) p.set('from', filterFrom);
    if (filterTo) p.set('to', filterTo);
    if (filterPriority) p.set('priority', filterPriority);
    if (user?.role === 'ADMIN' && filterAssignedUserId) p.set('assignedUserId', filterAssignedUserId);
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [
    sortMode,
    filterDevelopmentId,
    filterStatus,
    filterLeadSource,
    filterFrom,
    filterTo,
    filterPriority,
    filterAssignedUserId,
    user?.role,
  ]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', leadsQuery],
    queryFn: async () => {
      const { data } = await api.get(`/leads${leadsQuery}`);
      return data;
    },
  });

  const { data: developments = [] } = useQuery({
    queryKey: ['developments'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string }>>('/developments');
      return data;
    },
  });

  const { data: brokerUsers = [] } = useQuery({
    queryKey: ['users', 'CORRETOR'],
    enabled: user?.role === 'ADMIN',
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string }>>('/users?role=CORRETOR');
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

  const commercialMutation = useMutation({
    mutationFn: async (vars: {
      id: string;
      action: 'WHATSAPP' | 'PROPOSTA' | 'RESERVA' | 'VENDA' | 'PERDA';
      lostReason?: string;
    }) => {
      await api.post(`/leads/${vars.id}/commercial-action`, {
        action: vars.action,
        lostReason: vars.lostReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Ação registrada', type: 'success' });
    },
    onError: (err: unknown) => {
      const res = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data;
      const msg = res?.message;
      const text = Array.isArray(msg) ? msg.join(', ') : typeof msg === 'string' ? msg : 'Erro ao executar ação';
      toast({ title: text, type: 'error' });
    },
  });

  const commercialPendingId =
    commercialMutation.isPending && commercialMutation.variables ? commercialMutation.variables.id : null;

  function handleCommercial(lead: Lead, action: 'WHATSAPP' | 'PROPOSTA' | 'RESERVA' | 'VENDA') {
    commercialMutation.mutate({ id: lead.id, action });
  }

  function handleMarkLost(lead: Lead) {
    const reason = window.prompt('Motivo da perda (opcional):');
    if (reason === null) return;
    commercialMutation.mutate({
      id: lead.id,
      action: 'PERDA',
      lostReason: reason.trim() || undefined,
    });
  }

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

    const sourceStatus = (activeData.status as LeadStatus) || 'NOVO_LEAD';
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
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary-950">CRM — Pipeline comercial</h1>
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

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 font-bold"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
          {(filterDevelopmentId ||
            filterStatus ||
            filterLeadSource ||
            filterFrom ||
            filterTo ||
            filterPriority ||
            filterAssignedUserId) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-gray-600"
              onClick={() => {
                setFilterDevelopmentId('');
                setFilterStatus('');
                setFilterLeadSource('');
                setFilterFrom('');
                setFilterTo('');
                setFilterPriority('');
                setFilterAssignedUserId('');
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {filtersOpen ? (
          <div className="mb-8 grid gap-4 rounded-xl border border-surface-muted bg-white px-4 py-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="flt-dev" className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Loteamento
              </Label>
              <select
                id="flt-dev"
                value={filterDevelopmentId}
                onChange={(e) => setFilterDevelopmentId(e.target.value)}
                className="h-10 rounded-lg border border-surface-muted bg-white px-3 text-sm font-medium text-primary-950"
              >
                <option value="">Todos</option>
                {developments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="flt-st" className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Estágio
              </Label>
              <select
                id="flt-st"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 rounded-lg border border-surface-muted bg-white px-3 text-sm font-medium text-primary-950"
              >
                <option value="">Todos</option>
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="flt-src" className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Origem
              </Label>
              <select
                id="flt-src"
                value={filterLeadSource}
                onChange={(e) => setFilterLeadSource(e.target.value)}
                className="h-10 rounded-lg border border-surface-muted bg-white px-3 text-sm font-medium text-primary-950"
              >
                {LEAD_SOURCE_FILTER_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="flt-pri" className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Prioridade
              </Label>
              <select
                id="flt-pri"
                value={filterPriority}
                onChange={(e) => setFilterPriority((e.target.value as 'hot' | 'stale' | '') || '')}
                className="h-10 rounded-lg border border-surface-muted bg-white px-3 text-sm font-medium text-primary-950"
              >
                <option value="">Todas</option>
                <option value="hot">Quente (hot)</option>
                <option value="stale">Sem contato (stale)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="flt-from" className="text-xs font-bold uppercase tracking-wide text-gray-500">
                De (data)
              </Label>
              <Input
                id="flt-from"
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="flt-to" className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Até (data)
              </Label>
              <Input
                id="flt-to"
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="h-10"
              />
            </div>
            {user?.role === 'ADMIN' ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="flt-broker" className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Corretor
                </Label>
                <select
                  id="flt-broker"
                  value={filterAssignedUserId}
                  onChange={(e) => setFilterAssignedUserId(e.target.value)}
                  className="h-10 rounded-lg border border-surface-muted bg-white px-3 text-sm font-medium text-primary-950"
                >
                  <option value="">Todos</option>
                  {brokerUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
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
                    onMarkLost={handleMarkLost}
                    onOpenAssistant={setAssistantLead}
                    onCommercial={handleCommercial}
                    commercialPendingId={commercialPendingId}
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
