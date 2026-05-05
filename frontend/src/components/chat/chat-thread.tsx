'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toaster';
import { cn, formatDateTime } from '@/lib/utils';

type Msg = {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  sender: { id: string; name: string; role: string } | null;
};

export function ChatThread({
  conversationId,
  leadPhone,
  compact,
}: {
  conversationId: string;
  leadPhone?: string | null;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [visitAt, setVisitAt] = useState('');

  const { data: pack, isLoading } = useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: async () => {
      const { data } = await api.get<{ messages: Msg[] }>(`/chat/conversations/${conversationId}/messages`);
      return data;
    },
    refetchInterval: 7000,
  });

  useEffect(() => {
    if (!conversationId) return;
    void api.post(`/chat/conversations/${conversationId}/read`);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pack?.messages?.length]);

  const send = useMutation({
    mutationFn: async (content: string) => {
      await api.post(`/chat/conversations/${conversationId}/messages`, { content });
    },
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-unread'] });
    },
    onError: () => toast({ title: 'Não foi possível enviar', type: 'error' }),
  });

  const isBroker = user?.role === 'CORRETOR' || user?.role === 'ADMIN';

  const act = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: object }) => {
      await api.post(path, body ?? {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      toast({ title: 'Ação registrada', type: 'success' });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const t = Array.isArray(msg) ? msg.join(', ') : typeof msg === 'string' ? msg : 'Erro na ação';
      toast({ title: t, type: 'error' });
    },
  });

  function waLink() {
    const raw = (leadPhone || '').replace(/\D/g, '');
    if (raw.length < 10) return null;
    const n = raw.startsWith('55') ? raw : `55${raw}`;
    return `https://wa.me/${n}`;
  }

  async function handoffWa() {
    const url = waLink();
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    try {
      await api.post(`/chat/conversations/${conversationId}/whatsapp-handoff`, {
        phone: leadPhone ?? undefined,
      });
      qc.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
    } catch {
      toast({ title: 'Registro de handoff falhou', type: 'error' });
    }
  }

  function submitVisit() {
    if (!visitAt) return;
    const iso = new Date(visitAt).toISOString();
    act.mutate({
      path: `/chat/conversations/${conversationId}/actions/schedule-visit`,
      body: { scheduledAt: iso },
    });
    setVisitAt('');
  }

  const messages = pack?.messages ?? [];

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', compact ? 'h-[min(70vh,520px)]' : 'flex-1')}>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-surface-muted bg-surface/50 p-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender?.id === user?.id;
            const system = m.type === 'SYSTEM';
            const action = m.type === 'ACTION';
            return (
              <div
                key={m.id}
                className={cn(
                  'flex',
                  system || action ? 'justify-center' : mine ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                    system && 'bg-slate-100 text-center text-xs text-slate-600',
                    action && 'bg-amber-50 text-center text-xs text-amber-900',
                    !system &&
                      !action &&
                      mine &&
                      'bg-primary-600 text-white',
                    !system && !action && !mine && 'bg-white text-primary-950 ring-1 ring-surface-muted',
                  )}
                >
                  {!system && !action && m.sender ? (
                    <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide opacity-80">
                      {m.sender.name}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className="mt-1 text-[10px] opacity-70">{formatDateTime(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {isBroker ? (
        <div className="space-y-2 rounded-lg border border-dashed border-primary-200/80 bg-primary-50/40 p-2">
          <p className="text-center text-[10px] font-bold uppercase tracking-wide text-primary-800">
            Ações comerciais
          </p>
          <div className="flex flex-wrap gap-1.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center">
              <Input
                type="datetime-local"
                value={visitAt}
                onChange={(e) => setVisitAt(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 shrink-0 text-xs"
                disabled={act.isPending || !visitAt}
                onClick={submitVisit}
              >
                Agendar visita
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={act.isPending}
              onClick={() => act.mutate({ path: `/chat/conversations/${conversationId}/actions/proposal` })}
            >
              Proposta
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={act.isPending}
              onClick={() => act.mutate({ path: `/chat/conversations/${conversationId}/actions/reserve-lot` })}
            >
              Reservar lote
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={act.isPending}
              onClick={() => act.mutate({ path: `/chat/conversations/${conversationId}/actions/catalog` })}
            >
              Catálogo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={act.isPending}
              onClick={() => act.mutate({ path: `/chat/conversations/${conversationId}/actions/simulation` })}
            >
              Simular
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 text-xs text-success-700 border-success-200"
          onClick={() => void handoffWa()}
        >
          Continuar no WhatsApp
        </Button>
        <p className="w-full text-[10px] text-gray-500">
          Conversa registrada para sua segurança. Evite fechar negócio fora da plataforma quando possível.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = text.trim();
          if (!v || send.isPending) return;
          send.mutate(v);
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem…"
          className="flex-1"
          maxLength={4000}
        />
        <Button type="submit" disabled={send.isPending || !text.trim()}>
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
