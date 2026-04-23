'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  ExternalLink,
  Filter,
  Loader2,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/dashboard/page-header';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

type InAppNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  metadataJson: unknown;
  readAt: string | null;
  createdAt: string;
  developmentId: string | null;
  lotId: string | null;
  dailyAvailabilityId: string | null;
};

function metaLead(n: InAppNotification): { leadId?: string; leadPhone?: string | null; score?: number } {
  const m = n.metadataJson as Record<string, unknown> | null;
  if (!m || typeof m !== 'object') return {};
  return {
    leadId: typeof m.leadId === 'string' ? m.leadId : undefined,
    leadPhone: typeof m.leadPhone === 'string' ? m.leadPhone : null,
    score: typeof m.score === 'number' ? m.score : undefined,
  };
}

function typeLabel(t: string): string {
  if (t === 'MATCH_HIGH') return 'Match (CRM)';
  if (t.startsWith('AVAIL_')) return t.replace(/^AVAIL_/, '').replace(/_/g, ' ');
  return t;
}

export default function AlertsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [typePrefix, setTypePrefix] = useState('AVAIL_');
  const [developmentId, setDevelopmentId] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data: developments } = useQuery({
    queryKey: ['developments'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; city: string }>>('/developments');
      return data;
    },
  });

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (typePrefix.trim()) p.set('typePrefix', typePrefix.trim());
    if (developmentId.trim()) p.set('developmentId', developmentId.trim());
    if (unreadOnly) p.set('unreadOnly', 'true');
    p.set('limit', '80');
    return p.toString();
  }, [typePrefix, developmentId, unreadOnly]);

  const { data: items, isLoading } = useQuery({
    queryKey: ['notifications', queryParams],
    queryFn: async () => {
      const { data } = await api.get<InAppNotification[]>(`/notifications?${queryParams}`);
      return data;
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications-availability-summary'] });
    },
    onError: () => toast({ title: 'Não foi possível marcar como lido', type: 'error' }),
  });

  const waHref = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    const n = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${n}`;
  };

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Central de alertas"
          description="Mudanças na disponibilidade do dia, resumos e matches sugeridos com clientes. Marque como lido após tratar."
        />

        <Card className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-primary-900">
            <Filter className="h-4 w-4" />
            Filtros
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo (prefixo)</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-surface-muted bg-white px-3 text-sm"
                value={typePrefix}
                onChange={(e) => setTypePrefix(e.target.value)}
              >
                <option value="AVAIL_">Disponibilidade e match (AVAIL_*)</option>
                <option value="">Todos os tipos</option>
                <option value="AVAIL_MATCH_CLIENT">Só match com cliente</option>
                <option value="AVAIL_LOT_">Só mudanças de lote</option>
                <option value="AVAIL_DEVELOPMENT_SUMMARY">Só resumos agregados</option>
                <option value="MATCH_HIGH">Match CRM (manual)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Loteamento</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-surface-muted bg-white px-3 text-sm"
                value={developmentId}
                onChange={(e) => setDevelopmentId(e.target.value)}
              >
                <option value="">Todos</option>
                {developments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.city}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Apenas não lidos
          </label>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
          </div>
        ) : !items?.length ? (
          <Card className="p-8 text-center text-sm text-slate-600">
            <Bell className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            Nenhum alerta com esses filtros.
          </Card>
        ) : (
          <ul className="space-y-3">
            {items.map((n) => {
              const unread = !n.readAt;
              const m = metaLead(n);
              const phoneHref = m.leadPhone ? waHref(m.leadPhone) : null;
              return (
                <li key={n.id}>
                  <Card
                    className={cn(
                      'p-4 transition',
                      unread ? 'border-primary-200 bg-primary-50/40 ring-1 ring-primary-100' : 'border-surface-muted',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{typeLabel(n.type)}</p>
                        <p className="mt-1 font-semibold text-primary-950">{n.title}</p>
                        {n.body ? <p className="mt-2 text-sm text-slate-700">{n.body}</p> : null}
                        <p className="mt-2 text-xs text-slate-500">
                          {new Date(n.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {unread ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={markRead.isPending}
                            onClick={() => markRead.mutate(n.id)}
                          >
                            <Check className="h-4 w-4" />
                            Lido
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-surface-muted pt-3">
                      {n.developmentId ? (
                        <Link
                          href={`/disponiveis-hoje?developmentId=${encodeURIComponent(n.developmentId)}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Disponíveis hoje
                        </Link>
                      ) : null}
                      {n.lotId ? (
                        <Link
                          href={`/lots`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                        >
                          Inventário de lotes
                        </Link>
                      ) : null}
                      {m.leadId ? (
                        <Link
                          href={`/crm/matches?leadId=${encodeURIComponent(m.leadId)}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Match / lead
                        </Link>
                      ) : null}
                      {phoneHref ? (
                        <a
                          href={phoneHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      ) : null}
                      {m.leadId ? (
                        <Link
                          href="/leads"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:underline"
                        >
                          Abrir CRM (leads)
                        </Link>
                      ) : null}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
