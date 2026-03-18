'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';

const schema = z.object({
  scheduledAt: z.string().min(1, 'Data/hora obrigatória'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function buildWhatsAppConfirmation(
  clientName: string,
  propertyTitle: string,
  scheduledAt: string
): string {
  const date = new Date(scheduledAt);
  const dateStr = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Olá ${clientName}! Confirmando a visita ao imóvel *${propertyTitle}* agendada para ${dateStr} às ${timeStr}. Qualquer dúvida, estou à disposição!`;
}

type ScheduleVisitModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    property: { id: string; title: string };
  };
};

export function ScheduleVisitModal({ open, onOpenChange, lead }: ScheduleVisitModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [visitCreated, setVisitCreated] = useState<{ phone?: string; clientName: string; propertyTitle: string; scheduledAt: string } | null>(null);

  const defaultDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  })();

  const { register, handleSubmit, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { scheduledAt: defaultDate },
  });

  const create = useMutation({
    mutationFn: (d: FormData) =>
      api.post('/visits', {
        propertyId: lead.property.id,
        leadId: lead.id,
        scheduledAt: d.scheduledAt,
        notes: d.notes || undefined,
      }),
    onSuccess: (res, variables) => {
      const data = res?.data as { lead?: { phone?: string }; client?: { phone?: string } };
      const phone = (data?.lead?.phone || data?.client?.phone || lead.phone || '').replace(/\D/g, '');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      toast({ title: 'Visita agendada!', type: 'success' });
      const payload = {
        phone: phone.length >= 10 ? phone : undefined,
        clientName: lead.name,
        propertyTitle: lead.property.title,
        scheduledAt: variables.scheduledAt,
      };
      setVisitCreated(payload);
      if (payload.phone) {
        const msg = buildWhatsAppConfirmation(payload.clientName, payload.propertyTitle, payload.scheduledAt);
        window.open(`https://wa.me/55${payload.phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      }
      setTimeout(() => {
        setVisitCreated(null);
        reset();
        onOpenChange(false);
      }, 800);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro';
      toast({ title: msg, type: 'error' });
    },
  });

  const handleClose = () => {
    setVisitCreated(null);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar visita</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          Lead: <strong>{lead.name}</strong> • {lead.property.title}
        </p>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
          <div>
            <Label>Data e hora</Label>
            <Input type="datetime-local" {...register('scheduledAt')} />
          </div>
          <div>
            <Label>Observações</Label>
            <textarea {...register('notes')} className="flex min-h-[60px] w-full rounded-lg border px-3 py-2 text-sm" placeholder="Opcional" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Agendando...' : 'Agendar e enviar WhatsApp'}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          </div>
        </form>
        {visitCreated && (
          <p className="text-sm text-green-600">
            ✓ Visita agendada. {visitCreated.phone ? 'Abrindo WhatsApp...' : 'Telefone não cadastrado.'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
