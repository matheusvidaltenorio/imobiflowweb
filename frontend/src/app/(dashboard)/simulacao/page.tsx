'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MessageCircle, Loader2, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import {
  formatCpf,
  digitsOnly,
  digitsToBrlDisplay,
  brlDisplayToCents,
  centsToReais,
  toWhatsAppDigits,
  formatBrlFromCents,
} from '@/lib/masks';
import { cn } from '@/lib/utils';

const money = z.string().min(1, 'Obrigatório');

const formSchema = z
  .object({
    clientName: z.string().min(2, 'Informe o nome do cliente'),
    cpf: z.string(),
    incomeDisplay: money,
    propertyValueDisplay: money,
    downPaymentDisplay: money,
    clientId: z.string().optional(),
    propertyId: z.string().optional(),
    clientPhoneDisplay: z.string().optional(),
    saveSimulation: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (digitsOnly(data.cpf).length !== 11) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CPF deve ter 11 dígitos', path: ['cpf'] });
    }
    const income = centsToReais(brlDisplayToCents(data.incomeDisplay));
    const pv = centsToReais(brlDisplayToCents(data.propertyValueDisplay));
    const dp = centsToReais(brlDisplayToCents(data.downPaymentDisplay));
    if (income <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Renda inválida', path: ['incomeDisplay'] });
    }
    if (pv <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valor do imóvel inválido', path: ['propertyValueDisplay'] });
    }
    if (dp < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Entrada inválida', path: ['downPaymentDisplay'] });
    }
    if (dp >= pv) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Entrada deve ser menor que o valor do imóvel',
        path: ['downPaymentDisplay'],
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

type SimOption = {
  bankId: string;
  bankName: string;
  monthlyRate: number;
  months: number;
  installment: number;
  totalCost: number;
  approved: boolean;
};

type CompareResponse = {
  financedAmount: number;
  ranked: SimOption[];
  bestKey: string | null;
  bestOption: SimOption | null;
  byBank: Array<{
    bank: { id: string; name: string; monthlyRate: number };
    options: SimOption[];
  }>;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function formatPct(rate: number) {
  return `${(rate * 100).toFixed(2)}% a.m.`;
}

function buildWhatsAppText(clientName: string, bank: string, installment: number, months: number) {
  const parcela = formatMoney(installment);
  return `Olá ${clientName}, fiz uma simulação para você:\n\nBanco: ${bank}\nParcela: ${parcela}\nPrazo: ${months} meses\n\nPodemos seguir com essa opção?`;
}

export default function SimulacaoPage() {
  const { toast } = useToast();
  const [result, setResult] = useState<CompareResponse | null>(null);

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; phone?: string | null }>>('/clients');
      return data;
    },
  });

  const { data: properties } = useQuery({
    queryKey: ['properties-mine'],
    queryFn: async () => {
      const { data } = await api.get<
        Array<{ id: string; title: string; price: number | string }>
      >('/properties');
      return data;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: '',
      cpf: '',
      incomeDisplay: '',
      propertyValueDisplay: '',
      downPaymentDisplay: '',
      clientId: '',
      propertyId: '',
      clientPhoneDisplay: '',
      saveSimulation: false,
    },
  });

  const compareMutation = useMutation({
    mutationFn: async (payload: {
      clientName: string;
      cpf: string;
      income: number;
      propertyValue: number;
      downPayment: number;
      clientId?: string;
      propertyId?: string;
      clientPhone?: string;
      save: boolean;
    }) => {
      const { data } = await api.post<CompareResponse>('/simulations/compare', payload);
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ type: 'success', title: 'Simulação concluída', description: 'Confira as opções abaixo.' });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : undefined;
      const text = Array.isArray(msg) ? msg.join(', ') : msg || 'Não foi possível simular.';
      toast({ type: 'error', title: 'Erro', description: text });
    },
  });

  const selectedClientId = form.watch('clientId');
  const selectedClient = useMemo(
    () => clients?.find((c) => c.id === selectedClientId),
    [clients, selectedClientId],
  );

  const onSubmit = form.handleSubmit((values) => {
    const income = centsToReais(brlDisplayToCents(values.incomeDisplay));
    const propertyValue = centsToReais(brlDisplayToCents(values.propertyValueDisplay));
    const downPayment = centsToReais(brlDisplayToCents(values.downPaymentDisplay));
    const cpfDigits = digitsOnly(values.cpf);
    const phoneFromClient = selectedClient?.phone?.trim();
    const phoneField = values.clientPhoneDisplay?.trim();
    const clientPhone = phoneFromClient || phoneField || undefined;

    compareMutation.mutate({
      clientName: values.clientName.trim(),
      cpf: cpfDigits,
      income,
      propertyValue,
      downPayment,
      clientId: values.clientId || undefined,
      propertyId: values.propertyId || undefined,
      clientPhone,
      save: values.saveSimulation,
    });
  });

  const openWhatsApp = (opt: SimOption) => {
    const name = form.getValues('clientName').trim() || 'cliente';
    const phoneRaw =
      selectedClient?.phone?.trim() ||
      form.getValues('clientPhoneDisplay')?.trim() ||
      '';
    const wa = toWhatsAppDigits(phoneRaw);
    if (wa.length < 12) {
      toast({
        type: 'error',
        title: 'Telefone necessário',
        description: 'Selecione um cliente com telefone ou informe o WhatsApp do cliente.',
      });
      return;
    }
    const text = encodeURIComponent(buildWhatsAppText(name, opt.bankName, opt.installment, opt.months));
    window.open(`https://wa.me/${wa}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-bold text-gray-900">Simulação de financiamento</h1>
          <p className="mt-1 text-sm text-gray-600">
            Compare bancos e prazos (PRICE). Aprovação considera parcela até 30% da renda informada.
          </p>

          <Card className="mt-8 p-6">
            <form onSubmit={onSubmit} className="space-y-8">
              <div>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
                  <span aria-hidden>👤</span> Cliente
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="clientId">Cliente cadastrado (opcional)</Label>
                    <select
                      id="clientId"
                      className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      value={form.watch('clientId') || ''}
                      onChange={(e) => {
                        const id = e.target.value;
                        form.setValue('clientId', id);
                        const c = clients?.find((x) => x.id === id);
                        if (c) {
                          form.setValue('clientName', c.name);
                          if (c.phone) form.setValue('clientPhoneDisplay', c.phone);
                        }
                      }}
                    >
                      <option value="">— Nenhum —</option>
                      {clients?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Nome do cliente</Label>
                    <Input
                      id="clientName"
                      {...form.register('clientName')}
                      placeholder="Nome completo"
                    />
                    {form.formState.errors.clientName && (
                      <p className="text-sm text-red-600">{form.formState.errors.clientName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      inputMode="numeric"
                      autoComplete="off"
                      value={formatCpf(form.watch('cpf'))}
                      onChange={(e) => form.setValue('cpf', digitsOnly(e.target.value, 11))}
                    />
                    {form.formState.errors.cpf && (
                      <p className="text-sm text-red-600">{form.formState.errors.cpf.message}</p>
                    )}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="incomeDisplay">Renda mensal</Label>
                    <Input
                      id="incomeDisplay"
                      inputMode="numeric"
                      placeholder="R$ 0,00"
                      value={form.watch('incomeDisplay')}
                      onChange={(e) => form.setValue('incomeDisplay', digitsToBrlDisplay(e.target.value))}
                    />
                    {form.formState.errors.incomeDisplay && (
                      <p className="text-sm text-red-600">{form.formState.errors.incomeDisplay.message}</p>
                    )}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="clientPhoneDisplay">WhatsApp do cliente (se não vier do cadastro)</Label>
                    <Input
                      id="clientPhoneDisplay"
                      placeholder="(11) 99999-9999"
                      {...form.register('clientPhoneDisplay')}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
                  <span aria-hidden>🏠</span> Imóvel
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="propertyId">Imóvel do sistema (opcional)</Label>
                    <select
                      id="propertyId"
                      className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      value={form.watch('propertyId') || ''}
                      onChange={(e) => {
                        const id = e.target.value;
                        form.setValue('propertyId', id);
                        const p = properties?.find((x) => x.id === id);
                        if (p) {
                          const priceNum =
                            typeof p.price === 'string' ? parseFloat(p.price) : Number(p.price);
                          if (!Number.isNaN(priceNum) && priceNum > 0) {
                            const cents = Math.round(priceNum * 100);
                            form.setValue('propertyValueDisplay', formatBrlFromCents(cents));
                          }
                        }
                      }}
                    >
                      <option value="">— Nenhum —</option>
                      {properties?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} — {formatMoney(typeof p.price === 'string' ? parseFloat(p.price) : p.price)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="propertyValueDisplay">Valor do imóvel</Label>
                    <Input
                      id="propertyValueDisplay"
                      inputMode="numeric"
                      placeholder="R$ 0,00"
                      value={form.watch('propertyValueDisplay')}
                      onChange={(e) => form.setValue('propertyValueDisplay', digitsToBrlDisplay(e.target.value))}
                    />
                    {form.formState.errors.propertyValueDisplay && (
                      <p className="text-sm text-red-600">{form.formState.errors.propertyValueDisplay.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
                  <span aria-hidden>💰</span> Simulação
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="downPaymentDisplay">Entrada</Label>
                    <Input
                      id="downPaymentDisplay"
                      inputMode="numeric"
                      placeholder="R$ 0,00"
                      value={form.watch('downPaymentDisplay')}
                      onChange={(e) => form.setValue('downPaymentDisplay', digitsToBrlDisplay(e.target.value))}
                    />
                    {form.formState.errors.downPaymentDisplay && (
                      <p className="text-sm text-red-600">{form.formState.errors.downPaymentDisplay.message}</p>
                    )}
                  </div>
                  <div className="flex items-end gap-2 pb-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={form.watch('saveSimulation')}
                        onChange={(e) => form.setValue('saveSimulation', e.target.checked)}
                      />
                      Salvar simulação no histórico
                    </label>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={compareMutation.isPending} className="min-w-[160px]">
                {compareMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calculando…
                  </>
                ) : (
                  'Simular'
                )}
              </Button>
            </form>
          </Card>

          {result && (
            <div
              className={cn(
                'mt-10 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Resultado</h2>
                  <p className="text-sm text-gray-600">
                    Valor financiado: <strong>{formatMoney(result.financedAmount)}</strong>
                  </p>
                </div>
                {result.bestOption && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-green-600 text-green-700 hover:bg-green-50"
                    onClick={() => openWhatsApp(result.bestOption!)}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Enviar melhor opção no WhatsApp
                  </Button>
                )}
              </div>

              <div className="space-y-6">
                {result.byBank.map(({ bank, options }) => (
                  <Card key={bank.id} className="overflow-hidden p-0">
                    <div className="border-b bg-gray-50 px-4 py-3">
                      <h3 className="font-semibold text-gray-900">{bank.name}</h3>
                      <p className="text-xs text-gray-500">Taxa mensal: {formatPct(bank.monthlyRate)}</p>
                    </div>
                    <div className="divide-y">
                      {options.map((opt) => {
                        const key = `${opt.bankId}-${opt.months}`;
                        const isBest = result.bestKey === key;
                        return (
                          <div
                            key={key}
                            className={cn(
                              'flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between',
                              isBest && 'bg-primary-50/60',
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-gray-800">{opt.months} meses</span>
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-xs font-medium',
                                  opt.approved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
                                )}
                              >
                                {opt.approved ? 'Aprovado' : 'Reprovado'}
                              </span>
                              {isBest && opt.approved && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                                  <Star className="h-3 w-3" />
                                  Melhor escolha
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 text-sm sm:text-right">
                              <span>
                                Parcela: <strong>{formatMoney(opt.installment)}</strong>
                              </span>
                              <span className="text-gray-600">Custo total: {formatMoney(opt.totalCost)}</span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              onClick={() => openWhatsApp(opt)}
                            >
                              <MessageCircle className="mr-1 h-3.5 w-3.5" />
                              WhatsApp
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>

              <Card className="p-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-800">Ranking geral (melhores primeiro)</h3>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
                  {result.ranked.slice(0, 8).map((r) => (
                    <li key={`${r.bankId}-${r.months}`}>
                      {r.bankName} — {r.months}m — {formatMoney(r.installment)} —{' '}
                      <span className={r.approved ? 'text-green-700' : 'text-red-600'}>
                        {r.approved ? 'ok' : 'acima de 30%'}
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
