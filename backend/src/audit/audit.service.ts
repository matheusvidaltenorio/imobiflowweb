import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Chaves que nunca devem ir para metadata em logs. */
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'authorization',
  'secret',
  'pageAccessToken',
]);

export type AuditMetadata = Record<string, unknown>;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Remove campos sensíveis de objetos aninhados (1 nível). */
  sanitizeMetadata(meta: AuditMetadata | undefined): AuditMetadata | undefined {
    if (meta == null || typeof meta !== 'object') return meta;
    const out: AuditMetadata = {};
    for (const [k, v] of Object.entries(meta)) {
      const lower = k.toLowerCase();
      if (SENSITIVE_KEYS.has(k) || lower.includes('token') || lower.includes('password')) {
        out[k] = '[redacted]';
        continue;
      }
      if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
        out[k] = this.sanitizeMetadata(v as AuditMetadata) ?? {};
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  async log(opts: {
    userId: string;
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: AuditMetadata;
    ipAddress?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          userId: opts.userId,
          action: opts.action,
          entity: opts.entity,
          entityId: opts.entityId ?? undefined,
          metadata: this.sanitizeMetadata(opts.metadata) as object | undefined,
          ipAddress: opts.ipAddress ?? undefined,
        },
      });
    } catch (e) {
      this.logger.warn(`Falha ao registrar auditoria (${opts.action}): ${e instanceof Error ? e.message : e}`);
    }
  }

  /** Auditoria com estado anterior/novo (ex.: mudança de status). */
  async logChange(opts: {
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    before: AuditMetadata;
    after: AuditMetadata;
    ipAddress?: string | null;
  }): Promise<void> {
    await this.log({
      userId: opts.userId,
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId,
      metadata: {
        before: this.sanitizeMetadata(opts.before),
        after: this.sanitizeMetadata(opts.after),
      },
      ipAddress: opts.ipAddress,
    });
  }
}
