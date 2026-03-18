'use client';

import { useRouter } from 'next/navigation';
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
  name: z.string().min(2),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().min(2),
  neighborhood: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewDevelopmentPage() {
  const router = useRouter();
  const { toast } = useToast();

  const { register, handleSubmit } = useForm<FormData>({ resolver: zodResolver(schema) });

  const create = useMutation({
    mutationFn: (d: FormData) => api.post('/developments', d),
    onSuccess: (res) => {
      const id = (res as { data?: { id?: string } })?.data?.id;
      toast({ title: 'Loteamento criado!', type: 'success' });
      router.push(id ? `/lots?development=${id}` : '/developments');
    },
    onError: () => toast({ title: 'Erro ao criar', type: 'error' }),
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Novo Loteamento</h1>
          <Link href="/developments">
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>

        <Card className="max-w-md p-6">
          <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input {...register('name')} />
            </div>
            <div>
              <Label>Descrição</Label>
              <textarea {...register('description')} className="flex min-h-[80px] w-full rounded-lg border px-3 py-2" />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input {...register('address')} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input {...register('city')} />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input {...register('neighborhood')} />
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
