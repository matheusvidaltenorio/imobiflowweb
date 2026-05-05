import {
  ContractStatus,
  PaymentStatus,
  PrismaClient,
  ProposalStatus,
  SaleStatus,
} from '@prisma/client';
import type { HomologSeedContext } from './types';
import { HOMOLOG_SOURCE } from './types';

export async function seedHomologFinance(prisma: PrismaClient, ctx: HomologSeedContext): Promise<void> {
  console.log('[homolog] financeiro — simulações, propostas, contratos, vendas, pagamentos…');

  const broker = ctx.brokers[0]!;
  const bank = await prisma.bank.findFirst({ orderBy: { name: 'asc' } });
  if (!bank) throw new Error('[homolog] Nenhum banco no seed — impossível simulações.');

  const prop = await prisma.property.findFirst({
    where: { userId: broker.id, title: { contains: HOMOLOG_SOURCE } },
    select: { id: true, price: true },
  });
  if (!prop) throw new Error('[homolog] Property homolog não encontrada.');

  const client = ctx.crmClients[0]!;
  const lot = await prisma.lot.findFirst({
    where: { block: { developmentId: ctx.vistaVerdeId } },
    select: { id: true },
  });

  /** Simulações */
  for (let i = 0; i < 6; i += 1) {
    const cpf = `${String(10000000000 + i).padStart(11, '0').slice(0, 11)}`;
    const exists = await prisma.simulation.findFirst({
      where: { userId: broker.id, clientName: `Simulação Homolog ${i + 1}` },
    });
    if (exists) continue;
    await prisma.simulation.create({
      data: {
        userId: broker.id,
        clientName: `Simulação Homolog ${i + 1}`,
        cpf,
        clientPhone: `1194004${String(i).padStart(4, '0')}`,
        income: 8500 + i * 400,
        propertyValue: 180000 + i * 10000,
        downPayment: 36000 + i * 2000,
        financedAmount: 144000 + i * 8000,
        age: 32 + i,
        maritalStatus: i % 2 === 0 ? 'CASADO' : 'SOLTEIRO',
        dependents: i % 3,
        hasFGTS: i % 2 === 0,
        fgtsAmount: i % 2 === 0 ? 12000 : 0,
        clientId: ctx.crmClients[i % ctx.crmClients.length]!.id,
        propertyId: prop.id,
        lotId: lot?.id,
        metadata: { homologKey: `sim_${i}`, source: HOMOLOG_SOURCE } as object,
      },
    });
  }

  /** Propostas: pendente, rejeitada, aceita+contrato rascunho, aceita+venda completa */
  const scenarios: Array<{ key: string; status: ProposalStatus }> = [
    { key: 'p1', status: ProposalStatus.PENDING },
    { key: 'p2', status: ProposalStatus.PENDING },
    { key: 'p3', status: ProposalStatus.REJECTED },
    { key: 'p4', status: ProposalStatus.REJECTED },
  ];

  for (let si = 0; si < scenarios.length; si += 1) {
    const s = scenarios[si]!;
    const exists = await prisma.proposal.findFirst({
      where: { userId: broker.id, bank: `${HOMOLOG_SOURCE}_${s.key}` },
    });
    if (exists) continue;
    await prisma.proposal.create({
      data: {
        userId: broker.id,
        clientId: client.id,
        propertyId: prop.id,
        bank: `${HOMOLOG_SOURCE}_${s.key}`,
        installment: 2100 + si * 50,
        months: 360,
        downPayment: 45000,
        status: s.status,
      },
    });
  }

  /** Aceita + contrato DRAFT */
  let pDraft = await prisma.proposal.findFirst({
    where: { userId: broker.id, bank: `${HOMOLOG_SOURCE}_draft` },
  });
  if (!pDraft) {
    pDraft = await prisma.proposal.create({
      data: {
        userId: broker.id,
        clientId: client.id,
        propertyId: prop.id,
        bank: `${HOMOLOG_SOURCE}_draft`,
        installment: 1950,
        months: 300,
        downPayment: 50000,
        status: ProposalStatus.ACCEPTED,
      },
    });
  }
  if (!pDraft) throw new Error('proposal draft');
  const cDraftExists = await prisma.contract.findUnique({ where: { proposalId: pDraft.id } });
  if (!cDraftExists) {
    await prisma.contract.create({
      data: {
        proposalId: pDraft.id,
        userId: broker.id,
        clientId: client.id,
        propertyId: prop.id,
        totalValue: 850000,
        downPayment: 50000,
        financedAmount: 800000,
        bankName: bank.name,
        installmentValue: 1950,
        months: 300,
        contractText: `Contrato homologação (${HOMOLOG_SOURCE}) — rascunho para revisão jurídica.`,
        clientCpf: '12345678901',
        status: ContractStatus.DRAFT,
      },
    });
  }

  /** Aceita + contrato assinado + venda + pagamento + parcelas */
  let pSale = await prisma.proposal.findFirst({
    where: { userId: broker.id, bank: `${HOMOLOG_SOURCE}_sale_path` },
  });
  if (!pSale) {
    pSale = await prisma.proposal.create({
      data: {
        userId: broker.id,
        clientId: client.id,
        propertyId: prop.id,
        bank: `${HOMOLOG_SOURCE}_sale_path`,
        installment: 2200,
        months: 360,
        downPayment: 48000,
        status: ProposalStatus.ACCEPTED,
      },
    });
  }
  if (!pSale) throw new Error('proposal sale');

  let contract = await prisma.contract.findUnique({ where: { proposalId: pSale.id } });
  if (!contract) {
    contract = await prisma.contract.create({
      data: {
        proposalId: pSale.id,
        userId: broker.id,
        clientId: client.id,
        propertyId: prop.id,
        totalValue: 850000,
        downPayment: 48000,
        financedAmount: 802000,
        bankName: bank.name,
        installmentValue: 2200,
        months: 360,
        contractText: `Contrato homologação (${HOMOLOG_SOURCE}) — assinado (simulado).`,
        clientCpf: '10987654321',
        status: ContractStatus.SIGNED,
      },
    });
  }

  let sale = await prisma.sale.findFirst({ where: { proposalId: pSale.id } });
  if (!sale) {
    sale = await prisma.sale.create({
      data: {
        contractId: contract.id,
        proposalId: pSale.id,
        userId: broker.id,
        clientId: client.id,
        propertyId: prop.id,
        totalValue: contract.totalValue,
        downPayment: contract.downPayment,
        financedAmount: contract.financedAmount,
        bankName: contract.bankName,
        installmentValue: contract.installmentValue,
        months: contract.months,
        status: SaleStatus.CONFIRMED,
        soldAt: new Date(),
      },
    });
  }

  const payMarker = `${HOMOLOG_SOURCE}_payment_sale`;
  let payment = await prisma.payment.findFirst({
    where: { userId: broker.id, description: payMarker },
    include: { installments: true },
  });
  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        userId: broker.id,
        description: payMarker,
        totalAmount: 6600,
        status: PaymentStatus.PENDENTE,
        saleId: sale.id,
        dueDate: new Date(),
      },
      include: { installments: true },
    });
    const base = new Date();
    await prisma.installment.createMany({
      data: [
        {
          paymentId: payment.id,
          amount: 2200,
          dueDate: new Date(base.getFullYear(), base.getMonth(), 5),
          status: PaymentStatus.PAGO,
          paidAt: new Date(base.getFullYear(), base.getMonth(), 4),
        },
        {
          paymentId: payment.id,
          amount: 2200,
          dueDate: new Date(base.getFullYear(), base.getMonth() + 1, 5),
          status: PaymentStatus.PENDENTE,
        },
        {
          paymentId: payment.id,
          amount: 2200,
          dueDate: new Date(base.getFullYear(), base.getMonth() - 1, 5),
          status: PaymentStatus.ATRASADO,
        },
      ],
    });
  }
}
