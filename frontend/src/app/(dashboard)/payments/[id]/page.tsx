'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';

export default function PaymentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment', id],
    queryFn: async () => {
      const { data } = await api.get(`/payments/${id}`);
      return data as {
        id: string;
        description: string;
        totalAmount: number;
        status: string;
        dueDate?: string;
        installments: { id: string; amount: number; dueDate: string; paidAt?: string; status: string }[];
      };
    },
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/payments/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      toast({ title: 'Status atualizado', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao atualizar', type: 'error' }),
  });

  const payInstallment = useMutation({
    mutationFn: (installmentId: string) => api.patch(`/installments/${installmentId}/pay`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      toast({ title: 'Parcela marcada como paga', type: 'success' });
    },
  });

  if (isLoading || !payment) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Detalhes do Pagamento</h1>
          <Link href="/payments">
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>

        <Card className="mb-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">{payment.description}</p>
              <p className="text-2xl font-bold text-primary-600">{formatPrice(Number(payment.totalAmount))}</p>
              <p className="text-sm text-gray-500">Vencimento: {payment.dueDate ? formatDate(payment.dueDate) : '-'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-1 text-sm ${
                payment.status === 'PAGO' ? 'bg-green-100 text-green-700' :
                payment.status === 'ATRASADO' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>{payment.status}</span>
              {payment.status === 'PENDENTE' && (
                <Button size="sm" onClick={() => updateStatus.mutate('PAGO')} disabled={updateStatus.isPending}>
                  Marcar pago
                </Button>
              )}
            </div>
          </div>
        </Card>

        <h2 className="mb-4 font-semibold">Parcelas</h2>
        <div className="space-y-2">
          {payment.installments?.map((inst: { id: string; amount: number; dueDate: string; paidAt?: string; status: string }, idx: number) => (
            <Card key={inst.id} className="flex items-center justify-between p-4">
              <div>
                <span className="font-medium">Parcela {idx + 1}</span>
                <span className="ml-2 text-gray-500">{formatDate(inst.dueDate)}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-semibold">{formatPrice(Number(inst.amount))}</span>
                {inst.status === 'PAGO' ? (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-sm text-green-700">Pago</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => payInstallment.mutate(inst.id)} disabled={payInstallment.isPending}>
                    Marcar pago
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
