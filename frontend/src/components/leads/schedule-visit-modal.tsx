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

function buildWhatsAppConfirmation(clientName: string, itemLabel: string, scheduledAt: string): string {
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
  return `Olá ${clientName}! Confirmando a visita ao *${itemLabel}* agendada para ${dateStr} às ${timeStr}. Qualquer dúvida, estou à disposição!`;
}

export type ScheduleVisitLead = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  property?: { id: string; title: string };
  lot?: {
    id: string;
    number: string;
    block?: { name?: string; development?: { name?: string } };
  };
};

function visitSubjectLabel(lead: ScheduleVisitLead): string {
  if (lead.lot) {
    const dev = lead.lot.block?.development?.name ?? 'Loteamento';
    const quadra = lead.lot.block?.name ?? 'Quadra';
    return `Lote ${lead.lot.number} — ${quadra} (${dev})`;
  }
  if (lead.property) return lead.property.title;
  return 'Imóvel';
}

type ScheduleVisitModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: ScheduleVisitLead;
};

export function ScheduleVisitModal({ open, onOpenChange, lead }: ScheduleVisitModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [visitCreated, setVisitCreated] = useState<{
    phone?: string;
    clientName: string;
    itemLabel: string;
    scheduledAt: string;
  } | null>(null);

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

  const itemLabel = visitSubjectLabel(lead);

  const create = useMutation({
    mutationFn: (d: FormData) => {
      if (lead.lot?.id) {
        return api.post('/visits', {
          lotId: lead.lot.id,
          leadId: lead.id,
          scheduledAt: d.scheduledAt,
          notes: d.notes || undefined,
        });
      }
      if (lead.property?.id) {
        return api.post('/visits', {
          propertyId: lead.property.id,
          leadId: lead.id,
          scheduledAt: d.scheduledAt,
          notes: d.notes || undefined,
        });
      }
      return Promise.reject(new Error('Lead sem imóvel ou lote vinculado'));
    },
    onSuccess: (res, variables) => {
      const data = res?.data as { lead?: { phone?: string }; client?: { phone?: string } };
      const phone = (data?.lead?.phone || data?.client?.phone || lead.phone || '').replace(/\D/g, '');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      toast({ title: 'Visita agendada!', type: 'success' });
      const payload = {
        phone: phone.length >= 10 ? phone : undefined,
        clientName: lead.name,
        itemLabel,
        scheduledAt: variables.scheduledAt,
      };
      setVisitCreated(payload);
      if (payload.phone) {
        const msg = buildWhatsAppConfirmation(payload.clientName, payload.itemLabel, payload.scheduledAt);
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

  const canSchedule = !!(lead.lot?.id || lead.property?.id);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar visita</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          Lead: <strong>{lead.name}</strong> • {itemLabel}
        </p>
        {!canSchedule ? (
          <p className="text-sm text-amber-800">Associe este lead a um lote ou imóvel para agendar visita.</p>
        ) : null}
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
          <div>
            <Label>Data e hora</Label>
            <Input type="datetime-local" {...register('scheduledAt')} />
          </div>
          <div>
            <Label>Observações</Label>
            <textarea
              {...register('notes')}
              className="flex min-h-[60px] w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Opcional"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending || !canSchedule}>
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
