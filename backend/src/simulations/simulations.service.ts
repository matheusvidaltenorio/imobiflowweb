import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { ClosingPredictionService } from '../closing-prediction/closing-prediction.service';
import { CompareSimulationDto } from './dto/compare-simulation.dto';
import { sanitizeInput } from '../common/utils/xss.util';
import {
  adjustMonthlyRate,
  approximateCetAnnualPercent,
  effectiveAnnualPercent,
  nominalAnnualPercentLinear,
  priceSummary,
  sacSummary,
  type MortgageIndexer,
  type MortgageProductLine,
} from './mortgage-calculator';

const TERMS_MONTHS = [120, 180, 240, 300, 360, 420] as const;
const MAX_FINANCING_TERM_MONTHS = 420;

export type SimulationOptionRow = {
  bankId: string;
  bankName: string;
  monthlyRate: number;
  months: number;
  installment: number;
  totalCost: number;
  approved: boolean;
};

export type SimulationCompareWarnings = {
  ageReducedTerms: boolean;
  dependentsReducedInstallmentLimit: boolean;
  fgtsReducedPrincipal: boolean;
};

/** Prazos permitidos: idade + anos de financiamento <= 80 */
function buildAllowedTerms(age: number | undefined): { terms: number[]; ageLimited: boolean } {
  if (age === undefined || age === null) {
    return { terms: [...TERMS_MONTHS], ageLimited: false };
  }
  const maxMonths = Math.floor((80 - age) * 12);
  if (maxMonths < 12) {
    throw new BadRequestException(
      'Limite de idade não permite financiamento com prazo mínimo de 12 meses ao final do contrato',
    );
  }
  let terms: number[] = TERMS_MONTHS.filter((n) => n <= maxMonths);
  const isFullStandardSet =
    terms.length === TERMS_MONTHS.length && TERMS_MONTHS.every((t) => terms.includes(t));
  if (terms.length === 0) {
    const capped = Math.min(maxMonths, MAX_FINANCING_TERM_MONTHS);
    const rounded = Math.floor(capped / 12) * 12;
    if (rounded < 12) {
      throw new BadRequestException('Nenhum prazo compatível com o limite de 80 anos ao final do financiamento');
    }
    terms = [rounded];
  }
  const usesOnlyStandardTerms = terms.every((t) =>
    TERMS_MONTHS.includes(t as (typeof TERMS_MONTHS)[number]),
  );
  const ageLimited = !isFullStandardSet || !usesOnlyStandardTerms;
  return { terms, ageLimited };
}

@Injectable()
export class SimulationsService {
  constructor(
    private prisma: PrismaService,
    private closing: ClosingPredictionService,
  ) {}

  /** PRICE: PMT = PV * (i * (1+i)^n) / ((1+i)^n - 1) */
  pricePmt(pv: number, monthlyRate: number, n: number): number {
    if (n <= 0 || pv <= 0) return 0;
    if (monthlyRate <= 0) return pv / n;
    const factor = Math.pow(1 + monthlyRate, n);
    return (pv * monthlyRate * factor) / (factor - 1);
  }

  round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  async listBanks() {
    const banks = await this.prisma.bank.findMany({ orderBy: { name: 'asc' } });
    return banks.map((b) => ({
      id: b.id,
      name: b.name,
      monthlyRate: Number(b.monthlyRate),
    }));
  }

  async compare(userId: string, role: UserRole, dto: CompareSimulationDto) {
    const income = dto.income;
    const propertyValue = dto.propertyValue;
    const downPayment = dto.downPayment;
    const grossFinanced = propertyValue - downPayment;

    if (dto.enforceMinDownPercent === true) {
      const minDown = this.round2(propertyValue * 0.1);
      if (downPayment + 1e-6 < minDown) {
        throw new BadRequestException(
          `Entrada mínima de 10% do valor do lote/imóvel: ${minDown.toFixed(2)} (LTV máximo 90%)`,
        );
      }
    }

    if (downPayment >= propertyValue) {
      throw new BadRequestException('A entrada deve ser menor que o valor do imóvel');
    }
    if (grossFinanced <= 0) {
      throw new BadRequestException('O valor financiado deve ser positivo');
    }

    const hasFGTS = dto.hasFGTS === true;
    const fgtsAmt = hasFGTS ? Math.max(0, dto.fgtsAmount ?? 0) : 0;
    const principal = this.round2(grossFinanced - fgtsAmt);
    if (principal <= 0) {
      throw new BadRequestException('O valor financiado após abatimento do FGTS deve ser positivo');
    }

    const depCount = dto.dependents ?? 0;
    const incomeLimitPct = depCount >= 3 ? 0.25 : 0.3;
    const maxInstallment = income * incomeLimitPct;

    const { terms: baseAllowedTerms, ageLimited } = buildAllowedTerms(dto.age);
    let allowedTerms = [...baseAllowedTerms];

    if (dto.chosenTermMonths != null) {
      const n = dto.chosenTermMonths;
      const maxByAge =
        dto.age != null ? Math.floor((80 - dto.age) * 12) : MAX_FINANCING_TERM_MONTHS;
      if (n < 12 || n > MAX_FINANCING_TERM_MONTHS) {
        throw new BadRequestException('Prazo deve estar entre 12 e 420 meses');
      }
      if (n > maxByAge) {
        throw new BadRequestException(
          `Prazo acima do limite pela idade (máx. ${maxByAge} meses respeitando 80 anos ao final)`,
        );
      }
      allowedTerms = [n];
    }

    const warnings: SimulationCompareWarnings = {
      ageReducedTerms: ageLimited,
      dependentsReducedInstallmentLimit: depCount >= 3,
      fgtsReducedPrincipal: hasFGTS && fgtsAmt > 0,
    };

    if (dto.clientId) {
      const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
      if (!client) throw new NotFoundException('Cliente não encontrado');
      if (role !== UserRole.ADMIN && client.brokerId !== userId) {
        throw new ForbiddenException('Sem permissão para este cliente');
      }
    }

    if (dto.propertyId) {
      const property = await this.prisma.property.findUnique({ where: { id: dto.propertyId } });
      if (!property) throw new NotFoundException('Imóvel não encontrado');
      if (role !== UserRole.ADMIN && property.userId !== userId) {
        throw new ForbiddenException('Sem permissão para este imóvel');
      }
    }

    if (dto.lotId) {
      const lot = await this.prisma.lot.findUnique({ where: { id: dto.lotId } });
      if (!lot) throw new NotFoundException('Lote não encontrado');
    }

    const banks = await this.prisma.bank.findMany({ orderBy: { name: 'asc' } });
    if (!banks.length) {
      throw new BadRequestException('Nenhum banco cadastrado. Execute o seed da base.');
    }

    const rows: SimulationOptionRow[] = [];

    for (const bank of banks) {
      const i = Number(bank.monthlyRate);
      for (const n of allowedTerms) {
        const rawInstallment = this.pricePmt(principal, i, n);
        const installment = this.round2(rawInstallment);
        const totalCost = this.round2(installment * n);
        const approved = installment <= maxInstallment + 1e-6;
        rows.push({
          bankId: bank.id,
          bankName: bank.name,
          monthlyRate: i,
          months: n,
          installment,
          totalCost,
          approved,
        });
      }
    }

    const ranked = [...rows].sort((a, b) => {
      if (a.approved !== b.approved) return a.approved ? -1 : 1;
      if (a.installment !== b.installment) return a.installment - b.installment;
      return a.totalCost - b.totalCost;
    });

    const bestOption = ranked.find((r) => r.approved) ?? null;
    const bestKey = bestOption ? `${bestOption.bankId}-${bestOption.months}` : null;

    const byBank = banks.map((bank) => ({
      bank: {
        id: bank.id,
        name: bank.name,
        monthlyRate: Number(bank.monthlyRate),
      },
      options: rows
        .filter((r) => r.bankId === bank.id)
        .sort((a, b) => a.months - b.months),
    }));

    if (dto.save) {
      const cpfDigits = dto.cpf.replace(/\D/g, '');
      await this.prisma.simulation.create({
        data: {
          userId,
          clientName: sanitizeInput(dto.clientName),
          cpf: cpfDigits,
          clientPhone: dto.clientPhone?.replace(/\D/g, '') || null,
          income: new Decimal(income),
          propertyValue: new Decimal(propertyValue),
          downPayment: new Decimal(downPayment),
          financedAmount: new Decimal(grossFinanced),
          age: dto.age ?? null,
          maritalStatus: dto.maritalStatus ?? null,
          dependents: depCount,
          hasFGTS,
          fgtsAmount: new Decimal(fgtsAmt),
          clientId: dto.clientId ?? null,
          propertyId: dto.propertyId ?? null,
          lotId: dto.lotId ?? null,
          metadata:
            dto.metadata === undefined ? undefined : (dto.metadata as Prisma.InputJsonValue),
        },
      });
      await this.closing.recalculateForClientLeads(dto.clientId ?? undefined);
    }

    const indexer: MortgageIndexer = dto.indexer ?? 'TR';
    const productLine: MortgageProductLine = dto.productLine ?? 'SBPE';
    const analysisMonths =
      dto.chosenTermMonths ??
      (allowedTerms.length ? Math.max(...allowedTerms) : 360);

    let mortgageAnalysis: Record<string, unknown> | undefined;
    if (dto.includeMortgageAnalysis === true && banks.length) {
      const lowestMonthly = Math.min(...banks.map((b) => Number(b.monthlyRate)));
      const adjustedMonthly = adjustMonthlyRate(lowestMonthly, indexer, productLine);
      const sac = sacSummary(principal, adjustedMonthly, analysisMonths);
      const price = priceSummary(principal, adjustedMonthly, analysisMonths);
      const maxInstallment = income * incomeLimitPct;
      mortgageAnalysis = {
        benchmarkBankMonthlyRate: lowestMonthly,
        adjustedMonthlyRate: adjustedMonthly,
        nominalAnnualPercent: nominalAnnualPercentLinear(adjustedMonthly),
        effectiveAnnualPercent: effectiveAnnualPercent(adjustedMonthly),
        cetApproxAnnualPercent: approximateCetAnnualPercent(adjustedMonthly),
        indexer,
        productLine,
        analysisMonths,
        principal,
        propertyValue,
        downPayment,
        maxLtvPercent: 90,
        maxTermMonths: MAX_FINANCING_TERM_MONTHS,
        incomeCommitmentMaxPercent: incomeLimitPct * 100,
        maxInstallmentAllowed: this.round2(maxInstallment),
        sac: {
          firstInstallment: sac.firstInstallment,
          lastInstallment: sac.lastInstallment,
          averageInstallment: sac.averageInstallment,
          totalPaid: sac.totalPaid,
          totalInterest: sac.totalInterest,
          amortizationFixed: sac.amortizationFixed,
          approved: sac.firstInstallment <= maxInstallment + 1e-6,
        },
        price: {
          installment: price.installment,
          firstInstallment: price.firstInstallment,
          lastInstallment: price.lastInstallment,
          totalPaid: price.totalPaid,
          totalInterest: price.totalInterest,
          approved: price.installment <= maxInstallment + 1e-6,
        },
      };
    }

    return {
      financedAmount: this.round2(grossFinanced),
      netFinancedAmount: this.round2(principal),
      installmentIncomeLimitPercent: incomeLimitPct === 0.25 ? 25 : 30,
      allowedTermsMonths: allowedTerms,
      warnings,
      ranked,
      bestKey,
      bestOption,
      byBank,
      mortgageAnalysis,
    };
  }

  async listMine(userId: string) {
    return this.prisma.simulation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        client: { select: { id: true, name: true } },
        property: { select: { id: true, title: true } },
        lot: {
          select: {
            id: true,
            number: true,
            block: { select: { name: true, development: { select: { id: true, name: true, city: true } } } },
          },
        },
      },
    });
  }
}
