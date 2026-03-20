'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ContractStatus = 'DRAFT' | 'READY' | 'SIGNED' | 'CANCELLED';

type ContractRow = {
  id: string;
  status: ContractStatus;
  bankName: string;
  months: number;
  totalValue: string | number;
  downPayment: string | number;
  financedAmount: string | number;
  installmentValue: string | number;
  createdAt: string;
  client: { id: string; name: string; email?: string } | null;
  property: { id: string; title: string } | null;
  sale: { id: string; status: string; soldAt?: string } | null;
};

const STATUS_LABEL: Record<ContractStatus, string> = {
  DRAFT: 'Rascunho',
  READY: 'Pronto',
  SIGNED: 'Assinado',
  CANCELLED: 'Cancelado',
};

const STATUS_STYLE: Record<ContractStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  READY: 'bg-blue-100 text-blue-800',
  SIGNED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

function num(v: string | number): number {
  return typeof v === 'number' ? v : Number(v);
}

export default function ContractsPage() {
  const { data: contracts, isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      const { data } = await api.get<ContractRow[]>('/contracts');
      return data;
    },
  });

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold tracking-tight text-primary-950">Contratos</h1>
          <p className="mt-2 max-w-2xl text-base text-gray-600">
            Contratos gerados a partir de propostas aceitas. Confirme a venda para gerar pagamentos e parcelas.
          </p>

          {isLoading ? (
            <div className="mt-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
              ))}
            </div>
          ) : contracts?.length ? (
            <div className="mt-8 space-y-4">
              {contracts.map((c) => (
                <Link key={c.id} href={`/contracts/${c.id}`}>
                  <Card className="cursor-pointer p-6 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {c.client?.name ?? 'Cliente'} · {c.bankName}
                        </p>
                        <p className="text-sm text-gray-600">
                          Total {formatPrice(num(c.totalValue))} · Entrada {formatPrice(num(c.downPayment))} ·{' '}
                          {c.months} parcelas de {formatPrice(num(c.installmentValue))}
                        </p>
                        {c.property && (
                          <p className="text-sm text-gray-600">Imóvel: {c.property.title}</p>
                        )}
                        <p className="text-xs text-gray-400">{formatDate(c.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'rounded-full px-3 py-1 text-xs font-semibold',
                            STATUS_STYLE[c.status] ?? 'bg-gray-100',
                          )}
                        >
                          {STATUS_LABEL[c.status] ?? c.status}
                        </span>
                        {c.sale && (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                            Venda confirmada
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-8 max-w-xl rounded-2xl border border-primary-100 bg-white p-6 shadow-card">
              <p className="font-semibold text-primary-950">Nenhum contrato ainda</p>
              <p className="mt-2 text-sm text-gray-600">
                Os contratos aparecem aqui depois que você gera a partir de uma proposta <strong>aceita</strong>. Se o
                botão <strong>Gerar contrato</strong> estiver desabilitado em{' '}
                <Link href="/propostas" className="font-semibold text-primary-700 hover:underline">
                  Propostas
                </Link>
                , associe um <strong>cliente cadastrado</strong> à proposta (propostas criadas na simulação podem vir
                sem cliente) e tente novamente.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
