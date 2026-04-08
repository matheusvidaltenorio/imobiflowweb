/**
 * Cálculos de financiamento (PRICE e SAC) — espelho de backend/src/simulations/mortgage-calculator.ts
 */

export type MortgageIndexer = 'TR' | 'FIXA';
export type MortgageProductLine = 'SBPE' | 'PADRAO';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function adjustMonthlyRate(
  baseMonthly: number,
  indexer: MortgageIndexer,
  productLine: MortgageProductLine,
): number {
  let r = baseMonthly;
  if (productLine === 'SBPE') r *= 1.0008;
  if (indexer === 'TR') r *= 1.012;
  else r *= 0.992;
  return r;
}

export function priceInstallment(principal: number, monthlyRate: number, months: number): number {
  if (months <= 0 || principal <= 0) return 0;
  if (monthlyRate <= 0) return round2(principal / months);
  const factor = Math.pow(1 + monthlyRate, months);
  return round2((principal * monthlyRate * factor) / (factor - 1));
}

export type SacSummary = {
  firstInstallment: number;
  lastInstallment: number;
  averageInstallment: number;
  totalPaid: number;
  totalInterest: number;
  amortizationFixed: number;
};

export function sacSummary(principal: number, monthlyRate: number, months: number): SacSummary {
  if (months <= 0 || principal <= 0) {
    return {
      firstInstallment: 0,
      lastInstallment: 0,
      averageInstallment: 0,
      totalPaid: 0,
      totalInterest: 0,
      amortizationFixed: 0,
    };
  }
  const A = principal / months;
  let balance = principal;
  let totalPaid = 0;
  let firstInstallment = 0;
  let lastInstallment = 0;
  for (let k = 0; k < months; k++) {
    const interest = balance * monthlyRate;
    const installment = A + interest;
    if (k === 0) firstInstallment = installment;
    lastInstallment = installment;
    totalPaid += installment;
    balance = round2(balance - A);
  }
  const totalInterest = round2(totalPaid - principal);
  return {
    firstInstallment: round2(firstInstallment),
    lastInstallment: round2(lastInstallment),
    averageInstallment: round2(totalPaid / months),
    totalPaid: round2(totalPaid),
    totalInterest,
    amortizationFixed: round2(A),
  };
}

export function nominalAnnualPercentLinear(monthlyRate: number): number {
  return round2(monthlyRate * 12 * 100);
}

export function effectiveAnnualPercent(monthlyRate: number): number {
  return round2((Math.pow(1 + monthlyRate, 12) - 1) * 100);
}

export function approximateCetAnnualPercent(monthlyRate: number): number {
  return effectiveAnnualPercent(monthlyRate);
}

export type PriceSummary = {
  installment: number;
  firstInstallment: number;
  lastInstallment: number;
  totalPaid: number;
  totalInterest: number;
};

export function priceSummary(principal: number, monthlyRate: number, months: number): PriceSummary {
  const installment = priceInstallment(principal, monthlyRate, months);
  const totalPaid = round2(installment * months);
  return {
    installment,
    firstInstallment: installment,
    lastInstallment: installment,
    totalPaid,
    totalInterest: round2(totalPaid - principal),
  };
}
