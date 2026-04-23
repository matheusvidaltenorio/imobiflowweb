import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SocialConnectionStatus, SocialProvider, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SocialTokenCryptoService } from './social-token-crypto.service';

export type SocialConnectionSafe = {
  id: string;
  provider: SocialProvider;
  accountLabel: string | null;
  facebookPageId: string;
  facebookPageName: string | null;
  instagramUserId: string | null;
  instagramUsername: string | null;
  status: SocialConnectionStatus;
  tokenExpiresAt: Date | null;
  createdAt: Date;
  isDefault: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
  hasInstagramBusiness: boolean;
};

@Injectable()
export class SocialConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: SocialTokenCryptoService,
  ) {}

  toSafe(row: {
    id: string;
    provider: SocialProvider;
    accountLabel: string | null;
    facebookPageId: string;
    facebookPageName: string | null;
    instagramUserId: string | null;
    instagramUsername: string | null;
    status: SocialConnectionStatus;
    tokenExpiresAt: Date | null;
    createdAt: Date;
    isDefault: boolean;
    lastSyncAt: Date | null;
    lastError: string | null;
  }): SocialConnectionSafe {
    return {
      id: row.id,
      provider: row.provider,
      accountLabel: row.accountLabel,
      facebookPageId: row.facebookPageId,
      facebookPageName: row.facebookPageName,
      instagramUserId: row.instagramUserId,
      instagramUsername: row.instagramUsername,
      status: row.status,
      tokenExpiresAt: row.tokenExpiresAt,
      createdAt: row.createdAt,
      isDefault: row.isDefault,
      lastSyncAt: row.lastSyncAt,
      lastError: row.lastError ? row.lastError.slice(0, 500) : null,
      hasInstagramBusiness: !!row.instagramUserId?.trim(),
    };
  }

  async list(userId: string, role: UserRole): Promise<SocialConnectionSafe[]> {
    const where: Prisma.SocialConnectionWhereInput =
      role === UserRole.ADMIN
        ? {}
        : {
            OR: [{ userId }, { user: { role: UserRole.ADMIN } }],
          };
    const rows = await this.prisma.socialConnection.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return rows.map((r) => this.toSafe(r));
  }

  async assertOwner(userId: string, role: UserRole, id: string) {
    const row = await this.prisma.socialConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conexão não encontrada');
    if (role !== UserRole.ADMIN && row.userId !== userId) {
      throw new ForbiddenException('Conexão de outro usuário');
    }
    return row;
  }

  /**
   * Corretor pode usar conexões criadas por administrador para publicar (OAuth restrito a admin).
   */
  async assertPublishAccess(userId: string, role: UserRole, id: string) {
    const row = await this.prisma.socialConnection.findUnique({
      where: { id },
      include: { user: { select: { role: true } } },
    });
    if (!row) throw new NotFoundException('Conexão não encontrada');
    if (role === UserRole.ADMIN) return row;
    if (row.userId === userId) return row;
    if (role === UserRole.CORRETOR && row.user.role === UserRole.ADMIN) return row;
    throw new ForbiddenException('Sem permissão para usar esta conexão Meta');
  }

  async delete(userId: string, role: UserRole, id: string) {
    await this.assertOwner(userId, role, id);
    await this.prisma.socialConnection.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Define a página padrão para publicação (uma por usuário).
   */
  async setDefaultConnection(userId: string, role: UserRole, connectionId: string) {
    const row = await this.assertOwner(userId, role, connectionId);
    await this.prisma.$transaction([
      this.prisma.socialConnection.updateMany({
        where: { userId: row.userId },
        data: { isDefault: false },
      }),
      this.prisma.socialConnection.update({
        where: { id: connectionId },
        data: { isDefault: true },
      }),
    ]);
    return this.list(userId, role);
  }

  /**
   * Se só existir uma conexão, marca como padrão.
   */
  async ensureDefaultIfSingle(userId: string) {
    const count = await this.prisma.socialConnection.count({ where: { userId } });
    if (count !== 1) return;
    const only = await this.prisma.socialConnection.findFirst({ where: { userId } });
    if (only && !only.isDefault) {
      await this.prisma.socialConnection.update({
        where: { id: only.id },
        data: { isDefault: true },
      });
    }
  }

  /** Resolve qual conexão usar na publicação (padrão ou explícita). */
  async resolveConnectionIdForPublishing(
    userId: string,
    role: UserRole,
    explicitConnectionId?: string,
  ): Promise<string> {
    if (explicitConnectionId?.trim()) {
      const row = await this.assertPublishAccess(userId, role, explicitConnectionId.trim());
      return row.id;
    }
    const active = SocialConnectionStatus.ACTIVE;
    const ownDef = await this.prisma.socialConnection.findFirst({
      where: { userId, status: active, isDefault: true },
    });
    if (ownDef) return ownDef.id;
    const ownAny = await this.prisma.socialConnection.findFirst({
      where: { userId, status: active },
      orderBy: { updatedAt: 'desc' },
    });
    if (ownAny) return ownAny.id;

    if (role === UserRole.CORRETOR) {
      const adminDef = await this.prisma.socialConnection.findFirst({
        where: { status: active, isDefault: true, user: { role: UserRole.ADMIN } },
        orderBy: { updatedAt: 'desc' },
      });
      if (adminDef) return adminDef.id;
      const adminAny = await this.prisma.socialConnection.findFirst({
        where: { status: active, user: { role: UserRole.ADMIN } },
        orderBy: { updatedAt: 'desc' },
      });
      if (adminAny) return adminAny.id;
    }

    throw new BadRequestException(
      'Nenhuma página Meta conectada. Peça a um administrador para conectar em Integrações e definir uma página padrão.',
    );
  }

  /** Token de página descriptografado — apenas uso interno (publicação). */
  async getDecryptedPageToken(userId: string, role: UserRole, connectionId: string): Promise<{
    pageAccessToken: string;
    facebookPageId: string;
    instagramUserId: string | null;
  }> {
    const row = await this.assertPublishAccess(userId, role, connectionId);
    if (row.status !== SocialConnectionStatus.ACTIVE) {
      throw new ForbiddenException('Conexão inativa ou revogada. Reconecte a conta Meta.');
    }
    const pageAccessToken = this.crypto.decrypt(row.accessTokenEnc);
    return {
      pageAccessToken,
      facebookPageId: row.facebookPageId,
      instagramUserId: row.instagramUserId,
    };
  }

  async upsertPageConnection(opts: {
    userId: string;
    facebookPageId: string;
    facebookPageName: string | null;
    instagramUserId: string | null;
    instagramUsername: string | null;
    pageAccessToken: string;
    expiresAt: Date | null;
    grantedScopes?: string | null;
  }) {
    const enc = this.crypto.encrypt(opts.pageAccessToken);
    const now = new Date();
    return this.prisma.socialConnection.upsert({
      where: {
        userId_facebookPageId: { userId: opts.userId, facebookPageId: opts.facebookPageId },
      },
      create: {
        userId: opts.userId,
        provider: SocialProvider.META_PAGE,
        accountLabel: opts.facebookPageName ?? opts.facebookPageId,
        facebookPageId: opts.facebookPageId,
        facebookPageName: opts.facebookPageName,
        instagramUserId: opts.instagramUserId,
        instagramUsername: opts.instagramUsername,
        accessTokenEnc: enc,
        tokenExpiresAt: opts.expiresAt,
        status: SocialConnectionStatus.ACTIVE,
        lastSyncAt: now,
        lastError: null,
        grantedScopes: opts.grantedScopes ?? null,
      },
      update: {
        facebookPageName: opts.facebookPageName,
        instagramUserId: opts.instagramUserId,
        instagramUsername: opts.instagramUsername,
        accessTokenEnc: enc,
        tokenExpiresAt: opts.expiresAt,
        status: SocialConnectionStatus.ACTIVE,
        lastSyncAt: now,
        lastError: null,
        grantedScopes: opts.grantedScopes ?? undefined,
      },
    });
  }
}
