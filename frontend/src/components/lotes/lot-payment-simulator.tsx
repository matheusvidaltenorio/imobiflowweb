'use client';

import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPrice } from '@/lib/utils';

type LotPaymentSimulatorProps = {
  defaultLotValue?: number;
  defaultIncome?: number;
};

export function LotPaymentSimulator({ defaultLotValue = 0, defaultIncome = 0 }: LotPaymentSimulatorProps) {
  const [lotValue, setLotValue] = useState(defaultLotValue > 0 ? String(defaultLotValue) : '');
  const [down, setDown] = useState('');
  const [months, setMonths] = useState('120');
  const [income, setIncome] = useState(defaultIncome > 0 ? String(defaultIncome) : '');

  const result = useMemo(() => {
    const total = parseFloat(lotValue.replace(',', '.')) || 0;
    const entrada = parseFloat(down.replace(',', '.')) || 0;
    const n = Math.max(1, parseInt(months, 10) || 1);
    const financed = Math.max(0, total - entrada);
    const parcela = n > 0 ? financed / n : 0;
    const rend = parseFloat(income.replace(',', '.')) || 0;
    const parcelaPct = rend > 0 ? (parcela / rend) * 100 : 0;
    const alertaRenda = rend > 0 && parcelaPct > 30;
    return { total, entrada, financed, parcela, rend, parcelaPct, alertaRenda, n };
  }, [lotValue, down, months, income]);

  return (
    <Card className="border-primary-100 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2 text-primary-950">
        <Calculator className="h-5 w-5 text-primary-700" />
        <h3 className="font-bold">Simulação de pagamento (lote)</h3>
      </div>
      <p className="mb-4 text-xs text-gray-600">
        Cálculo simples (sem juros). Use como referência rápida na negociação.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex min-h-[6.25rem] flex-col sm:min-h-[5.75rem]">
          <Label className="mb-2 leading-snug">Valor do lote (R$)</Label>
          <Input
            className="mt-auto"
            value={lotValue}
            onChange={(e) => setLotValue(e.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
        </div>
        <div className="flex min-h-[6.25rem] flex-col sm:min-h-[5.75rem]">
          <Label className="mb-2 leading-snug">Entrada (R$)</Label>
          <Input className="mt-auto" value={down} onChange={(e) => setDown(e.target.value)} inputMode="decimal" placeholder="0" />
        </div>
        <div className="flex min-h-[6.25rem] flex-col sm:min-h-[5.75rem]">
          <Label className="mb-2 leading-snug">Parcelas (quantidade)</Label>
          <Input className="mt-auto" value={months} onChange={(e) => setMonths(e.target.value)} inputMode="numeric" />
        </div>
        <div className="flex min-h-[6.25rem] flex-col sm:min-h-[5.75rem]">
          <Label className="mb-2 leading-snug">Renda familiar (R$/mês) — opcional</Label>
          <Input className="mt-auto" value={income} onChange={(e) => setIncome(e.target.value)} inputMode="decimal" placeholder="0" />
        </div>
      </div>
      <div className="mt-4 space-y-2 rounded-xl bg-surface p-4 text-sm">
        <p>
          <span className="text-gray-600">Valor financiado:</span>{' '}
          <strong className="text-primary-900">{formatPrice(result.financed)}</strong>
        </p>
        <p>
          <span className="text-gray-600">Parcela ({result.n}x):</span>{' '}
          <strong className="text-lg text-primary-800">{formatPrice(result.parcela)}</strong>
        </p>
        {result.rend > 0 ? (
          <p className={result.alertaRenda ? 'font-semibold text-amber-800' : 'text-gray-700'}>
            Parcela representa {result.parcelaPct.toFixed(1)}% da renda informada.
            {result.alertaRenda ? ' Atenção: acima de 30% da renda.' : ''}
          </p>
        ) : null}
      </div>
      <Button type="button" variant="secondary" className="mt-3" onClick={() => { setLotValue(''); setDown(''); setMonths('120'); setIncome(''); }}>
        Limpar
      </Button>
    </Card>
  );
}
