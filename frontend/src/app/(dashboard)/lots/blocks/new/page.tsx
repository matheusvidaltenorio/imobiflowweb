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

const schema = z.object({ name: z.string().min(2) });

export default function NewBlockPage() {
  const searchParams = useSearchParams();
  const developmentId = searchParams.get('development') ?? '';
  const router = useRouter();
  const { toast } = useToast();

  const { register, handleSubmit } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const create = useMutation({
    mutationFn: (d: { name: string }) => api.post('/blocks', { developmentId, name: d.name }),
    onSuccess: () => {
      toast({ title: 'Quadra criada!', type: 'success' });
      router.push(`/lots?development=${developmentId}`);
    },
    onError: () => toast({ title: 'Erro ao criar', type: 'error' }),
  });

  if (!developmentId) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <p className="text-gray-500">Selecione um loteamento.</p>
          <Link href="/developments">Voltar</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Nova Quadra</h1>
          <Link href={`/lots?development=${developmentId}`}>
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>

        <Card className="max-w-md p-6">
          <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
            <div>
              <Label>Nome da quadra</Label>
              <Input {...register('name')} placeholder="Ex: Quadra A" />
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
