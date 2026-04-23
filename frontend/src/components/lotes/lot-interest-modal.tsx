'use client';

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
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  message: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function LotInterestModal({
  open,
  onOpenChange,
  lotId,
  lotLabel,
  marketingCampaignId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotId: string;
  lotLabel: string;
  marketingCampaignId?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const create = useMutation({
    mutationFn: (d: FormData) =>
      api.post('/leads', {
        lotId,
        ...(marketingCampaignId ? { marketingCampaignId } : {}),
        name: d.name,
        email: d.email,
        phone: d.phone || undefined,
        message: d.message?.trim() || `Interesse comercial: ${lotLabel}`,
        leadSource: 'SITE',
      }),
    onSuccess: () => {
      toast({ title: 'Lead criado e vinculado ao lote', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      reset();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao criar lead';
      toast({ title: msg, type: 'error' });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tenho interesse</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          Registra um lead vinculado a: <strong>{lotLabel}</strong>
        </p>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input {...register('name')} autoComplete="name" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" {...register('email')} autoComplete="email" />
          </div>
          <div>
            <Label>Telefone (opcional)</Label>
            <Input {...register('phone')} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label>Mensagem (opcional)</Label>
            <textarea
              {...register('message')}
              className="flex min-h-[72px] w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Observações do interesse"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Salvando...' : 'Gerar lead'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
