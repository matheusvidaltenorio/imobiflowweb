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
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewClientPage() {
  const router = useRouter();
  const { toast } = useToast();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const create = useMutation({
    mutationFn: (d: FormData) => api.post('/clients', d),
    onSuccess: () => {
      toast({ title: 'Cliente cadastrado!', type: 'success' });
      router.push('/clients');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro';
      toast({ title: msg, type: 'error' });
    },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Novo Cliente</h1>
          <Link href="/clients">
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>

        <Card className="max-w-md p-6">
          <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div>
              <Label>Telefone</Label>
              <Input {...register('phone')} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <Label>Observações</Label>
              <textarea {...register('notes')} className="flex min-h-[80px] w-full rounded-lg border px-3 py-2" />
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
