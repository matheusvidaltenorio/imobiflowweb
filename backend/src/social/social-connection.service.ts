import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SocialConnectionStatus, SocialProvider, UserRole } from '@prisma/client';
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
    };
  }

  async list(userId: string, role: UserRole): Promise<SocialConnectionSafe[]> {
    const where = role === UserRole.ADMIN ? {} : { userId };
    const rows = await this.prisma.socialConnection.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
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

  async delete(userId: string, role: UserRole, id: string) {
    await this.assertOwner(userId, role, id);
    await this.prisma.socialConnection.delete({ where: { id } });
    return { ok: true };
  }

  /** Token de página descriptografado — apenas uso interno (publicação). */
  async getDecryptedPageToken(userId: string, role: UserRole, connectionId: string): Promise<{
    pageAccessToken: string;
    facebookPageId: string;
    instagramUserId: string | null;
  }> {
    const row = await this.assertOwner(userId, role, connectionId);
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
  }) {
    const enc = this.crypto.encrypt(opts.pageAccessToken);
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
      },
      update: {
        facebookPageName: opts.facebookPageName,
        instagramUserId: opts.instagramUserId,
        instagramUsername: opts.instagramUsername,
        accessTokenEnc: enc,
        tokenExpiresAt: opts.expiresAt,
        status: SocialConnectionStatus.ACTIVE,
      },
    });
  }
}
