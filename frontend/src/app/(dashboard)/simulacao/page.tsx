'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Loader2, Star, Landmark, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { getBankAccent, getBankLogoUrl } from '@/utils/bankLogos';
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

const simSelectClass =
  'flex h-11 w-full rounded-xl border-2 border-surface-muted bg-white px-3 text-sm text-gray-900 transition-colors focus-visible:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30';

const money = z.string().min(1, 'Obrigatório');

const MARITAL_VALUES = ['SOLTEIRO', 'CASADO', 'DIVORCIADO', 'VIUVO'] as const;

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
    age: z.coerce.number().int().min(18, 'Idade mínima 18 anos').max(120),
    maritalStatus: z.enum(MARITAL_VALUES),
    dependents: z.coerce.number().int().min(0, 'Mínimo 0 filhos'),
    hasFGTS: z.boolean(),
    fgtsAmountDisplay: z.string().optional(),
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
    if (data.hasFGTS) {
      const fgts = centsToReais(brlDisplayToCents(data.fgtsAmountDisplay || ''));
      if (fgts < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Valor do FGTS inválido',
          path: ['fgtsAmountDisplay'],
        });
      }
      const gross = pv - dp;
      if (fgts > gross + 1e-6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'FGTS não pode ser maior que o valor financiado bruto',
          path: ['fgtsAmountDisplay'],
        });
      }
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
  netFinancedAmount: number;
  installmentIncomeLimitPercent: 25 | 30;
  allowedTermsMonths: number[];
  warnings: {
    ageReducedTerms: boolean;
    dependentsReducedInstallmentLimit: boolean;
    fgtsReducedPrincipal: boolean;
  };
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
  const queryClient = useQueryClient();
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
      age: 35,
      maritalStatus: 'SOLTEIRO' as const,
      dependents: 0,
      hasFGTS: false,
      fgtsAmountDisplay: '',
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
      age: number;
      maritalStatus: string;
      dependents: number;
      hasFGTS: boolean;
      fgtsAmount: number;
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

  const createProposalMutation = useMutation({
    mutationFn: async (payload: {
      clientId?: string;
      propertyId?: string;
      bank: string;
      installment: number;
      months: number;
      downPayment: number;
    }) => {
      const { data } = await api.post('/proposals', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({
        type: 'success',
        title: 'Proposta criada',
        description: 'Consulte a lista em Propostas para acompanhar o status.',
      });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : undefined;
      const text = Array.isArray(msg) ? msg.join(', ') : msg || 'Não foi possível criar a proposta.';
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

    const fgtsAmount = values.hasFGTS ? centsToReais(brlDisplayToCents(values.fgtsAmountDisplay || '')) : 0;

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
      age: values.age,
      maritalStatus: values.maritalStatus,
      dependents: values.dependents,
      hasFGTS: values.hasFGTS,
      fgtsAmount,
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

  const gerarPropostaDaMelhorOpcao = () => {
    const best = result?.bestOption;
    if (!best) {
      toast({
        type: 'error',
        title: 'Sem melhor opção',
        description: 'Conclua a simulação com pelo menos uma opção aprovada para gerar a proposta.',
      });
      return;
    }
    const v = form.getValues();
    const downPayment = centsToReais(brlDisplayToCents(v.downPaymentDisplay));
    createProposalMutation.mutate({
      clientId: v.clientId || undefined,
      propertyId: v.propertyId || undefined,
      bank: best.bankName,
      installment: best.installment,
      months: best.months,
      downPayment,
    });
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-700 ring-1 ring-accent-500/20">
            Fechamento
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary-950">Simulação de financiamento</h1>
          <p className="mt-2 max-w-3xl text-base text-gray-600">
            Compare bancos e prazos (PRICE). Limite de parcela: até 30% da renda (25% com 3+ dependentes). Idade máxima
            80 anos ao término do financiamento — prazos podem ser ajustados.
          </p>

          <Card className="mt-8 border-primary-100/40 p-6 md:p-8">
            <form onSubmit={onSubmit} className="space-y-8">
              <div>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-primary-950">
                  <span aria-hidden>👤</span> Cliente
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="clientId">
                      Cliente cadastrado{' '}
                      <span className="font-normal text-gray-500">
                        (recomendado — necessário para gerar contrato após aceitar a proposta)
                      </span>
                    </Label>
                    <select
                      id="clientId"
                      className={simSelectClass}
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
                  <div className="space-y-2">
                    <Label htmlFor="age">Idade</Label>
                    <Input
                      id="age"
                      type="number"
                      min={18}
                      max={120}
                      {...form.register('age')}
                    />
                    {form.formState.errors.age && (
                      <p className="text-sm text-red-600">{form.formState.errors.age.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maritalStatus">Estado civil</Label>
                    <select
                      id="maritalStatus"
                      className={simSelectClass}
                      {...form.register('maritalStatus')}
                    >
                      <option value="SOLTEIRO">Solteiro</option>
                      <option value="CASADO">Casado</option>
                      <option value="DIVORCIADO">Divorciado</option>
                      <option value="VIUVO">Viúvo</option>
                    </select>
                    {form.formState.errors.maritalStatus && (
                      <p className="text-sm text-red-600">{form.formState.errors.maritalStatus.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dependents">Quantidade de filhos</Label>
                    <Input
                      id="dependents"
                      type="number"
                      min={0}
                      {...form.register('dependents')}
                    />
                    {form.formState.errors.dependents && (
                      <p className="text-sm text-red-600">{form.formState.errors.dependents.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-primary-950">FGTS</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3 sm:col-span-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.watch('hasFGTS')}
                      onClick={() => {
                        const next = !form.watch('hasFGTS');
                        form.setValue('hasFGTS', next);
                        if (!next) form.setValue('fgtsAmountDisplay', '');
                      }}
                      className={cn(
                        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
                        form.watch('hasFGTS') ? 'bg-accent-500' : 'bg-gray-200',
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
                          form.watch('hasFGTS') ? 'translate-x-5' : 'translate-x-1',
                        )}
                      />
                    </button>
                    <Label className="cursor-pointer text-gray-700">Possui FGTS?</Label>
                  </div>
                  {form.watch('hasFGTS') && (
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="fgtsAmountDisplay">Valor do FGTS</Label>
                      <Input
                        id="fgtsAmountDisplay"
                        inputMode="numeric"
                        placeholder="R$ 0,00"
                        value={form.watch('fgtsAmountDisplay')}
                        onChange={(e) => form.setValue('fgtsAmountDisplay', digitsToBrlDisplay(e.target.value))}
                      />
                      {form.formState.errors.fgtsAmountDisplay && (
                        <p className="text-sm text-red-600">{form.formState.errors.fgtsAmountDisplay.message}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-primary-950">
                  <span aria-hidden>🏠</span> Imóvel
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="propertyId">Imóvel do sistema (opcional)</Label>
                    <select
                      id="propertyId"
                      className={simSelectClass}
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
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-primary-950">
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
                        className="h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500"
                        checked={form.watch('saveSimulation')}
                        onChange={(e) => form.setValue('saveSimulation', e.target.checked)}
                      />
                      Salvar simulação no histórico
                    </label>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={compareMutation.isPending} className="min-w-[180px] font-bold shadow-cta">
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
              <div className="space-y-3">
                {result.warnings.ageReducedTerms && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Prazos ajustados pela idade: consideramos o limite de <strong>80 anos</strong> ao final do financiamento.
                    Prazos padrão indisponíveis foram substituídos por um prazo compatível, quando necessário.
                  </div>
                )}
                {result.warnings.dependentsReducedInstallmentLimit && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    Com <strong>3 ou mais dependentes</strong>, o limite da parcela considerado foi de{' '}
                    <strong>25% da renda</strong> (em vez de 30%).
                  </div>
                )}
                {result.warnings.fgtsReducedPrincipal && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                    Uso do <strong>FGTS</strong>: o valor financiado para cálculo da parcela foi reduzido pelo saldo informado.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary-100/60 bg-gradient-to-br from-white to-primary-50/50 p-5 shadow-sm">
                <div>
                  <h2 className="text-xl font-bold text-primary-950">Resultado da comparação</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Valor financiado (imóvel - entrada):{' '}
                    <strong className="text-primary-900">{formatMoney(result.financedAmount)}</strong>
                  </p>
                  {result.warnings.fgtsReducedPrincipal && (
                    <p className="text-sm text-gray-600">
                      Valor usado no cálculo (após FGTS): <strong>{formatMoney(result.netFinancedAmount)}</strong>
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Limite da parcela nesta simulação: {result.installmentIncomeLimitPercent}% da renda mensal.
                  </p>
                </div>
                {result.bestOption && (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="border-2 border-success-500/40 bg-success-50 font-bold text-success-800 shadow-sm hover:bg-success-100"
                      onClick={() => openWhatsApp(result.bestOption!)}
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WhatsApp — melhor opção
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      className="min-w-[160px] font-bold"
                      disabled={createProposalMutation.isPending}
                      onClick={gerarPropostaDaMelhorOpcao}
                    >
                      {createProposalMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      Gerar proposta
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {result.byBank.map(({ bank, options }) => {
                  const logoSrc = getBankLogoUrl(bank.name);
                  const accent = getBankAccent(bank.name);
                  return (
                    <Card
                      key={bank.id}
                      className="overflow-hidden border-primary-100/40 p-0 shadow-card ring-1 ring-primary-950/5"
                    >
                      <div className="flex gap-4 border-b border-surface-muted bg-gradient-to-br from-primary-50/40 via-white to-surface px-5 py-4 sm:gap-5">
                        <div
                          className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm"
                          style={{ boxShadow: `0 8px 24px -8px ${accent}55` }}
                        >
                          {logoSrc ? (
                            <Image
                              src={logoSrc}
                              alt={`Logo ${bank.name}`}
                              width={52}
                              height={52}
                              className="object-contain p-2"
                            />
                          ) : (
                            <Landmark className="h-8 w-8 text-gray-400" aria-hidden />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-semibold tracking-tight text-gray-900">{bank.name}</h3>
                          <p className="mt-1 text-sm text-gray-600">
                            Taxa:{' '}
                            <span className="font-semibold text-gray-900">{formatPct(bank.monthlyRate)}</span>
                          </p>
                          <p className="mt-2 text-xs leading-relaxed text-gray-500">
                            {options.length} opção(ões) de prazo · Parcela e custo total (PRICE) por linha abaixo.
                          </p>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-100 bg-white">
                        {options.map((opt) => {
                          const key = `${opt.bankId}-${opt.months}`;
                          const isBest = result.bestKey === key;
                          return (
                            <div
                              key={key}
                              className={cn(
                                'flex flex-col gap-3 px-4 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:px-5',
                                isBest &&
                                  'bg-gradient-to-r from-accent-50/90 to-amber-50/50 ring-1 ring-inset ring-accent-200/60',
                                !isBest && 'hover:bg-surface/90',
                              )}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-gray-800">{opt.months} meses</span>
                                <span
                                  className={cn(
                                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                                    opt.approved ? 'bg-success-100 text-success-800' : 'bg-red-100 text-red-800',
                                  )}
                                >
                                  {opt.approved ? 'Aprovado' : 'Reprovado'}
                                </span>
                                {isBest && opt.approved && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                                    <Star className="h-3 w-3" />
                                    Melhor escolha
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col gap-1 text-sm sm:text-right">
                                <span>
                                  Parcela: <strong className="text-gray-900">{formatMoney(opt.installment)}</strong>
                                </span>
                                <span className="text-gray-600">Custo total: {formatMoney(opt.totalCost)}</span>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0 border-success-500/40 font-semibold text-success-800 hover:bg-success-50"
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
                  );
                })}
              </div>

              <Card className="border-primary-100/40 p-5 md:p-6">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary-950">
                  Ranking geral (melhores primeiro)
                </h3>
                <ol className="list-decimal space-y-2 pl-5 text-sm font-medium text-gray-700">
                  {result.ranked.slice(0, 8).map((r) => (
                    <li key={`${r.bankId}-${r.months}`}>
                      {r.bankName} — {r.months}m — {formatMoney(r.installment)} —{' '}
                      <span className={r.approved ? 'font-bold text-success-700' : 'font-semibold text-red-600'}>
                        {r.approved ? 'ok' : `acima de ${result.installmentIncomeLimitPercent}%`}
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
