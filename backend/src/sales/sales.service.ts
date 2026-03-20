import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractStatus,
  LeadStatus,
  PaymentStatus,
  PropertyStatus,
  SaleStatus,
  UserRole,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

function splitInstallments(total: number, count: number): number[] {
  if (count < 1) return [];
  const cents = Math.round(total * 100);
  const baseCents = Math.floor(cents / count);
  const remainder = cents - baseCents * count;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const extra = i < remainder ? 1 : 0;
    out.push((baseCents + extra) / 100);
  }
  return out;
}

function buildDueDates(months: number, soldAt: Date): Date[] {
  const first = new Date(soldAt);
  first.setDate(first.getDate() + 30);
  first.setHours(12, 0, 0, 0);
  const dates: Date[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(first);
    d.setMonth(d.getMonth() + i);
    dates.push(d);
  }
  return dates;
}

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async confirmFromContract(contractId: string, userId: string, role: UserRole) {
    return this.prisma.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({
        where: { id: contractId },
        include: {
          proposal: true,
          sale: true,
          client: { select: { name: true } },
          property: { select: { title: true } },
        },
      });

      if (!contract) throw new NotFoundException('Contrato não encontrado');
      if (role !== UserRole.ADMIN && contract.userId !== userId) {
        throw new ForbiddenException('Sem permissão');
      }
      if (contract.sale) {
        throw new ConflictException('Venda já confirmada para este contrato');
      }
      if (contract.status === ContractStatus.CANCELLED) {
        throw new BadRequestException('Contrato cancelado não pode gerar venda');
      }
      if (contract.status !== ContractStatus.READY && contract.status !== ContractStatus.DRAFT) {
        throw new BadRequestException('Contrato deve estar em elaboração (DRAFT/READY) para confirmar venda');
      }

      const financed = Number(contract.financedAmount);
      const months = contract.months;
      if (months < 1 || financed <= 0) {
        throw new BadRequestException('Dados financeiros inválidos para gerar parcelas');
      }

      const soldAt = new Date();
      const amounts = splitInstallments(financed, months);
      const dueDates = buildDueDates(months, soldAt);
      const totalAmount = amounts.reduce((a, b) => a + b, 0);

      const clientName = contract.client?.name ?? 'Cliente';
      const propTitle = contract.property?.title ?? 'Imóvel';
      const description = `Financiamento — ${clientName} — ${propTitle}`;

      const sale = await tx.sale.create({
        data: {
          contractId: contract.id,
          proposalId: contract.proposalId,
          userId: contract.userId,
          clientId: contract.clientId,
          propertyId: contract.propertyId,
          totalValue: contract.totalValue,
          downPayment: contract.downPayment,
          financedAmount: contract.financedAmount,
          bankName: contract.bankName,
          installmentValue: contract.installmentValue,
          months,
          status: SaleStatus.CONFIRMED,
          soldAt,
        },
      });

      await tx.payment.create({
        data: {
          userId: contract.userId,
          description,
          totalAmount: new Decimal(Math.round(totalAmount * 100) / 100),
          status: PaymentStatus.PENDENTE,
          dueDate: dueDates[0],
          saleId: sale.id,
          installments: {
            create: amounts.map((amount, i) => ({
              amount: new Decimal(amount),
              dueDate: dueDates[i],
              status: PaymentStatus.PENDENTE,
            })),
          },
        },
      });

      await tx.contract.update({
        where: { id: contractId },
        data: { status: ContractStatus.SIGNED },
      });

      if (contract.propertyId) {
        await tx.property.update({
          where: { id: contract.propertyId },
          data: { status: PropertyStatus.VENDIDO },
        });
      }

      if (contract.clientId && contract.propertyId) {
        await tx.lead.updateMany({
          where: {
            propertyId: contract.propertyId,
            clientId: contract.clientId,
            status: { not: LeadStatus.PERDIDO },
          },
          data: { status: LeadStatus.VENDIDO },
        });
      }

      return tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          contract: { select: { id: true, status: true } },
          proposal: { select: { id: true, status: true } },
          client: { select: { id: true, name: true, email: true } },
          property: { select: { id: true, title: true } },
          payment: { include: { installments: true } },
        },
      });
    });
  }
}
