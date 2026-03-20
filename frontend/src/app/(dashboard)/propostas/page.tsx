'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Check, FileSignature, Link2, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDate, formatPrice } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';

const linkSelectClass =
  'flex h-10 min-w-[200px] max-w-full flex-1 rounded-xl border-2 border-surface-muted bg-white px-3 text-sm text-gray-900 transition-colors focus-visible:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30';

type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

type ProposalRow = {
  id: string;
  bank: string;
  months: number;
  installment: string | number;
  downPayment: string | number;
  status: ProposalStatus;
  createdAt: string;
  client: { id: string; name: string; email?: string } | null;
  property: { id: string; title: string } | null;
  contract: { id: string; status: string } | null;
  sale: { id: string; status: string } | null;
};

const STATUS_LABEL: Record<ProposalStatus, string> = {
  PENDING: 'Pendente',
  ACCEPTED: 'Aceita',
  REJECTED: 'Recusada',
};

const STATUS_STYLE: Record<ProposalStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-900',
  ACCEPTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

function num(v: string | number): number {
  return typeof v === 'number' ? v : Number(v);
}

export default function PropostasPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingClientId, setPendingClientId] = useState<Record<string, string>>({});

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string }>>('/clients');
      return data;
    },
  });

  const { data: proposals, isLoading } = useQuery({
    queryKey: ['proposals'],
    queryFn: async () => {
      const { data } = await api.get<ProposalRow[]>('/proposals');
      return data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Exclude<ProposalStatus, 'PENDING'> }) => {
      const { data } = await api.patch<ProposalRow>(`/proposals/${id}/status`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({ type: 'success', title: 'Status atualizado' });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : undefined;
      const text = Array.isArray(msg) ? msg.join(', ') : msg || 'Não foi possível atualizar.';
      toast({ type: 'error', title: 'Erro', description: text });
    },
  });

  const updatingId =
    statusMutation.isPending && statusMutation.variables ? statusMutation.variables.id : null;

  const linkProposalMutation = useMutation({
    mutationFn: async ({ proposalId, clientId }: { proposalId: string; clientId: string }) => {
      const { data } = await api.patch<ProposalRow>(`/proposals/${proposalId}/links`, { clientId });
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      setPendingClientId((prev) => {
        const next = { ...prev };
        delete next[vars.proposalId];
        return next;
      });
      toast({ type: 'success', title: 'Cliente associado', description: 'Agora você pode gerar o contrato.' });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : undefined;
      const text = Array.isArray(msg) ? msg.join(', ') : msg || 'Não foi possível associar o cliente.';
      toast({ type: 'error', title: 'Erro', description: text });
    },
  });

  const linkingProposalId = linkProposalMutation.isPending ? linkProposalMutation.variables?.proposalId : null;

  const createContractMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const { data } = await api.post<{ id: string }>(`/contracts/from-proposal/${proposalId}`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ type: 'success', title: 'Contrato gerado', description: 'Revise e confirme a venda na próxima tela.' });
      router.push(`/contracts/${data.id}`);
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : undefined;
      const text = Array.isArray(msg) ? msg.join(', ') : msg || 'Não foi possível gerar o contrato.';
      toast({ type: 'error', title: 'Erro', description: text });
    },
  });

  const creatingContractId =
    createContractMutation.isPending && createContractMutation.variables
      ? createContractMutation.variables
      : null;

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-2 inline-flex rounded-full bg-primary-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-800">
            Documento comercial
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary-950">Propostas</h1>
          <p className="mt-2 max-w-2xl text-base text-gray-600">
            Etapa após a simulação: acompanhe condições enviadas ao cliente e avance para contrato quando aceitar.
          </p>

          {isLoading ? (
            <div className="mt-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />
              ))}
            </div>
          ) : proposals?.length ? (
            <div className="mt-8 space-y-4">
              {proposals.map((p) => (
                <Card
                  key={p.id}
                  className={cn(
                    'border-surface-muted p-6',
                    p.status === 'ACCEPTED' && !p.contract && 'ring-2 ring-accent-400/50 ring-offset-2 ring-offset-surface',
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="text-lg font-semibold text-gray-900">{p.bank}</p>
                      <p className="text-sm text-gray-600">
                        Parcela:{' '}
                        <strong className="text-gray-900">{formatPrice(num(p.installment))}</strong>
                        {' · '}
                        {p.months} meses
                        {' · '}
                        Entrada: <strong className="text-gray-900">{formatPrice(num(p.downPayment))}</strong>
                      </p>
                      {p.client && (
                        <p className="text-sm text-gray-600">
                          Cliente: <span className="font-medium text-gray-800">{p.client.name}</span>
                        </p>
                      )}
                      {p.property && (
                        <p className="text-sm text-gray-600">
                          Imóvel: <span className="font-medium text-gray-800">{p.property.title}</span>
                        </p>
                      )}
                      <p className="text-xs text-gray-400">{formatDate(p.createdAt)}</p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-start gap-3 sm:items-end">
                      <span
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-semibold',
                          STATUS_STYLE[p.status] || 'bg-gray-100 text-gray-800',
                        )}
                      >
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                      {p.status === 'PENDING' && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-green-600 text-green-700 hover:bg-green-50"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: p.id, status: 'ACCEPTED' })}
                          >
                            {updatingId === p.id ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="mr-1 h-3.5 w-3.5" />
                            )}
                            Aceitar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-red-600 text-red-700 hover:bg-red-50"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: p.id, status: 'REJECTED' })}
                          >
                            {updatingId === p.id ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="mr-1 h-3.5 w-3.5" />
                            )}
                            Recusar
                          </Button>
                        </div>
                      )}
                      {p.status === 'ACCEPTED' && !p.contract && (
                        <div className="flex w-full max-w-xl flex-col gap-3 sm:items-end">
                          {!p.client && (
                            <div className="w-full rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
                              <p className="font-semibold text-amber-900">Associe um cliente cadastrado</p>
                              <p className="mt-1 text-amber-800/90">
                                Esta proposta foi criada sem vínculo a um cliente (comum na simulação). Escolha o cliente
                                abaixo e clique em <strong>Associar</strong> para habilitar <strong>Gerar contrato</strong>.
                              </p>
                              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                  <Label htmlFor={`client-${p.id}`} className="text-xs text-amber-900">
                                    Cliente
                                  </Label>
                                  <select
                                    id={`client-${p.id}`}
                                    className={linkSelectClass}
                                    value={pendingClientId[p.id] ?? ''}
                                    onChange={(e) =>
                                      setPendingClientId((prev) => ({ ...prev, [p.id]: e.target.value }))
                                    }
                                  >
                                    <option value="">Selecione…</option>
                                    {clients?.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="border-amber-700 text-amber-900 hover:bg-amber-100"
                                  disabled={
                                    linkProposalMutation.isPending ||
                                    !pendingClientId[p.id] ||
                                    !clients?.length
                                  }
                                  onClick={() => {
                                    const cid = pendingClientId[p.id];
                                    if (cid) linkProposalMutation.mutate({ proposalId: p.id, clientId: cid });
                                  }}
                                >
                                  {linkingProposalId === p.id ? (
                                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Link2 className="mr-1 h-3.5 w-3.5" />
                                  )}
                                  Associar cliente
                                </Button>
                              </div>
                              {!clients?.length && (
                                <p className="mt-2 text-xs text-amber-800">
                                  Nenhum cliente cadastrado. Cadastre em{' '}
                                  <Link href="/clients" className="font-semibold underline">
                                    Clientes
                                  </Link>
                                  .
                                </p>
                              )}
                            </div>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant={p.client ? 'default' : 'outline'}
                            className={
                              p.client
                                ? 'shadow-cta'
                                : 'border-surface-muted text-gray-400'
                            }
                            disabled={createContractMutation.isPending || !p.client}
                            title={
                              !p.client
                                ? 'Associe um cliente cadastrado à proposta (caixa acima) para gerar o contrato.'
                                : undefined
                            }
                            onClick={() => createContractMutation.mutate(p.id)}
                          >
                            {creatingContractId === p.id ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileSignature className="mr-1 h-3.5 w-3.5" />
                            )}
                            Gerar contrato
                          </Button>
                        </div>
                      )}
                      {p.contract && (
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/contracts/${p.contract.id}`}>
                            <Button type="button" size="sm" variant="outline">
                              {p.sale ? 'Ver contrato / venda' : 'Ver contrato'}
                            </Button>
                          </Link>
                          {p.sale && (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                              Venda confirmada
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <p className="mt-8 text-gray-500">
              Nenhuma proposta ainda. Na tela de{' '}
              <Link href="/simulacao" className="font-medium text-primary-600 hover:underline">
                Simulação
              </Link>
              , use <strong>Gerar proposta</strong> após comparar os bancos.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
