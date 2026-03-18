import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class InstallmentsService {
  constructor(private prisma: PrismaService) {}

  async payInstallment(id: string, userId: string) {
    const installment = await this.prisma.installment.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!installment) throw new NotFoundException('Parcela não encontrada');
    if (installment.payment.userId !== userId) throw new ForbiddenException('Sem permissão');

    return this.prisma.installment.update({
      where: { id },
      data: { status: PaymentStatus.PAGO, paidAt: new Date() },
    });
  }

  async findByPayment(paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { installments: true },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    if (payment.userId !== userId) throw new ForbiddenException('Sem permissão');
    return payment.installments;
  }
}
