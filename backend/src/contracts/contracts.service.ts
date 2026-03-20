import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractStatus, ProposalStatus, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeInput } from '../common/utils/xss.util';

function formatBrl(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function formatDatePt(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  private buildContractText(params: {
    clientName: string;
    clientCpf: string | null;
    clientEmail: string;
    propertyTitle: string | null;
    propertyAddress: string | null;
    totalValue: number;
    downPayment: number;
    financedAmount: number;
    bankName: string;
    installmentValue: number;
    months: number;
    brokerName: string;
    contractDate: Date;
  }): string {
    const lines = [
      'CONTRATO DE PROMESSA DE COMPRA E VENDA / FINANCIAMENTO (MINUTA)',
      '',
      `Data: ${formatDatePt(params.contractDate)}`,
      '',
      '1. PARTES',
      `Comprador(a): ${sanitizeInput(params.clientName)}`,
      params.clientCpf ? `CPF: ${sanitizeInput(params.clientCpf)}` : 'CPF: (não informado no cadastro — complementar antes da assinatura)',
      `E-mail: ${sanitizeInput(params.clientEmail)}`,
      '',
      `Corretor(a) responsável: ${sanitizeInput(params.brokerName)} (ImobiFlow)`,
      '',
      '2. OBJETO',
      params.propertyTitle
        ? `Imóvel: ${sanitizeInput(params.propertyTitle)}`
        : 'Imóvel: (sem vínculo a imóvel cadastrado — descrever no instrumento definitivo)',
      params.propertyAddress ? `Localização resumida: ${sanitizeInput(params.propertyAddress)}` : '',
      '',
      '3. VALORES E CONDIÇÕES FINANCEIRAS',
      `Valor total de referência: ${formatBrl(params.totalValue)}`,
      `Entrada acordada: ${formatBrl(params.downPayment)}`,
      `Valor financiado (referência): ${formatBrl(params.financedAmount)}`,
      `Instituição financeira indicada: ${sanitizeInput(params.bankName)}`,
      `Parcela estimada: ${formatBrl(params.installmentValue)}`,
      `Prazo: ${params.months} meses`,
      '',
      '4. DECLARAÇÃO',
      'As partes reconhecem que a presente minuta resume condições comerciais preliminares após aceite da proposta,',
      'não substituindo o contrato definitivo perante o banco e o instrumento de compra e venda cartorário.',
      '',
      '5. DISPOSIÇÕES GERAIS',
      'O presente documento poderá ser alterado até a assinatura da versão final. Cláusulas adicionais serão pactuadas',
      'no instrumento definitivo, em conformidade com a legislação vigente.',
      '',
      '______________________________',
      'Assinatura do comprador',
      '',
      '______________________________',
      'Assinatura do corretor',
    ].filter(Boolean);
    return lines.join('\n');
  }

  async createFromProposal(proposalId: string, userId: string, role: UserRole) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        client: true,
        property: true,
        contract: true,
        user: { select: { name: true } },
      },
    });

    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    if (role !== UserRole.ADMIN && proposal.userId !== userId) {
      throw new ForbiddenException('Sem permissão');
    }
    if (proposal.status !== ProposalStatus.ACCEPTED) {
      throw new BadRequestException('Apenas propostas aceitas podem gerar contrato');
    }
    if (proposal.contract) {
      return this.prisma.contract.findUniqueOrThrow({
        where: { id: proposal.contract.id },
        include: {
          proposal: { select: { id: true, status: true } },
          client: { select: { id: true, name: true, email: true, phone: true } },
          property: { select: { id: true, title: true, price: true, city: true } },
          sale: { select: { id: true, status: true, soldAt: true } },
        },
      });
    }

    if (!proposal.clientId || !proposal.client) {
      throw new BadRequestException('Proposta precisa ter cliente cadastrado para gerar contrato');
    }

    const property = proposal.propertyId
      ? await this.prisma.property.findUnique({ where: { id: proposal.propertyId } })
      : null;
    if (proposal.propertyId && !property) {
      throw new NotFoundException('Imóvel da proposta não encontrado');
    }
    if (role !== UserRole.ADMIN && property && property.userId !== userId) {
      throw new ForbiddenException('Sem permissão para o imóvel desta proposta');
    }

    const down = Number(proposal.downPayment);
    const installmentVal = Number(proposal.installment);
    const months = proposal.months;

    let totalValue: number;
    let financedAmount: number;
    if (property) {
      totalValue = Number(property.price);
      financedAmount = Math.max(0, Math.round((totalValue - down) * 100) / 100);
    } else {
      financedAmount = Math.max(0, Math.round((installmentVal * months) * 100) / 100);
      totalValue = Math.round((down + financedAmount) * 100) / 100;
    }

    const sim = await this.prisma.simulation.findFirst({
      where: {
        userId: proposal.userId,
        clientId: proposal.clientId,
        ...(proposal.propertyId ? { propertyId: proposal.propertyId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    const clientCpf = sim?.cpf ? sim.cpf.replace(/\D/g, '') : null;

    const propertyAddress = property
      ? [property.street, property.number, property.neighborhood, property.city].filter(Boolean).join(', ')
      : null;

    const contractText = this.buildContractText({
      clientName: proposal.client.name,
      clientCpf,
      clientEmail: proposal.client.email,
      propertyTitle: property?.title ?? null,
      propertyAddress,
      totalValue,
      downPayment: down,
      financedAmount,
      bankName: proposal.bank,
      installmentValue: installmentVal,
      months,
      brokerName: proposal.user.name,
      contractDate: new Date(),
    });

    return this.prisma.contract.create({
      data: {
        proposalId: proposal.id,
        userId: proposal.userId,
        clientId: proposal.clientId,
        propertyId: proposal.propertyId,
        totalValue: new Decimal(totalValue),
        downPayment: new Decimal(down),
        financedAmount: new Decimal(financedAmount),
        bankName: sanitizeInput(proposal.bank),
        installmentValue: new Decimal(installmentVal),
        months,
        contractText,
        clientCpf,
        status: ContractStatus.READY,
      },
      include: {
        proposal: { select: { id: true, status: true } },
        client: { select: { id: true, name: true, email: true, phone: true } },
        property: { select: { id: true, title: true, price: true, city: true } },
        sale: { select: { id: true, status: true } },
      },
    });
  }

  async findAllForUser(userId: string, isAdmin: boolean) {
    return this.prisma.contract.findMany({
      where: isAdmin ? {} : { userId },
      include: {
        proposal: { select: { id: true, status: true } },
        client: { select: { id: true, name: true, email: true } },
        property: { select: { id: true, title: true } },
        sale: { select: { id: true, status: true, soldAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId: string, role: UserRole) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        proposal: { select: { id: true, status: true } },
        client: { select: { id: true, name: true, email: true, phone: true } },
        property: { select: { id: true, title: true, price: true, city: true, status: true } },
        sale: {
          select: {
            id: true,
            status: true,
            soldAt: true,
            payment: { include: { installments: true } },
          },
        },
        user: { select: { id: true, name: true } },
      },
    });
    if (!contract) throw new NotFoundException('Contrato não encontrado');
    if (role !== UserRole.ADMIN && contract.userId !== userId) {
      throw new ForbiddenException('Sem permissão');
    }
    return contract;
  }

  async updateStatus(id: string, userId: string, role: UserRole, status: ContractStatus) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { sale: true },
    });
    if (!contract) throw new NotFoundException('Contrato não encontrado');
    if (role !== UserRole.ADMIN && contract.userId !== userId) {
      throw new ForbiddenException('Sem permissão');
    }
    if (contract.sale && status === ContractStatus.CANCELLED) {
      throw new ConflictException('Não é possível cancelar contrato após venda confirmada');
    }

    return this.prisma.contract.update({
      where: { id },
      data: { status },
      include: {
        proposal: { select: { id: true, status: true } },
        client: { select: { id: true, name: true, email: true } },
        property: { select: { id: true, title: true } },
        sale: { select: { id: true, status: true } },
      },
    });
  }
}
