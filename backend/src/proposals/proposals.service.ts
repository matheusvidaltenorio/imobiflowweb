import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProposalStatus, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalLinksDto } from './dto/update-proposal-links.dto';
import { sanitizeInput } from '../common/utils/xss.util';

@Injectable()
export class ProposalsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, role: UserRole, dto: CreateProposalDto) {
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

    return this.prisma.proposal.create({
      data: {
        userId,
        clientId: dto.clientId ?? null,
        propertyId: dto.propertyId ?? null,
        bank: sanitizeInput(dto.bank),
        installment: new Decimal(dto.installment),
        months: dto.months,
        downPayment: new Decimal(dto.downPayment),
        status: ProposalStatus.PENDING,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        property: { select: { id: true, title: true } },
        contract: { select: { id: true, status: true } },
        sale: { select: { id: true, status: true } },
      },
    });
  }

  async findAllForUser(userId: string, isAdmin: boolean) {
    return this.prisma.proposal.findMany({
      where: isAdmin ? {} : { userId },
      include: {
        client: { select: { id: true, name: true, email: true } },
        property: { select: { id: true, title: true } },
        contract: { select: { id: true, status: true } },
        sale: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Associa cliente e/ou imóvel cadastrados a uma proposta ainda sem contrato (ex.: proposta criada na simulação sem clientId).
   */
  async updateProposalLinks(id: string, userId: string, role: UserRole, dto: UpdateProposalLinksDto) {
    if (dto.clientId === undefined && dto.propertyId === undefined) {
      throw new BadRequestException('Informe clientId e/ou propertyId');
    }

    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: { contract: { select: { id: true } } },
    });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    if (role !== UserRole.ADMIN && proposal.userId !== userId) {
      throw new ForbiddenException('Sem permissão');
    }
    if (proposal.contract) {
      throw new BadRequestException('Não é possível alterar vínculos após o contrato ser gerado');
    }

    const data: {
      clientId?: string | null;
      propertyId?: string | null;
    } = {};

    if (dto.clientId !== undefined) {
      const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
      if (!client) throw new NotFoundException('Cliente não encontrado');
      if (role !== UserRole.ADMIN && client.brokerId !== userId) {
        throw new ForbiddenException('Sem permissão para este cliente');
      }
      data.clientId = dto.clientId;
    }

    if (dto.propertyId !== undefined) {
      const property = await this.prisma.property.findUnique({ where: { id: dto.propertyId } });
      if (!property) throw new NotFoundException('Imóvel não encontrado');
      if (role !== UserRole.ADMIN && property.userId !== userId) {
        throw new ForbiddenException('Sem permissão para este imóvel');
      }
      data.propertyId = dto.propertyId;
    }

    return this.prisma.proposal.update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, name: true, email: true } },
        property: { select: { id: true, title: true } },
        contract: { select: { id: true, status: true } },
        sale: { select: { id: true, status: true } },
      },
    });
  }

  async updateStatus(id: string, userId: string, role: UserRole, status: ProposalStatus) {
    const proposal = await this.prisma.proposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    if (role !== UserRole.ADMIN && proposal.userId !== userId) {
      throw new ForbiddenException('Sem permissão');
    }

    return this.prisma.proposal.update({
      where: { id },
      data: { status },
      include: {
        client: { select: { id: true, name: true, email: true } },
        property: { select: { id: true, title: true } },
        contract: { select: { id: true, status: true } },
        sale: { select: { id: true, status: true } },
      },
    });
  }
}
