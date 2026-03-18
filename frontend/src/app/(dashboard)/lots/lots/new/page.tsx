'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import Link from 'next/link';

const schema = z.object({
  number: z.string().min(1),
  area: z.number().optional(),
  price: z.number().optional(),
  status: z.enum(['DISPONIVEL', 'VENDIDO', 'RESERVADO', 'INDISPONIVEL']).default('DISPONIVEL'),
});

export default function NewLotPage() {
  const searchParams = useSearchParams();
  const blockId = searchParams.get('block') ?? '';
  const developmentId = searchParams.get('development') ?? '';
  const router = useRouter();
  const { toast } = useToast();

  const { register, handleSubmit } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'DISPONIVEL' },
  });

  const create = useMutation({
    mutationFn: (d: z.infer<typeof schema>) => api.post('/lots', { blockId, ...d }),
    onSuccess: () => {
      toast({ title: 'Lote criado!', type: 'success' });
      router.push(`/lots?development=${developmentId}&block=${blockId}`);
    },
    onError: () => toast({ title: 'Erro ao criar', type: 'error' }),
  });

  if (!blockId) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <p className="text-gray-500">Selecione uma quadra.</p>
          <Link href={`/lots?development=${developmentId}`}>Voltar</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Novo Lote</h1>
          <Link href={`/lots?development=${developmentId}&block=${blockId}`}>
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>

        <Card className="max-w-md p-6">
          <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
            <div>
              <Label>Número do lote</Label>
              <Input {...register('number')} placeholder="Ex: 01" />
            </div>
            <div>
              <Label>Área (m²)</Label>
              <Input type="number" step="0.01" {...register('area', { valueAsNumber: true })} />
            </div>
            <div>
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" {...register('price', { valueAsNumber: true })} />
            </div>
            <div>
              <Label>Status</Label>
              <select {...register('status')} className="flex h-10 w-full rounded-lg border px-3 py-2">
                <option value="DISPONIVEL">Disponível</option>
                <option value="VENDIDO">Vendido</option>
                <option value="RESERVADO">Reservado</option>
                <option value="INDISPONIVEL">Indisponível</option>
              </select>
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Salvando...' : 'Criar'}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
