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
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function EditClientPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data } = await api.get(`/clients/${id}`);
      return data as { name: string; email: string; phone?: string; notes?: string };
    },
  });

  const { register, handleSubmit } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: client ? { name: client.name, email: client.email, phone: client.phone ?? '', notes: client.notes ?? '' } : undefined,
  });

  const update = useMutation({
    mutationFn: (d: FormData) => api.patch(`/clients/${id}`, d),
    onSuccess: () => {
      toast({ title: 'Cliente atualizado!', type: 'success' });
      router.push('/clients');
    },
    onError: () => toast({ title: 'Erro ao atualizar', type: 'error' }),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/clients/${id}`),
    onSuccess: () => {
      toast({ title: 'Cliente removido', type: 'success' });
      router.push('/clients');
    },
    onError: () => toast({ title: 'Erro ao remover', type: 'error' }),
  });

  if (isLoading || !client) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Editar Cliente</h1>
          <Link href="/clients">
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>

        <Card className="max-w-md p-6">
          <form onSubmit={handleSubmit((d) => update.mutate(d))} className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input {...register('name')} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" {...register('email')} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input {...register('phone')} />
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
