'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  FileText,
  Info,
  Loader2,
  MessageCircle,
  RefreshCw,
  Landmark,
  Star,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  adjustMonthlyRate,
  nominalAnnualPercentLinear,
  effectiveAnnualPercent,
  approximateCetAnnualPercent,
  sacSummary,
  priceSummary,
  type MortgageIndexer,
  type MortgageProductLine,
} from '@/lib/mortgage-calculator';
import { BRAZIL_UFS } from '@/lib/brazil-ufs';
import {
  formatCpf,
  digitsOnly,
  digitsToBrlDisplay,
  brlDisplayToCents,
  centsToReais,
  formatPhoneBrDigits,
  formatDateBrDigits,
  parseDateBrToAge,
  toWhatsAppDigits,
} from '@/lib/masks';
import { cn } from '@/lib/utils';
import { getBankAccent, getBankLogoUrl } from '@/utils/bankLogos';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';

const selectClass =
  'flex h-11 w-full rounded-xl border-2 border-surface-muted bg-white px-3 text-sm text-gray-900 transition-colors focus-visible:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30';

const STEPS = [
  { n: 1, title: 'Dados iniciais', short: 'Iniciais' },
  { n: 2, title: 'Dados do cliente', short: 'Cliente' },
  { n: 3, title: 'Opções', short: 'Opções' },
  { n: 4, title: 'Resultados', short: 'Resultados' },
] as const;

type SimOption = {
  bankId: string;
  bankName: string;
  monthlyRate: number;
  months: number;
  installment: number;
  totalCost: number;
  approved: boolean;
};

type MortgageAnalysis = {
  benchmarkBankMonthlyRate: number;
  adjustedMonthlyRate: number;
  nominalAnnualPercent: number;
  effectiveAnnualPercent: number;
  cetApproxAnnualPercent: number;
  indexer: string;
  productLine: string;
  analysisMonths: number;
  principal: number;
  propertyValue: number;
  downPayment: number;
  maxLtvPercent: number;
  maxTermMonths: number;
  incomeCommitmentMaxPercent: number;
  maxInstallmentAllowed: number;
  sac: {
    firstInstallment: number;
    lastInstallment: number;
    averageInstallment: number;
    totalPaid: number;
    totalInterest: number;
    amortizationFixed: number;
    approved: boolean;
  };
  price: {
    installment: number;
    firstInstallment: number;
    lastInstallment: number;
    totalPaid: number;
    totalInterest: number;
    approved: boolean;
  };
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
  mortgageAnalysis?: MortgageAnalysis;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function formatPctMonthly(rate: number) {
  return `${(rate * 100).toFixed(4)}% a.m.`;
}

function buildCaixaWhatsApp(
  lotValue: number,
  down: number,
  installment: number,
  months: number,
) {
  return `Simulação de financiamento:

Valor do lote: ${formatMoney(lotValue)}
Entrada: ${formatMoney(down)}
Parcelas: ${formatMoney(installment)}
Prazo: ${months} meses

Quer que eu reserve esse lote para você?`;
}

export function CaixaFinancingWizard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<CompareResponse | null>(null);

  const [personType, setPersonType] = useState<'FISICA' | 'JURIDICA'>('FISICA');
  const [financingCategory, setFinancingCategory] = useState<'RESIDENCIAL' | 'GARANTIA'>('RESIDENCIAL');
  const [acquisitionType, setAcquisitionType] = useState<'NOVO' | 'USADO' | 'LOTE'>('LOTE');
  const [propertyValueDisplay, setPropertyValueDisplay] = useState('');
  const [stateUf, setStateUf] = useState('CE');
  const [city, setCity] = useState('');
  const [ownsInCity, setOwnsInCity] = useState(false);
  const [portability, setPortability] = useState(false);

  const [clientName, setClientName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [incomeDisplay, setIncomeDisplay] = useState('');
  const [birthDateDisplay, setBirthDateDisplay] = useState('');
  const [hasFgts3Years, setHasFgts3Years] = useState(false);
  const [hadSubsidy, setHadSubsidy] = useState(false);
  const [dependentsCount, setDependentsCount] = useState(0);
  const [publicServant, setPublicServant] = useState(false);
  const [bankRelationship, setBankRelationship] = useState(false);
  const [fgtsAmountDisplay, setFgtsAmountDisplay] = useState('');

  const [indexer, setIndexer] = useState<MortgageIndexer>('TR');
  const [productLine, setProductLine] = useState<MortgageProductLine>('SBPE');
  const [amortizationFocus, setAmortizationFocus] = useState<'SAC' | 'PRICE' | 'BOTH'>('BOTH');

  const [termMonths, setTermMonths] = useState(360);
  const [downPaymentDisplay, setDownPaymentDisplay] = useState('');
  const [saveSimulation, setSaveSimulation] = useState(true);

  const [clientId, setClientId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [developmentId, setDevelopmentId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [lotId, setLotId] = useState('');

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
      const { data } = await api.get<Array<{ id: string; title: string; price: number | string }>>('/properties');
      return data;
    },
  });

  const { data: developments } = useQuery({
    queryKey: ['developments'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; city: string }>>('/developments');
      return data;
    },
  });

  const { data: blocks } = useQuery({
    queryKey: ['blocks', developmentId],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string }>>(`/blocks/development/${developmentId}`);
      return data;
    },
    enabled: !!developmentId,
  });

  const { data: lots } = useQuery({
    queryKey: ['lots', blockId],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; number: string; price?: unknown }>>(
        `/lots/block/${blockId}`,
      );
      return data;
    },
    enabled: !!blockId,
  });

  const { data: banks } = useQuery({
    queryKey: ['simulation-banks'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; monthlyRate: number }>>('/simulations/banks');
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ['simulations-mine'],
    queryFn: async () => {
      const { data } = await api.get<unknown[]>('/simulations/mine');
      return data;
    },
  });

  const age = useMemo(() => parseDateBrToAge(birthDateDisplay), [birthDateDisplay]);
  const propertyValue = centsToReais(brlDisplayToCents(propertyValueDisplay));
  const downPayment = centsToReais(brlDisplayToCents(downPaymentDisplay));
  const income = centsToReais(brlDisplayToCents(incomeDisplay));
  const fgtsAmount = centsToReais(brlDisplayToCents(fgtsAmountDisplay));
  const grossFinanced = Math.max(0, propertyValue - downPayment);
  const principalPreview = Math.max(0, grossFinanced - (hasFgts3Years ? fgtsAmount : 0));

  const previewRate = useMemo(() => {
    if (!banks?.length) return 0;
    const low = Math.min(...banks.map((b) => b.monthlyRate));
    return adjustMonthlyRate(low, indexer, productLine);
  }, [banks, indexer, productLine]);

  const livePreview = useMemo(() => {
    if (principalPreview <= 0 || termMonths < 12 || !previewRate) return null;
    return {
      sac: sacSummary(principalPreview, previewRate, termMonths),
      price: priceSummary(principalPreview, previewRate, termMonths),
      nominal: nominalAnnualPercentLinear(previewRate),
      effective: effectiveAnnualPercent(previewRate),
      cet: approximateCetAnnualPercent(previewRate),
    };
  }, [principalPreview, termMonths, previewRate]);

  const suggestDown20 = () => {
    if (propertyValue <= 0) return;
    const cents = Math.round(propertyValue * 0.2 * 100);
    const reais = Math.floor(cents / 100);
    const frac = cents % 100;
    const parts = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setDownPaymentDisplay(`R$ ${parts},${frac.toString().padStart(2, '0')}`);
  };

  const selectedClient = clients?.find((c) => c.id === clientId);

  const compareMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post<CompareResponse>('/simulations/compare', payload);
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep(4);
      queryClient.invalidateQueries({ queryKey: ['simulations-mine'] });
      toast({ type: 'success', title: 'Simulação concluída', description: 'Revise os resultados e as opções por banco.' });
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
        description: 'Consulte a lista em Propostas.',
      });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : undefined;
      toast({ type: 'error', title: 'Erro', description: Array.isArray(msg) ? msg.join(', ') : msg || 'Falha.' });
    },
  });

  const validateStep1 = () => {
    if (!propertyValueDisplay || propertyValue <= 0) {
      toast({ type: 'error', title: 'Valor do lote', description: 'Informe o valor do terreno/lote.' });
      return false;
    }
    if (!city.trim()) {
      toast({ type: 'error', title: 'Cidade', description: 'Informe a cidade do imóvel.' });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (clientName.trim().length < 2) {
      toast({ type: 'error', title: 'Nome', description: 'Informe o nome completo.' });
      return false;
    }
    if (digitsOnly(cpf, 11).length !== 11) {
      toast({ type: 'error', title: 'CPF', description: 'CPF deve ter 11 dígitos.' });
      return false;
    }
    if (!incomeDisplay || income <= 0) {
      toast({ type: 'error', title: 'Renda', description: 'Informe a renda familiar mensal.' });
      return false;
    }
    const a = parseDateBrToAge(birthDateDisplay);
    if (a == null || a < 18) {
      toast({ type: 'error', title: 'Nascimento', description: 'Data válida (dd/mm/aaaa) e idade mínima 18 anos.' });
      return false;
    }
    return true;
  };

  const runSimulation = () => {
    const a = parseDateBrToAge(birthDateDisplay);
    if (a == null || a < 18) {
      toast({
        type: 'error',
        title: 'Data de nascimento',
        description: 'Volte à etapa 2 e informe uma data de nascimento válida.',
      });
      return;
    }
    const minDown = propertyValue * 0.1;
    if (downPayment + 1e-6 < minDown) {
      toast({
        type: 'error',
        title: 'Entrada mínima',
        description: `Mínimo 10% do valor: ${formatMoney(minDown)}.`,
      });
      return;
    }
    const phone = selectedClient?.phone?.replace(/\D/g, '') || phoneDigits;
    compareMutation.mutate({
      clientName: clientName.trim(),
      cpf: digitsOnly(cpf, 11),
      income,
      propertyValue,
      downPayment,
      clientId: clientId || undefined,
      propertyId: propertyId || undefined,
      lotId: lotId || undefined,
      clientPhone: phone.length >= 10 ? phone : undefined,
      save: saveSimulation,
      age: a,
      maritalStatus: 'SOLTEIRO',
      dependents: dependentsCount,
      hasFGTS: hasFgts3Years,
      fgtsAmount: hasFgts3Years ? fgtsAmount : 0,
      enforceMinDownPercent: true,
      chosenTermMonths: termMonths,
      indexer,
      productLine,
      includeMortgageAnalysis: true,
      metadata: {
        wizardVersion: 1,
        personType,
        financingCategory,
        acquisitionType,
        stateUf,
        city: city.trim(),
        ownsInCity,
        portability,
        hadSubsidy,
        publicServant,
        bankRelationship,
        amortizationFocus,
        developmentId: developmentId || null,
        blockId: blockId || null,
      },
    });
  };

  const resetAll = () => {
    setStep(1);
    setResult(null);
    setPropertyValueDisplay('');
    setDownPaymentDisplay('');
    setBirthDateDisplay('');
    setCpf('');
    setPhoneDigits('');
  };

  const openWhatsAppCaixa = () => {
    const ma = result?.mortgageAnalysis;
    const inst =
      amortizationFocus === 'SAC'
        ? ma?.sac.firstInstallment
        : amortizationFocus === 'PRICE'
          ? ma?.price.installment
          : ma?.price.installment;
    const months = ma?.analysisMonths ?? termMonths;
    const phoneRaw = selectedClient?.phone?.trim() || phoneDigits;
    const wa = toWhatsAppDigits(phoneRaw);
    if (wa.length < 12) {
      toast({ type: 'error', title: 'Telefone', description: 'Informe celular com DDD ou selecione cliente com telefone.' });
      return;
    }
    if (inst == null) {
      toast({ type: 'error', title: 'Simulação', description: 'Execute a simulação antes de enviar.' });
      return;
    }
    const text = encodeURIComponent(
      buildCaixaWhatsApp(propertyValue, downPayment, inst, months),
    );
    window.open(`https://wa.me/${wa}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const gerarProposta = () => {
    const best = result?.bestOption;
    if (!best) {
      toast({ type: 'error', title: 'Sem opção aprovada', description: 'Ajuste prazo, entrada ou renda.' });
      return;
    }
    createProposalMutation.mutate({
      clientId: clientId || undefined,
      propertyId: propertyId || undefined,
      bank: best.bankName,
      installment: best.installment,
      months: best.months,
      downPayment,
    });
  };

  const next = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => Math.min(4, s + 1));
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  const ma = result?.mortgageAnalysis;

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-2 lg:sticky lg:top-4 lg:self-start" aria-label="Etapas">
          {STEPS.map((s) => {
            const active = step === s.n;
            const done = step > s.n;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => {
                  if (s.n < step) setStep(s.n);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-all',
                  active && 'border-primary-600 bg-primary-50 text-primary-900 shadow-sm',
                  done && !active && 'border-surface-muted bg-white text-gray-600 hover:bg-surface',
                  !done && !active && 'border-dashed border-surface-muted text-gray-400',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                    active && 'bg-primary-700 text-white',
                    done && !active && 'bg-success-500 text-white',
                    !done && !active && 'bg-gray-200 text-gray-500',
                  )}
                >
                  {s.n}
                </span>
                <span className="hidden sm:inline">{s.title}</span>
                <span className="sm:hidden">{s.short}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-6">
          {step === 1 && (
            <Card className="border-surface-muted p-6 shadow-card md:p-8">
              <div className="mb-6 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-700 text-lg font-bold text-white">
                  1
                </span>
                <div>
                  <h2 className="text-xl font-bold text-primary-950">Dados iniciais</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Simulação para aquisição de <strong>terreno em loteamento</strong> ou financiamento residencial — valores reais (milhares a milhões).
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <Label className="text-gray-800">Tipo de pessoa</Label>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {(['FISICA', 'JURIDICA'] as const).map((t) => (
                      <label key={t} className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <input
                          type="radio"
                          name="person"
                          checked={personType === t}
                          onChange={() => setPersonType(t)}
                          className="h-4 w-4 text-primary-700"
                        />
                        {t === 'FISICA' ? 'Física' : 'Jurídica'}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      Tipo de financiamento <span className="text-red-500">*</span>
                    </Label>
                    <select
                      className={selectClass}
                      value={financingCategory}
                      onChange={(e) => setFinancingCategory(e.target.value as typeof financingCategory)}
                    >
                      <option value="RESIDENCIAL">Residencial</option>
                      <option value="GARANTIA">Empréstimo com garantia de imóvel</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Tipo de aquisição <span className="text-red-500">*</span>
                    </Label>
                    <select
                      className={selectClass}
                      value={acquisitionType}
                      onChange={(e) => setAcquisitionType(e.target.value as typeof acquisitionType)}
                    >
                      <option value="LOTE">Lote urbanizado / terreno (loteamento)</option>
                      <option value="NOVO">Imóvel novo</option>
                      <option value="USADO">Imóvel usado</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Valor do lote / imóvel <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={propertyValueDisplay}
                    onChange={(e) => setPropertyValueDisplay(digitsToBrlDisplay(e.target.value))}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      UF <span className="text-red-500">*</span>
                    </Label>
                    <select className={selectClass} value={stateUf} onChange={(e) => setStateUf(e.target.value)}>
                      {BRAZIL_UFS.map((u) => (
                        <option key={u.uf} value={u.uf}>
                          {u.uf} — {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Cidade <span className="text-red-500">*</span>
                    </Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade do imóvel" />
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-surface-muted bg-surface/50 p-4">
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={ownsInCity}
                      onChange={(e) => setOwnsInCity(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300"
                    />
                    Possuo imóvel nesta cidade
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={portability}
                      onChange={(e) => setPortability(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300"
                    />
                    Portabilidade de crédito imobiliário
                  </label>
                </div>

                <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-4 text-sm text-primary-900">
                  <p className="flex items-center gap-2 font-semibold">
                    <Info className="h-4 w-4 shrink-0" />
                    Vincular lote (opcional)
                  </p>
                  <p className="mt-1 text-primary-800/90">
                    Selecione loteamento → quadra → lote para pré-preencher o valor e salvar no histórico com vínculo.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <select
                      className={selectClass}
                      value={developmentId}
                      onChange={(e) => {
                        setDevelopmentId(e.target.value);
                        setBlockId('');
                        setLotId('');
                      }}
                    >
                      <option value="">Loteamento</option>
                      {developments?.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className={selectClass}
                      value={blockId}
                      onChange={(e) => {
                        setBlockId(e.target.value);
                        setLotId('');
                      }}
                      disabled={!developmentId}
                    >
                      <option value="">Quadra</option>
                      {blocks?.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className={selectClass}
                      value={lotId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setLotId(id);
                        const L = lots?.find((l) => l.id === id);
                        const p = L?.price != null ? Number(L.price) : NaN;
                        if (!Number.isNaN(p) && p > 0) {
                          const cents = Math.round(p * 100);
                          const reais = Math.floor(cents / 100);
                          const frac = cents % 100;
                          const parts = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                          setPropertyValueDisplay(`R$ ${parts},${frac.toString().padStart(2, '0')}`);
                        }
                      }}
                      disabled={!blockId}
                    >
                      <option value="">Lote</option>
                      {lots?.map((l) => (
                        <option key={l.id} value={l.id}>
                          Lote {l.number}
                          {l.price != null ? ` — ${formatMoney(Number(l.price))}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button type="button" className="gap-2 font-bold shadow-cta" onClick={next}>
                  Próxima etapa
                  <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                </Button>
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card className="border-surface-muted p-6 shadow-card md:p-8">
              <div className="mb-6 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-700 text-lg font-bold text-white">
                  2
                </span>
                <div>
                  <h2 className="text-xl font-bold text-primary-950">Seus dados</h2>
                  <p className="mt-1 text-sm text-gray-600">Informe dados do proponente para comprometimento de renda e histórico.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Cliente cadastrado</Label>
                  <select
                    className={selectClass}
                    value={clientId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setClientId(id);
                      const c = clients?.find((x) => x.id === id);
                      if (c) {
                        setClientName(c.name);
                        if (c.phone) setPhoneDigits(digitsOnly(c.phone, 11));
                      }
                    }}
                  >
                    <option value="">— Opcional —</option>
                    {clients?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>
                    Nome completo <span className="text-red-500">*</span>
                  </Label>
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>
                    CPF <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    inputMode="numeric"
                    value={formatCpf(cpf)}
                    onChange={(e) => setCpf(digitsOnly(e.target.value, 11))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Celular (WhatsApp)</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="(88) 98888-8888"
                    value={formatPhoneBrDigits(phoneDigits)}
                    onChange={(e) => setPhoneDigits(digitsOnly(e.target.value, 11))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Renda bruta familiar mensal <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={incomeDisplay}
                    onChange={(e) => setIncomeDisplay(digitsToBrlDisplay(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Data de nascimento <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    inputMode="numeric"
                    placeholder="dd/mm/aaaa"
                    value={formatDateBrDigits(birthDateDisplay)}
                    onChange={(e) => setBirthDateDisplay(digitsOnly(e.target.value, 8))}
                  />
                  {age != null ? (
                    <p className="text-xs text-gray-500">Idade calculada: {age} anos</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Nº de dependentes</Label>
                  <Input
                    type="number"
                    min={0}
                    value={dependentsCount}
                    onChange={(e) => setDependentsCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                </div>
              </div>

              <div className="mt-6 space-y-3 rounded-xl border border-surface-muted bg-white p-4">
                <p className="text-sm font-semibold text-gray-800">Marque o que se aplica</p>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hasFgts3Years}
                    onChange={(e) => {
                      setHasFgts3Years(e.target.checked);
                      if (!e.target.checked) setFgtsAmountDisplay('');
                    }}
                    className="mt-0.5 h-4 w-4 rounded"
                  />
                  Possui 3 anos de trabalho sob regime do FGTS (uso como abatimento no financiado)
                </label>
                {hasFgts3Years && (
                  <div className="space-y-2 pl-6">
                    <Label>Valor a usar do FGTS (opcional)</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="R$ 0,00"
                      value={fgtsAmountDisplay}
                      onChange={(e) => setFgtsAmountDisplay(digitsToBrlDisplay(e.target.value))}
                    />
                  </div>
                )}
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hadSubsidy}
                    onChange={(e) => setHadSubsidy(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded"
                  />
                  Já teve benefício habitacional (FGTS/União)
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={publicServant}
                    onChange={(e) => setPublicServant(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded"
                  />
                  Servidor público
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={bankRelationship}
                    onChange={(e) => setBankRelationship(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded"
                  />
                  Relacionamento / intenção de relacionamento com banco
                </label>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button type="button" variant="outline" className="gap-2" onClick={back}>
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <Button type="button" className="gap-2 font-bold shadow-cta" onClick={next}>
                  Próxima etapa
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {step === 3 && (
            <Card className="border-surface-muted p-6 shadow-card md:p-8">
              <div className="mb-6 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-700 text-lg font-bold text-white">
                  3
                </span>
                <div>
                  <h2 className="text-xl font-bold text-primary-950">Opções de financiamento</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Quanto maior o relacionamento com a instituição, em geral melhores condições — aqui você compara sistemas e indexadores (modelo didático).
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Linha de produto</Label>
                    <select
                      className={selectClass}
                      value={productLine}
                      onChange={(e) => setProductLine(e.target.value as MortgageProductLine)}
                    >
                      <option value="SBPE">SBPE (referência mercado / Caixa)</option>
                      <option value="PADRAO">Crédito imobiliário padrão</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Indexador</Label>
                    <select
                      className={selectClass}
                      value={indexer}
                      onChange={(e) => setIndexer(e.target.value as MortgageIndexer)}
                    >
                      <option value="TR">TR (referencial — maior variabilidade modelada)</option>
                      <option value="FIXA">Taxa fixa (previsibilidade)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Destaque na simulação</Label>
                  <div className="flex flex-wrap gap-4">
                    {(['SAC', 'PRICE', 'BOTH'] as const).map((t) => (
                      <label key={t} className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <input
                          type="radio"
                          name="amort"
                          checked={amortizationFocus === t}
                          onChange={() => setAmortizationFocus(t)}
                          className="h-4 w-4 text-primary-700"
                        />
                        {t === 'SAC' ? 'SAC' : t === 'PRICE' ? 'PRICE' : 'SAC + PRICE'}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="prose prose-sm max-w-none rounded-xl border border-blue-100 bg-blue-50/50 p-5 text-gray-800">
                  <p className="font-bold text-primary-900">SAC vs PRICE</p>
                  <p>
                    No <strong>SAC</strong> (Sistema de Amortização Constante), a parcela inicial é maior, pois os juros incidem sobre o saldo total no início; a amortização principal é fixa e os juros caem a cada mês — em geral <strong>menos juros totais</strong> ao fim do contrato.
                  </p>
                  <p>
                    No <strong>PRICE</strong> (Sistema Francês), a parcela é <strong>constante</strong>; no início paga-se mais juros e menos principal. Pode ser mais confortável para o fluxo mensal, mas costuma gerar <strong>maior custo total de juros</strong> que o SAC para o mesmo prazo e taxa.
                  </p>
                  <p className="text-xs text-gray-600">
                    Indexadores TR vs fixa alteram o risco e a projeção: TR costuma acompanhar referenciais de mercado; taxa fixa facilita o planejamento. Valores exatos dependem da política do banco e do contrato — esta tela usa taxas da sua base de bancos + ajuste educativo.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button type="button" variant="outline" className="gap-2" onClick={back}>
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <Button type="button" className="gap-2 font-bold shadow-cta" onClick={next}>
                  Próxima etapa
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {step === 4 && !result && (
            <Card className="border-surface-muted p-6 shadow-card md:p-8">
              <div className="mb-6 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-700 text-lg font-bold text-white">
                  4
                </span>
                <div>
                  <h2 className="text-xl font-bold text-primary-950">Parâmetros finais</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Prazo até 420 meses, entrada mínima 10%. Comprometimento máximo da parcela: 30% da renda (25% com 3+ dependentes).
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prazo (meses)</Label>
                  <Input
                    type="number"
                    min={12}
                    max={420}
                    value={termMonths}
                    onChange={(e) => setTermMonths(Math.min(420, Math.max(12, parseInt(e.target.value, 10) || 360)))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label>Entrada (mín. 10%)</Label>
                      <Input
                        inputMode="numeric"
                        value={downPaymentDisplay}
                        onChange={(e) => setDownPaymentDisplay(digitsToBrlDisplay(e.target.value))}
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={suggestDown20}>
                      Sugerir 20%
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Financiado: {formatMoney(grossFinanced)} · Principal p/ parcela (pós-FGTS): {formatMoney(principalPreview)}
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Imóvel do portfólio (opcional)</Label>
                  <select
                    className={selectClass}
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                  >
                    <option value="">— Nenhum —</option>
                    {properties?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={saveSimulation}
                    onChange={(e) => setSaveSimulation(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  Salvar no histórico (com metadados das etapas e vínculo de lote, se houver)
                </label>
              </div>

              {livePreview && (
                <div className="mt-6 overflow-x-auto rounded-xl border border-surface-muted">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b bg-surface text-left text-xs font-bold uppercase text-gray-600">
                        <th className="p-3">Cenário</th>
                        <th className="p-3">1ª parcela</th>
                        <th className="p-3">Última parcela</th>
                        <th className="p-3">Total pago</th>
                        <th className="p-3">Juros totais</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-3 font-semibold">SAC</td>
                        <td className="p-3">{formatMoney(livePreview.sac.firstInstallment)}</td>
                        <td className="p-3">{formatMoney(livePreview.sac.lastInstallment)}</td>
                        <td className="p-3">{formatMoney(livePreview.sac.totalPaid)}</td>
                        <td className="p-3">{formatMoney(livePreview.sac.totalInterest)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold">PRICE</td>
                        <td className="p-3">{formatMoney(livePreview.price.installment)}</td>
                        <td className="p-3">{formatMoney(livePreview.price.installment)}</td>
                        <td className="p-3">{formatMoney(livePreview.price.totalPaid)}</td>
                        <td className="p-3">{formatMoney(livePreview.price.totalInterest)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="border-t bg-primary-50/30 px-3 py-2 text-xs text-gray-600">
                    Prévia com menor taxa mensal da base + ajuste {productLine}/{indexer} · Nominal ~{livePreview.nominal}% a.a.
                    (linear) · Efetivo ~{livePreview.effective}% a.a. · CET aprox. ~{livePreview.cet}% a.a.
                  </p>
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={back}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  className="min-w-[200px] font-bold shadow-cta"
                  disabled={compareMutation.isPending}
                  onClick={runSimulation}
                >
                  {compareMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Calculando…
                    </>
                  ) : (
                    'Calcular simulação completa'
                  )}
                </Button>
              </div>
            </Card>
          )}

          {step === 4 && result && (
            <div className="space-y-6">
              <Card className="border-primary-200/60 p-6 shadow-card md:p-8">
                <h2 className="text-xl font-bold text-primary-950">Resumo — linha {productLine}</h2>
                <p className="mt-1 text-sm text-gray-600">
                  {productLine === 'SBPE' ? 'SBPE — referência balcão (modelo didático)' : 'Crédito imobiliário padrão'} ·{' '}
                  {indexer === 'TR' ? 'Indexador TR' : 'Taxa fixa'} · {ma?.analysisMonths ?? termMonths} meses
                </p>
                {ma && (
                  <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[
                      ['Valor do imóvel/lote', formatMoney(ma.propertyValue)],
                      ['Prazo máximo (regra sistema)', `${ma.maxTermMonths} meses`],
                      ['Prazo escolhido', `${ma.analysisMonths} meses`],
                      ['Financiamento máx. (LTV)', `${ma.maxLtvPercent}%`],
                      ['Entrada', formatMoney(ma.downPayment)],
                      ['Valor financiado (parcela)', formatMoney(ma.principal)],
                      ['Juros nominais (linear)', `${ma.nominalAnnualPercent}% a.a.`],
                      ['Juros efetivos', `${ma.effectiveAnnualPercent}% a.a.`],
                      ['CET aproximado', `${ma.cetApproxAnnualPercent}% a.a.`],
                      ['Limite parcela / renda', `${ma.incomeCommitmentMaxPercent}%`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 border-b border-surface-muted py-2 text-sm">
                        <dt className="flex items-center gap-1 text-gray-600">
                          {k}
                          <Info className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                        </dt>
                        <dd className="font-bold text-primary-950">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {ma && (
                  <div className="mt-8 overflow-x-auto rounded-xl border border-surface-muted">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b bg-primary-800 text-left text-white">
                          <th className="p-3 font-semibold"> </th>
                          <th className="p-3 font-semibold">SAC</th>
                          <th className="p-3 font-semibold">PRICE</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        <tr className="border-b">
                          <td className="p-3 font-medium text-gray-700">1ª prestação</td>
                          <td className="p-3 font-bold">{formatMoney(ma.sac.firstInstallment)}</td>
                          <td className="p-3 font-bold">{formatMoney(ma.price.firstInstallment)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium text-gray-700">Última prestação</td>
                          <td className="p-3 font-bold">{formatMoney(ma.sac.lastInstallment)}</td>
                          <td className="p-3 font-bold">{formatMoney(ma.price.lastInstallment)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium text-gray-700">Parcela média (SAC)</td>
                          <td className="p-3">{formatMoney(ma.sac.averageInstallment)}</td>
                          <td className="p-3 text-gray-400">—</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium text-gray-700">Total pago</td>
                          <td className="p-3 font-semibold">{formatMoney(ma.sac.totalPaid)}</td>
                          <td className="p-3 font-semibold">{formatMoney(ma.price.totalPaid)}</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-medium text-gray-700">Apto. renda</td>
                          <td className="p-3">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-bold',
                                ma.sac.approved ? 'bg-success-100 text-success-800' : 'bg-red-100 text-red-800',
                              )}
                            >
                              {ma.sac.approved ? 'Dentro do limite' : 'Acima do limite'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-bold',
                                ma.price.approved ? 'bg-success-100 text-success-800' : 'bg-red-100 text-red-800',
                              )}
                            >
                              {ma.price.approved ? 'Dentro do limite' : 'Acima do limite'}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-8 flex flex-wrap gap-3">
                  <Button type="button" variant="outline" className="gap-2" onClick={() => setStep(3)}>
                    <ArrowLeft className="h-4 w-4" />
                    Etapa anterior
                  </Button>
                  <Button type="button" variant="secondary" className="gap-2" onClick={resetAll}>
                    <RefreshCw className="h-4 w-4" />
                    Refazer simulação
                  </Button>
                  <Button type="button" className="gap-2 bg-success-600 hover:bg-success-700" onClick={openWhatsAppCaixa}>
                    <MessageCircle className="h-4 w-4" />
                    Enviar no WhatsApp
                  </Button>
                  <Button
                    type="button"
                    disabled={createProposalMutation.isPending || !result.bestOption}
                    onClick={gerarProposta}
                    className="gap-2 font-bold"
                  >
                    {createProposalMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    Gerar proposta
                  </Button>
                </div>
              </Card>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-primary-950">Comparar bancos cadastrados (PRICE)</h3>
                {result.byBank.map(({ bank, options }) => {
                  const logoSrc = getBankLogoUrl(bank.name);
                  const accent = getBankAccent(bank.name);
                  return (
                    <Card key={bank.id} className="overflow-hidden border p-0 shadow-sm">
                      <div className="flex gap-4 border-b bg-surface px-4 py-3">
                        <div
                          className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white"
                          style={{ boxShadow: `0 6px 20px -6px ${accent}44` }}
                        >
                          {logoSrc ? (
                            <Image src={logoSrc} alt="" width={48} height={48} className="object-contain p-1.5" />
                          ) : (
                            <Landmark className="h-7 w-7 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{bank.name}</p>
                          <p className="text-xs text-gray-600">{formatPctMonthly(bank.monthlyRate)}</p>
                        </div>
                      </div>
                      <div className="divide-y">
                        {options.map((opt) => {
                          const key = `${opt.bankId}-${opt.months}`;
                          const isBest = result.bestKey === key;
                          return (
                            <div
                              key={key}
                              className={cn(
                                'flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
                                isBest && opt.approved && 'bg-accent-50/60',
                              )}
                            >
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-semibold">{opt.months} meses</span>
                                <span
                                  className={cn(
                                    'rounded-full px-2 py-0.5 text-xs font-bold',
                                    opt.approved ? 'bg-success-100 text-success-800' : 'bg-red-100 text-red-700',
                                  )}
                                >
                                  {opt.approved ? 'Aprovado' : 'Reprovado'}
                                </span>
                                {isBest && opt.approved && (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800">
                                    <Star className="h-3 w-3" /> Melhor
                                  </span>
                                )}
                              </div>
                              <div className="text-sm">
                                Parcela: <strong>{formatMoney(opt.installment)}</strong> · Total:{' '}
                                {formatMoney(opt.totalCost)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {history && history.length > 0 && (
        <Card className="border-dashed border-surface-muted p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">Últimas simulações salvas</h3>
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm text-gray-600">
            {(history as Array<{ id: string; createdAt: string; clientName: string; propertyValue: unknown }>)
              .slice(0, 8)
              .map((h) => (
                <li key={h.id} className="flex justify-between gap-2 border-b border-surface-muted/80 py-1">
                  <span className="truncate font-medium text-gray-800">{h.clientName}</span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {new Date(h.createdAt).toLocaleString('pt-BR')}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
