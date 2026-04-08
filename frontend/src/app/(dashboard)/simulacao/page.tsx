'use client';

import { useState } from 'react';
import { Building2, Landmark } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import { CaixaFinancingWizard } from '@/components/simulacao/caixa-financing-wizard';
import { SimulationLegacyBankCompare } from '@/components/simulacao/simulation-legacy-bank-compare';

export default function SimulacaoPage() {
  const [mode, setMode] = useState<'caixa' | 'legacy'>('caixa');

  return (
    <main className="min-h-0 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Simulação de financiamento"
          description="Fluxo em 4 etapas inspirado na Caixa, focado em lotes e terrenos, com SAC/PRICE, indexadores e comparação pelos bancos cadastrados. O modo legado mantém o formulário anterior sem alterações de regra."
        />

        <div className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-surface-muted bg-white p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => setMode('caixa')}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all sm:flex-none sm:px-6',
              mode === 'caixa'
                ? 'bg-primary-800 text-white shadow-md'
                : 'text-gray-600 hover:bg-surface',
            )}
          >
            <Landmark className="h-4 w-4 shrink-0 opacity-90" />
            Simulação Caixa (4 etapas)
          </button>
          <button
            type="button"
            onClick={() => setMode('legacy')}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all sm:flex-none sm:px-6',
              mode === 'legacy'
                ? 'bg-primary-800 text-white shadow-md'
                : 'text-gray-600 hover:bg-surface',
            )}
          >
            <Building2 className="h-4 w-4 shrink-0 opacity-90" />
            Comparador de bancos (legado)
          </button>
        </div>

        {mode === 'caixa' ? (
          <CaixaFinancingWizard />
        ) : (
          <SimulationLegacyBankCompare />
        )}
      </div>
    </main>
  );
}
