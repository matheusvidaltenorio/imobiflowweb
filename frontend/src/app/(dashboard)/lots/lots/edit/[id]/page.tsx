'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  number: z.string().min(1),
  area: z.number().optional(),
  price: z.number().optional(),
  status: z.enum(['DISPONIVEL', 'VENDIDO', 'RESERVADO', 'INDISPONIVEL']),
});

export default function EditLotPage() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const developmentId = searchParams.get('development');
  const blockId = searchParams.get('block');
  const router = useRouter();
  const { toast } = useToast();

  const { data: lot, isLoading } = useQuery({
    queryKey: ['lot', id],
    queryFn: async () => {
      const { data } = await api.get(`/lots/${id}`);
      return data as { number: string; area?: number; price?: number; status: string };
    },
  });

  const { register, handleSubmit } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: lot ? { number: lot.number, area: lot.area ? Number(lot.area) : undefined, price: lot.price ? Number(lot.price) : undefined, status: lot.status as z.infer<typeof schema>['status'] } : undefined,
  });

  const update = useMutation({
    mutationFn: (d: z.infer<typeof schema>) => api.patch(`/lots/${id}`, d),
    onSuccess: () => {
      toast({ title: 'Lote atualizado!', type: 'success' });
      router.push(`/lots?development=${developmentId}&block=${blockId}`);
    },
    onError: () => toast({ title: 'Erro ao atualizar', type: 'error' }),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/lots/${id}`),
    onSuccess: () => {
      toast({ title: 'Lote removido', type: 'success' });
      router.push(`/lots?development=${developmentId}&block=${blockId}`);
    },
  });

  if (isLoading || !lot) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Editar Lote</h1>
          <Link href={`/lots?development=${developmentId}&block=${blockId}`}>
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>

        <Card className="max-w-md p-6">
          <form onSubmit={handleSubmit((d) => update.mutate(d))} className="space-y-4">
            <div>
              <Label>Número</Label>
              <Input {...register('number')} />
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
            <div className="flex gap-2">
              <Button type="submit" disabled={update.isPending}>Salvar</Button>
              <Button type="button" variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
                Excluir
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
