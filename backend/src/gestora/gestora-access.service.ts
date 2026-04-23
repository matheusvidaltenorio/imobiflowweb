import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  GestoraPublishMode,
  GestoraSubmissionStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ManagerAccessRow = {
  id: string;
  userId: string;
  developmentId: string;
  permissions: Prisma.JsonValue | null;
  spreadsheetImportEnabled: boolean;
  assistedImageEnabled: boolean;
  publishMode: GestoraPublishMode;
};

@Injectable()
export class GestoraAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<
    Array<
      ManagerAccessRow & {
        development: { id: string; name: string; city: string };
      }
    >
  > {
    return this.prisma.managerDevelopmentAccess.findMany({
      where: { userId },
      include: { development: { select: { id: true, name: true, city: true } } },
      orderBy: { development: { name: 'asc' } },
    });
  }

  async requireGestora(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!u || u.role !== UserRole.GESTORA) {
      throw new ForbiddenException('Acesso exclusivo da gestora');
    }
  }

  async assertCanAccessDevelopment(userId: string, role: UserRole, developmentId: string) {
    if (role === UserRole.ADMIN) return;
    if (role !== UserRole.GESTORA) {
      throw new ForbiddenException('Sem permissão para este loteamento');
    }
    const row = await this.prisma.managerDevelopmentAccess.findUnique({
      where: { userId_developmentId: { userId, developmentId } },
    });
    if (!row) throw new ForbiddenException('Loteamento não autorizado para esta gestora');
  }

  async getAccess(userId: string, developmentId: string): Promise<ManagerAccessRow | null> {
    return this.prisma.managerDevelopmentAccess.findUnique({
      where: { userId_developmentId: { userId, developmentId } },
    });
  }

  submissionStatusForNewSnapshot(publishMode: GestoraPublishMode): GestoraSubmissionStatus | null {
    return publishMode === GestoraPublishMode.PENDING_REVIEW ? GestoraSubmissionStatus.PENDING_APPROVAL : null;
  }

  // --- Admin CRUD ---

  async adminList(filters: { userId?: string; developmentId?: string }) {
    return this.prisma.managerDevelopmentAccess.findMany({
      where: {
        userId: filters.userId,
        developmentId: filters.developmentId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        development: { select: { id: true, name: true, city: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async adminCreate(data: {
    userId: string;
    developmentId: string;
    spreadsheetImportEnabled?: boolean;
    assistedImageEnabled?: boolean;
    publishMode?: GestoraPublishMode;
    permissions?: Prisma.InputJsonValue;
  }) {
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user || user.role !== UserRole.GESTORA) {
      throw new NotFoundException('Usuário gestora não encontrado ou perfil inválido');
    }
    const dev = await this.prisma.development.findUnique({ where: { id: data.developmentId } });
    if (!dev) throw new NotFoundException('Loteamento não encontrado');
    return this.prisma.managerDevelopmentAccess.create({
      data: {
        userId: data.userId,
        developmentId: data.developmentId,
        spreadsheetImportEnabled: data.spreadsheetImportEnabled ?? true,
        assistedImageEnabled: data.assistedImageEnabled ?? true,
        publishMode: data.publishMode ?? GestoraPublishMode.IMMEDIATE,
        permissions: data.permissions,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        development: { select: { id: true, name: true, city: true } },
      },
    });
  }

  async adminUpdate(
    id: string,
    body: {
      spreadsheetImportEnabled?: boolean;
      assistedImageEnabled?: boolean;
      publishMode?: GestoraPublishMode;
      permissions?: Prisma.InputJsonValue | null;
    },
  ) {
    const row = await this.prisma.managerDevelopmentAccess.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Vínculo não encontrado');
    const data: Prisma.ManagerDevelopmentAccessUpdateInput = {
      spreadsheetImportEnabled: body.spreadsheetImportEnabled,
      assistedImageEnabled: body.assistedImageEnabled,
      publishMode: body.publishMode,
    };
    if (body.permissions !== undefined) {
      data.permissions = body.permissions as Prisma.InputJsonValue;
    }
    return this.prisma.managerDevelopmentAccess.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        development: { select: { id: true, name: true, city: true } },
      },
    });
  }

  async adminDelete(id: string) {
    const row = await this.prisma.managerDevelopmentAccess.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Vínculo não encontrado');
    await this.prisma.managerDevelopmentAccess.delete({ where: { id } });
    return { ok: true };
  }
}
