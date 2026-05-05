'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ChatThread } from '@/components/chat/chat-thread';

type ConvRow = {
  id: string;
  title: string;
  unreadCount: number;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  leadId: string | null;
};

export default function ChatPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: async () => {
      const { data } = await api.get<ConvRow[]>('/chat/conversations');
      return data;
    },
  });

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const selectedPhone = null;

  useEffect(() => {
    if (rows.length === 0) return;
    if (!selectedId || !rows.some((r) => r.id === selectedId)) {
      setSelectedId(rows[0]!.id);
    }
  }, [rows, selectedId]);

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary-950">Chat comercial</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Histórico por negócio, integrado ao CRM. Use as ações rápidas para visita, proposta e mais.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(240px,320px)_1fr]">
        <Card className="flex min-h-[320px] flex-col overflow-hidden border-surface-muted md:min-h-0">
          <div className="border-b border-surface-muted px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Conversas</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <p className="p-4 text-sm text-gray-500">Carregando…</p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">Nenhuma conversa ainda. Abra um lead no CRM para iniciar.</p>
            ) : (
              rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    'flex w-full flex-col gap-0.5 border-b border-surface-muted px-3 py-3 text-left text-sm transition hover:bg-primary-50/60',
                    selectedId === r.id && 'bg-primary-100/80',
                  )}
                >
                  <span className="font-semibold text-primary-950 line-clamp-2">{r.title}</span>
                  {r.lastMessagePreview ? (
                    <span className="line-clamp-2 text-xs text-gray-600">{r.lastMessagePreview}</span>
                  ) : null}
                  {r.unreadCount > 0 ? (
                    <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      <MessageCircle className="h-3 w-3" />
                      {r.unreadCount} nova(s)
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="flex min-h-[400px] flex-col overflow-hidden border-surface-muted p-4 md:min-h-0">
          {selectedId ? (
            <>
              <h2 className="mb-3 shrink-0 text-lg font-bold text-primary-950 line-clamp-2">{selected?.title}</h2>
              <ChatThread conversationId={selectedId} leadPhone={selectedPhone} />
            </>
          ) : (
            <p className="text-sm text-gray-500">Selecione uma conversa.</p>
          )}
        </Card>
      </div>
    </main>
  );
}
