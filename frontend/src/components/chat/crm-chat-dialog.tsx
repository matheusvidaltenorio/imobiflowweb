'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChatThread } from './chat-thread';

export function CrmChatDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: { id: string; name: string; phone?: string | null } | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const ensure = useQuery({
    queryKey: ['chat-ensure-lead', lead?.id],
    enabled: open && !!lead?.id,
    queryFn: async () => {
      const { data } = await api.post<{ conversation: { id: string }; created: boolean }>(
        `/chat/conversations/by-lead/${lead!.id}`,
      );
      return data;
    },
  });

  const convId = ensure.data?.conversation?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0 pb-2">
          <DialogTitle className="text-left">Chat comercial — {lead?.name}</DialogTitle>
        </DialogHeader>
        {ensure.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
          </div>
        ) : ensure.isError ? (
          <p className="text-sm text-red-600">Não foi possível abrir o chat. Verifique permissões do lead.</p>
        ) : convId ? (
          <ChatThread conversationId={convId} leadPhone={lead?.phone} compact />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
