'use client';

import { useParams, useRouter } from 'next/navigation';
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
  scheduledAt: z.string().min(1),
  status: z.enum(['AGENDADA', 'REALIZADA', 'CANCELADA', 'REMARCADA']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function EditVisitPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const { data: visit, isLoading } = useQuery({
    queryKey: ['visit', id],
    queryFn: async () => {
      const { data } = await api.get(`/visits/${id}`);
      return data as { id: string; scheduledAt: string; status: string; notes?: string; property: { title: string }; client?: { name: string } };
    },
  });

  const { register, handleSubmit } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: visit ? {
      scheduledAt: visit.scheduledAt ? new Date(visit.scheduledAt).toISOString().slice(0, 16) : '',
      status: visit.status,
      notes: visit.notes ?? '',
    } : undefined,
  });

  const update = useMutation({
    mutationFn: (d: FormData) => api.patch(`/visits/${id}`, d),
    onSuccess: () => {
      toast({ title: 'Visita atualizada!', type: 'success' });
      router.push('/visits');
    },
    onError: () => toast({ title: 'Erro ao atualizar', type: 'error' }),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/visits/${id}`),
    onSuccess: () => {
      toast({ title: 'Visita removida', type: 'success' });
      router.push('/visits');
    },
    onError: () => toast({ title: 'Erro ao remover', type: 'error' }),
  });

  if (isLoading || !visit) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Editar Visita</h1>
          <Link href="/visits">
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>

        <Card className="max-w-md p-6">
          <p className="mb-4 text-sm text-gray-600">
            Imóvel: <strong>{visit.property?.title}</strong>
            {visit.client && <><br />Cliente: <strong>{visit.client.name}</strong></>}
          </p>
          <form onSubmit={handleSubmit((d) => update.mutate(d))} className="space-y-4">
            <div>
              <Label>Data e hora</Label>
              <Input type="datetime-local" {...register('scheduledAt')} />
            </div>
            <div>
              <Label>Status</Label>
              <select {...register('status')} className="flex h-10 w-full rounded-lg border px-3 py-2">
                <option value="AGENDADA">Agendada</option>
                <option value="REALIZADA">Realizada</option>
                <option value="CANCELADA">Cancelada</option>
                <option value="REMARCADA">Remarcada</option>
              </select>
            </div>
            <div>
              <Label>Observações</Label>
              <textarea {...register('notes')} className="flex min-h-[80px] w-full rounded-lg border px-3 py-2" />
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
