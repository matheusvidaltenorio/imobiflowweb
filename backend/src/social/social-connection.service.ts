import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SocialConnectionStatus, SocialProvider, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SocialTokenCryptoService } from './social-token-crypto.service';

/** Um registro “placeholder” quando só há login OAuth basic (sem pages_show_list). */
export const META_BASIC_USER_SENTINEL_PAGE_ID = '__IMOBFLOW_META_BASIC_USER__';

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
  /** Conexão só com escopo público (ex.: public_profile), sem página para publicação. */
  isMetaBasicOnly: boolean;
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
    const basicOnly = row.status === SocialConnectionStatus.META_BASIC_CONNECTED;
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
      isMetaBasicOnly: basicOnly,
    };
  }

  async list(userId: string, _role: UserRole): Promise<SocialConnectionSafe[]> {
    const rows = await this.prisma.socialConnection.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return rows.map((r) => this.toSafe(r));
  }

  async assertOwner(userId: string, _role: UserRole, id: string) {
    const row = await this.prisma.socialConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conexão não encontrada');
    if (row.userId !== userId) {
      throw new ForbiddenException('Conexão de outro usuário');
    }
    return row;
  }

  /** Publicação e escolha de conexão: só o dono do registro (cada usuário conecta a própria Meta). */
  async assertPublishAccess(userId: string, _role: UserRole, id: string) {
    const row = await this.prisma.socialConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conexão não encontrada');
    if (row.userId !== userId) {
      throw new ForbiddenException('Sem permissão para usar esta conexão Meta');
    }
    return row;
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
    if (row.status === SocialConnectionStatus.META_BASIC_CONNECTED) {
      throw new BadRequestException(
        'Primeiro conceda permissões de páginas/publicação para escolher uma página padrão.',
      );
    }
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
   * Se só existir uma conexão publicável (ACTIVE), marca como padrão.
   */
  async ensureDefaultIfSingle(userId: string) {
    const actionable = await this.prisma.socialConnection.findMany({
      where: { userId, status: SocialConnectionStatus.ACTIVE },
    });
    if (actionable.length !== 1) return;
    const only = actionable[0];
    if (only && !only.isDefault) {
      await this.prisma.socialConnection.update({
        where: { id: only.id },
        data: { isDefault: true },
      });
    }
  }

  /**
   * Remove o registro de login OAuth básico (antes de criar páginas reais no mesmo ciclo).
   */
  async removeMetaUserBasicConnection(userId: string): Promise<void> {
    await this.prisma.socialConnection.deleteMany({
      where: { userId, facebookPageId: META_BASIC_USER_SENTINEL_PAGE_ID },
    });
  }

  /**
   * Salva token de usuário quando o fluxo só tem public_profile ou falhou listagem de páginas.
   */
  async upsertMetaUserBasicConnection(opts: {
    userId: string;
    userAccessToken: string;
    expiresAt: Date | null;
    grantedScopes: string | null;
    lastError?: string | null;
  }) {
    const enc = this.crypto.encrypt(opts.userAccessToken);
    const now = new Date();
    return this.prisma.socialConnection.upsert({
      where: {
        userId_facebookPageId: {
          userId: opts.userId,
          facebookPageId: META_BASIC_USER_SENTINEL_PAGE_ID,
        },
      },
      create: {
        userId: opts.userId,
        provider: SocialProvider.META_PAGE,
        accountLabel: 'Conta Meta (login básico)',
        facebookPageId: META_BASIC_USER_SENTINEL_PAGE_ID,
        facebookPageName: 'Login Meta — permissões de páginas pendentes',
        instagramUserId: null,
        instagramUsername: null,
        accessTokenEnc: enc,
        tokenExpiresAt: opts.expiresAt,
        status: SocialConnectionStatus.META_BASIC_CONNECTED,
        lastSyncAt: now,
        lastError: opts.lastError ?? null,
        grantedScopes: opts.grantedScopes ?? null,
        isDefault: false,
      },
      update: {
        accessTokenEnc: enc,
        tokenExpiresAt: opts.expiresAt,
        status: SocialConnectionStatus.META_BASIC_CONNECTED,
        lastSyncAt: now,
        lastError: opts.lastError ?? null,
        grantedScopes: opts.grantedScopes ?? undefined,
      },
    });
  }

  /** Resolve qual conexão usar na publicação (padrão ou explícita). */
  async resolveConnectionIdForPublishing(
    userId: string,
    _role: UserRole,
    explicitConnectionId?: string,
  ): Promise<string> {
    if (explicitConnectionId?.trim()) {
      const row = await this.assertPublishAccess(userId, _role, explicitConnectionId.trim());
      if (row.status === SocialConnectionStatus.META_BASIC_CONNECTED) {
        throw new BadRequestException(
          'Esta conexão é só login básico. Conceda permissões de páginas/publicação na Integrações.',
        );
      }
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

    throw new BadRequestException(
      'Nenhuma página Meta conectada para sua conta. Abra Integrações, conecte o Facebook/Instagram e defina uma página padrão.',
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
