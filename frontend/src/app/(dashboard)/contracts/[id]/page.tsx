'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { toWhatsAppDigits } from '@/lib/masks';
import { formatDate, formatPrice } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

type ContractStatus = 'DRAFT' | 'READY' | 'SIGNED' | 'CANCELLED';

type InstallmentRow = {
  id: string;
  amount: string | number;
  dueDate: string;
  status: string;
};

type ContractDetail = {
  id: string;
  status: ContractStatus;
  contractText: string;
  bankName: string;
  months: number;
  totalValue: string | number;
  downPayment: string | number;
  financedAmount: string | number;
  installmentValue: string | number;
  clientCpf: string | null;
  createdAt: string;
  client: { id: string; name: string; email?: string; phone?: string | null } | null;
  property: { id: string; title: string; price?: string | number; city?: string; status?: string } | null;
  proposal: { id: string; status: string };
  user: { id: string; name: string };
  sale: {
    id: string;
    status: string;
    soldAt: string;
    payment: {
      id: string;
      description: string;
      totalAmount: string | number;
      installments: InstallmentRow[];
    } | null;
  } | null;
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

export default function ContractDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contract, isLoading, isError } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      const { data } = await api.get<ContractDetail>(`/contracts/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const confirmSale = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/sales/confirm/${id}`);
      return data;
    },
    onSuccess: (data: { payment?: { id: string } | null }) => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast({ type: 'success', title: 'Venda confirmada', description: 'Pagamento e parcelas gerados.' });
      if (data?.payment?.id) {
        router.push(`/payments/${data.payment.id}`);
      }
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : undefined;
      const text = Array.isArray(msg) ? msg.join(', ') : msg || 'Não foi possível confirmar.';
      toast({ type: 'error', title: 'Erro', description: text });
    },
  });

  const openWhatsAppSummary = () => {
    if (!contract?.client) return;
    const phoneRaw = contract.client.phone?.trim() || '';
    const wa = toWhatsAppDigits(phoneRaw);
    if (wa.length < 12) {
      toast({
        type: 'error',
        title: 'Telefone necessário',
        description: 'Cadastre o telefone do cliente para enviar pelo WhatsApp.',
      });
      return;
    }
    const name = contract.client.name;
    const prop = contract.property?.title ?? 'imóvel';
    const lines = [
      `Olá ${name}, segue o resumo do contrato (minuta):`,
      ``,
      `Imóvel: ${prop}`,
      `Valor total: ${formatPrice(num(contract.totalValue))}`,
      `Entrada: ${formatPrice(num(contract.downPayment))}`,
      `Banco: ${contract.bankName}`,
      `Parcela: ${formatPrice(num(contract.installmentValue))} · ${contract.months} meses`,
      ``,
      `Podemos seguir com a formalização?`,
    ];
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/${wa}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-surface">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </main>
      </div>
    );
  }

  if (isError || !contract) {
    return (
      <div className="flex min-h-screen bg-surface">
        <Sidebar />
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <p className="text-gray-600">Contrato não encontrado ou sem permissão.</p>
          <Link href="/contracts" className="text-primary-600 hover:underline">
            Voltar à lista
          </Link>
        </main>
      </div>
    );
  }

  const canConfirm =
    !contract.sale && (contract.status === 'READY' || contract.status === 'DRAFT');

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link href="/contracts" className="text-sm font-medium text-primary-600 hover:underline">
                ← Contratos
              </Link>
              <h1 className="mt-2 text-2xl font-bold text-gray-900">Contrato</h1>
              <p className="text-sm text-gray-600">
                Proposta vinculada · Cliente:{' '}
                <strong>{contract.client?.name ?? '—'}</strong>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  STATUS_STYLE[contract.status],
                )}
              >
                {STATUS_LABEL[contract.status]}
              </span>
              {contract.sale && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  Venda confirmada
                </span>
              )}
            </div>
          </div>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900">Resumo financeiro</h2>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">Valor total</dt>
                <dd className="font-medium">{formatPrice(num(contract.totalValue))}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Entrada</dt>
                <dd className="font-medium">{formatPrice(num(contract.downPayment))}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Financiado (parcelas)</dt>
                <dd className="font-medium">{formatPrice(num(contract.financedAmount))}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Banco / parcela</dt>
                <dd className="font-medium">
                  {contract.bankName} · {formatPrice(num(contract.installmentValue))} × {contract.months}
                </dd>
              </div>
              {contract.property && (
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">Imóvel</dt>
                  <dd className="font-medium">{contract.property.title}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Corretor</dt>
                <dd className="font-medium">{contract.user.name}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Data do contrato</dt>
                <dd className="font-medium">{formatDate(contract.createdAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Texto do contrato (minuta)</h2>
            <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-800">
              {contract.contractText}
            </pre>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Link href={`/propostas`}>
              <Button type="button" variant="outline">
                Voltar às propostas
              </Button>
            </Link>
            <Button type="button" variant="outline" onClick={openWhatsAppSummary}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Enviar resumo no WhatsApp
            </Button>
            {canConfirm && (
              <Button
                type="button"
                disabled={confirmSale.isPending}
                onClick={() => confirmSale.mutate()}
                className="bg-primary-600"
              >
                {confirmSale.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirmando…
                  </>
                ) : (
                  'Confirmar venda'
                )}
              </Button>
            )}
            {contract.sale?.payment && (
              <Link href={`/payments/${contract.sale.payment.id}`}>
                <Button type="button" variant="outline" className="border-green-600 text-green-700">
                  Ver pagamento e parcelas
                </Button>
              </Link>
            )}
          </div>

          {contract.sale?.payment?.installments?.length ? (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900">Parcelas geradas</h2>
              <ul className="mt-4 divide-y rounded-lg border">
                {contract.sale.payment.installments.map((ins, idx) => (
                  <li key={ins.id} className="flex justify-between px-4 py-3 text-sm">
                    <span>
                      #{idx + 1} · Venc. {formatDate(ins.dueDate)}
                    </span>
                    <span className="font-medium">{formatPrice(num(ins.amount))}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
}
