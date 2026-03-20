import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CompareSimulationDto } from './dto/compare-simulation.dto';
import { sanitizeInput } from '../common/utils/xss.util';

const TERMS_MONTHS = [120, 180, 240, 360] as const;

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
    const capped = Math.min(maxMonths, 360);
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
  constructor(private prisma: PrismaService) {}

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

    const { terms: allowedTerms, ageLimited } = buildAllowedTerms(dto.age);

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
        },
      });
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
    };
  }
}
