import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    data: {
      description: string;
      totalAmount: number;
      dueDate?: Date;
      installments: { amount: number; dueDate: Date }[];
    },
  ) {
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        description: data.description,
        totalAmount: new Decimal(data.totalAmount),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        installments: {
          create: data.installments.map((i) => ({
            amount: new Decimal(i.amount),
            dueDate: new Date(i.dueDate),
          })),
        },
      },
      include: { installments: true },
    });

    return payment;
  }

  async findAllByUser(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      include: {
        installments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { installments: true },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    if (payment.userId !== userId) throw new ForbiddenException('Sem permissão');
    return payment;
  }

  async updateStatus(id: string, userId: string, status: PaymentStatus) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    if (payment.userId !== userId) throw new ForbiddenException('Sem permissão');

    return this.prisma.payment.update({
      where: { id },
      data: { status },
      include: { installments: true },
    });
  }

  async delete(id: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    if (payment.userId !== userId) throw new ForbiddenException('Sem permissão');

    await this.prisma.payment.delete({ where: { id } });
    return { message: 'Pagamento removido' };
  }
}
