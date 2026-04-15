import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const SALT = 'imobflow-social-v1';

/**
 * Criptografia de tokens no repouso (AES-256-GCM).
 * Defina SOCIAL_TOKEN_ENCRYPTION_KEY (32 bytes em hex, 64 caracteres) em produção.
 */
@Injectable()
export class SocialTokenCryptoService {
  private readonly log = new Logger(SocialTokenCryptoService.name);
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('SOCIAL_TOKEN_ENCRYPTION_KEY')?.trim();
    const fallback = this.config.get<string>('JWT_SECRET') ?? 'dev-only';
    if (!raw || raw.length < 32) {
      this.log.warn(
        'SOCIAL_TOKEN_ENCRYPTION_KEY ausente ou curta; derivando chave a partir de JWT_SECRET (apenas dev).',
      );
      this.key = scryptSync(fallback, SALT, 32);
    } else {
      const hex = raw.length === 64 ? Buffer.from(raw, 'hex') : scryptSync(raw, SALT, 32);
      this.key = hex.length === 32 ? hex : scryptSync(raw, SALT, 32);
    }
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64url');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64url');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + 16);
    const data = buf.subarray(IV_LEN + 16);
    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}
