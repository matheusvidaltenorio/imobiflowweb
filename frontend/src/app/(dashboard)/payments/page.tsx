'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PaymentsPage() {
  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data } = await api.get('/payments');
      return data;
    },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Pagamentos</h1>
          <Link href="/payments/new">
            <Button>Novo Pagamento</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : payments?.length ? (
          <div className="space-y-4">
            {payments.map((p: { id: string; description: string; totalAmount: number; status: string; dueDate?: string; installments: { amount: number; dueDate: string; status: string }[] }) => (
              <Link key={p.id} href={`/payments/${p.id}`}>
                <Card className="cursor-pointer p-6 transition-shadow hover:shadow-md">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold">{p.description}</p>
                      <p className="text-lg font-bold text-primary-600">{formatPrice(Number(p.totalAmount))}</p>
                      <p className="text-sm text-gray-500">
                        {p.installments?.length ?? 0} parcelas • Vencimento: {p.dueDate ? formatDate(p.dueDate) : '-'}
                      </p>
                    </div>
                    <span className={`rounded px-2 py-1 text-sm ${
                      p.status === 'PAGO' ? 'bg-green-100 text-green-700' :
                      p.status === 'ATRASADO' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Nenhum pagamento cadastrado. <Link href="/payments/new" className="text-primary-600 hover:underline">Cadastrar primeiro pagamento</Link></p>
        )}
      </main>
    </div>
  );
}
