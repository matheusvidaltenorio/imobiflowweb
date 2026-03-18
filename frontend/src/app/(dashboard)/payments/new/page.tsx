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
  description: z.string().min(2, 'Descrição obrigatória'),
  totalAmount: z.number().min(0.01),
  installmentsCount: z.number().min(1).max(60),
  firstDueDate: z.string().min(1, 'Data da 1ª parcela obrigatória'),
});

type FormData = z.infer<typeof schema>;

export default function NewPaymentPage() {
  const router = useRouter();
  const { toast } = useToast();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { installmentsCount: 1 },
  });

  const create = useMutation({
    mutationFn: (d: FormData) => {
      const count = Math.max(1, Math.floor(d.installmentsCount));
      const amountPerInstallment = Math.round((d.totalAmount / count) * 100) / 100;
      const installments = Array.from({ length: count }, (_, i) => {
        const date = new Date(d.firstDueDate + 'T12:00:00');
        date.setMonth(date.getMonth() + i);
        return { amount: amountPerInstallment, dueDate: date.toISOString().split('T')[0] };
      });
      return api.post('/payments', {
        description: d.description,
        totalAmount: d.totalAmount,
        dueDate: d.firstDueDate,
        installments,
      });
    },
    onSuccess: () => {
      toast({ title: 'Pagamento cadastrado!', type: 'success' });
      router.push('/payments');
    },
    onError: () => toast({ title: 'Erro ao cadastrar', type: 'error' }),
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Novo Pagamento</h1>
          <Link href="/payments">
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>

        <Card className="max-w-md p-6">
          <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
            <div>
              <Label>Descrição</Label>
              <Input {...register('description')} placeholder="Ex: Comissão venda imóvel X" />
              {errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}
            </div>
            <div>
              <Label>Valor total (R$)</Label>
              <Input type="number" step="0.01" {...register('totalAmount', { valueAsNumber: true })} />
              {errors.totalAmount && <p className="text-sm text-red-500">{errors.totalAmount.message}</p>}
            </div>
            <div>
              <Label>Nº de parcelas</Label>
              <Input type="number" min={1} max={60} {...register('installmentsCount', { valueAsNumber: true })} />
              {errors.installmentsCount && <p className="text-sm text-red-500">{errors.installmentsCount.message}</p>}
            </div>
            <div>
              <Label>Vencimento 1ª parcela</Label>
              <Input type="date" {...register('firstDueDate')} />
              {errors.firstDueDate && <p className="text-sm text-red-500">{errors.firstDueDate.message}</p>}
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
