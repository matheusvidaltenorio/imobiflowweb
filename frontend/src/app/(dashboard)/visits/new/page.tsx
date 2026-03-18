'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import Link from 'next/link';

const schema = z.object({
  propertyId: z.string().min(1, 'Selecione um imóvel'),
  clientId: z.string().optional(),
  leadId: z.string().optional(),
  scheduledAt: z.string().min(1, 'Data/hora obrigatória'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewVisitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const leadId = searchParams.get('leadId');
  const propertyIdParam = searchParams.get('propertyId');
  const nameParam = searchParams.get('name');
  const emailParam = searchParams.get('email');
  const phoneParam = searchParams.get('phone');

  const { data: lead } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: async () => {
      const { data } = await api.get(`/leads/${leadId}`);
      return data;
    },
    enabled: !!leadId,
  });

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data } = await api.get('/properties');
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await api.get('/clients');
      return data;
    },
  });

  const defaultDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  })();

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { scheduledAt: defaultDate },
  });

  useEffect(() => {
    const propId = lead?.property?.id || propertyIdParam;
    if (propId) setValue('propertyId', propId);
    if (leadId) setValue('leadId', leadId);
  }, [lead, leadId, propertyIdParam, setValue]);

  const buildWhatsAppConfirmation = (
    clientName: string,
    propertyTitle: string,
    scheduledAt: string
  ) => {
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
  };

  const create = useMutation({
    mutationFn: (d: FormData) => api.post('/visits', {
      propertyId: d.propertyId,
      clientId: d.clientId || undefined,
      leadId: d.leadId || undefined,
      scheduledAt: d.scheduledAt,
      notes: d.notes || undefined,
    }),
    onSuccess: (res, variables) => {
      toast({ title: 'Visita agendada!', type: 'success' });
      const data = res?.data as { property?: { title: string }; client?: { name: string; phone?: string }; lead?: { name: string; phone?: string } };
      const clientName = data?.client?.name || data?.lead?.name || leadName || 'Cliente';
      const propertyTitle = data?.property?.title || properties?.find((p: { id: string }) => p.id === variables.propertyId)?.title || 'Imóvel';
      const phone = (data?.client?.phone || data?.lead?.phone || phoneParam || '').replace(/\D/g, '');
      if (phone.length >= 10) {
        const msg = buildWhatsAppConfirmation(clientName, propertyTitle, variables.scheduledAt);
        window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      }
      router.push('/visits');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro';
      toast({ title: msg, type: 'error' });
    },
  });

  const leadName = lead?.name || (nameParam ? decodeURIComponent(nameParam) : null);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Agendar Visita</h1>
          <Link href="/visits">
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>

        {leadId && leadName && (
          <Card className="mb-6 border-primary-200 bg-primary-50 p-4">
            <p className="text-sm font-medium text-primary-800">
              Agendando visita a partir do lead: <strong>{leadName}</strong>
            </p>
            {lead?.email && <p className="text-sm text-primary-700">{lead.email} {lead.phone && `• ${lead.phone}`}</p>}
          </Card>
        )}

        <Card className="max-w-md p-6">
          <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
            <div>
              <Label>Imóvel</Label>
              <select {...register('propertyId')} className="flex h-10 w-full rounded-lg border px-3 py-2">
                <option value="">Selecione...</option>
                {(properties ?? []).map((p: { id: string; title: string }) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              {errors.propertyId && <p className="text-sm text-red-500">{errors.propertyId.message}</p>}
            </div>
            <div>
              <Label>Cliente (opcional)</Label>
              <select {...register('clientId')} className="flex h-10 w-full rounded-lg border px-3 py-2">
                <option value="">Nenhum</option>
                {(clients ?? []).map((c: { id: string; name: string }) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Data e hora</Label>
              <Input type="datetime-local" {...register('scheduledAt')} />
              {errors.scheduledAt && <p className="text-sm text-red-500">{errors.scheduledAt.message}</p>}
            </div>
            <div>
              <Label>Observações</Label>
              <textarea
                {...register('notes')}
                className="flex min-h-[80px] w-full rounded-lg border px-3 py-2"
                placeholder={leadName ? `Lead: ${leadName}` : undefined}
              />
            </div>
            {leadId && <input type="hidden" {...register('leadId')} />}
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Agendando...' : 'Agendar'}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
