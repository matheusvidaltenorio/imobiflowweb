import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  META_OAUTH_SCOPES_EXTENDED,
  META_OAUTH_SCOPES_MINIMAL,
  type MetaOAuthScopeMode,
} from './meta-oauth.scopes';

const GRAPH = 'https://graph.facebook.com';

/** Default aligned with dialog/oauth e Graph — override com META_GRAPH_VERSION */
const DEFAULT_META_GRAPH_VERSION = 'v18.0';

/** scopeMode reflete o modo usado em /meta/connect (para gravar grantedScopes no callback). */
export type MetaOAuthStatePayload = {
  uid: string;
  exp: number;
  scopeMode?: 'minimal' | 'extended' | null;
};

/** Trim + aspas .env — não altere o path do redirect (deve bater com o app Meta). */
function trimQuotes(raw: string | undefined): string {
  if (!raw) return '';
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function joinScopes(scopes: readonly string[]): string {
  return scopes.join(',');
}

/**
 * OAuth Meta (Facebook Login).
 * redirect_uri: somente META_OAUTH_REDIRECT_URI (sem fallback localhost).
 * Escopos: META_OAUTH_SCOPES (override) ou modo minimal/extended — ver meta-oauth.scopes.ts
 */
@Injectable()
export class MetaOAuthService {
  private readonly log = new Logger(MetaOAuthService.name);

  constructor(private readonly config: ConfigService) {}

  getGraphVersion(): string {
    const v = this.config.get<string>('META_GRAPH_VERSION')?.trim();
    return v || DEFAULT_META_GRAPH_VERSION;
  }

  isConfigured(): boolean {
    return !!(
      trimQuotes(this.config.get<string>('META_APP_ID')) &&
      trimQuotes(this.config.get<string>('META_APP_SECRET')) &&
      this.getRedirectUri()
    );
  }

  /**
   * Única fonte do redirect_uri (autorização + troca de code).
   * Deve coincidir com "Valid OAuth Redirect URIs" no app Meta.
   */
  getRedirectUri(): string {
    return trimQuotes(this.config.get<string>('META_OAUTH_REDIRECT_URI'));
  }

  /**
   * Resolve escopos finais.
   * - META_OAUTH_SCOPES= a,b,c → usa exatamente (ignora modo).
   * - Caso contrário: query `scope=extended` ou env META_OAUTH_SCOPE_MODE=extended|full → extended;
   *   query `scope=minimal` ou env minimal → minimal;
   *   padrão sem query/env: minimal (login leve).
   */
  resolveScopesString(requestMode: MetaOAuthScopeMode | null): string {
    const explicit = trimQuotes(this.config.get<string>('META_OAUTH_SCOPES'));
    if (explicit) {
      const parts = explicit
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return parts.join(',');
    }

    const envMode = this.config.get<string>('META_OAUTH_SCOPE_MODE')?.trim().toLowerCase();

    if (requestMode === 'extended') {
      return joinScopes(META_OAUTH_SCOPES_EXTENDED);
    }
    if (requestMode === 'minimal') {
      return joinScopes(META_OAUTH_SCOPES_MINIMAL);
    }

    if (envMode === 'extended' || envMode === 'full') {
      return joinScopes(META_OAUTH_SCOPES_EXTENDED);
    }
    if (envMode === 'minimal') {
      return joinScopes(META_OAUTH_SCOPES_MINIMAL);
    }

    return joinScopes(META_OAUTH_SCOPES_MINIMAL);
  }

  private signingSecret(): string {
    return this.config.get<string>('JWT_SECRET') ?? 'dev-insecure';
  }

  createState(userId: string, requestMode: MetaOAuthScopeMode | null): string {
    const exp = Date.now() + 15 * 60 * 1000;
    let scopeMode: 'minimal' | 'extended' | null = null;
    if (requestMode === 'extended') scopeMode = 'extended';
    else if (requestMode === 'minimal') scopeMode = 'minimal';
    const payload = JSON.stringify({ uid: userId, exp, scopeMode } satisfies MetaOAuthStatePayload);
    const sig = createHmac('sha256', this.signingSecret()).update(payload).digest('hex');
    return Buffer.from(`${payload}::${sig}`).toString('base64url');
  }

  parseState(state: string): MetaOAuthStatePayload {
    const raw = Buffer.from(state, 'base64url').toString('utf8');
    const idx = raw.lastIndexOf('::');
    if (idx < 0) throw new Error('State inválido');
    const payload = raw.slice(0, idx);
    const sig = raw.slice(idx + 2);
    const expected = createHmac('sha256', this.signingSecret()).update(payload).digest('hex');
    let a: Buffer;
    let b: Buffer;
    try {
      a = Buffer.from(sig, 'hex');
      b = Buffer.from(expected, 'hex');
    } catch {
      throw new Error('Assinatura do state inválida');
    }
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Assinatura do state inválida');
    }
    const data = JSON.parse(payload) as MetaOAuthStatePayload;
    if (Date.now() > data.exp) throw new Error('State expirado');
    return data;
  }

  /**
   * https://www.facebook.com/{version}/dialog/oauth
   */
  buildAuthorizeUrl(state: string, requestMode: MetaOAuthScopeMode | null): { url: string; scopes: string } {
    const appId = trimQuotes(this.config.get<string>('META_APP_ID'));
    const redirectUriRaw = this.getRedirectUri();
    const version = this.getGraphVersion();
    const redirectParam = encodeURIComponent(redirectUriRaw);
    const scopeStr = this.resolveScopesString(requestMode);
    const fullUrl = `https://www.facebook.com/${version}/dialog/oauth?client_id=${appId}&redirect_uri=${redirectParam}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scopeStr)}&response_type=code`;

    this.log.log(`[Meta OAuth] client_id (META_APP_ID): ${appId}`);
    this.log.log(`[Meta OAuth] redirect_uri (raw, única fonte): ${redirectUriRaw}`);
    this.log.log(`[Meta OAuth] scopes finais: ${scopeStr}`);
    this.log.log(`[Meta OAuth] URL completa enviada à Meta: ${fullUrl}`);

    return { url: fullUrl, scopes: scopeStr };
  }

  async exchangeCodeForShortLivedToken(code: string): Promise<{ access_token: string }> {
    const appId = trimQuotes(this.config.get<string>('META_APP_ID'));
    const secret = trimQuotes(this.config.get<string>('META_APP_SECRET'));
    const redirect = this.getRedirectUri();
    const version = this.getGraphVersion();
    this.log.log(`[Meta OAuth] troca de code — redirect_uri: ${redirect}`);
    const u = new URL(`${GRAPH}/${version}/oauth/access_token`);
    u.searchParams.set('client_id', appId);
    u.searchParams.set('redirect_uri', redirect);
    u.searchParams.set('client_secret', secret);
    u.searchParams.set('code', code);
    const res = await fetch(u.toString());
    const json = (await res.json()) as { access_token?: string; error?: { message?: string } };
    if (!res.ok || !json.access_token) {
      throw new Error(json.error?.message ?? 'Falha ao trocar code por token');
    }
    return { access_token: json.access_token };
  }

  async exchangeForLongLivedUserToken(shortToken: string): Promise<{ access_token: string; expires_in?: number }> {
    const appId = trimQuotes(this.config.get<string>('META_APP_ID'));
    const secret = trimQuotes(this.config.get<string>('META_APP_SECRET'));
    const version = this.getGraphVersion();
    const u = new URL(`${GRAPH}/${version}/oauth/access_token`);
    u.searchParams.set('grant_type', 'fb_exchange_token');
    u.searchParams.set('client_id', appId);
    u.searchParams.set('client_secret', secret);
    u.searchParams.set('fb_exchange_token', shortToken);
    const res = await fetch(u.toString());
    const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };
    if (!res.ok || !json.access_token) {
      throw new Error(json.error?.message ?? 'Falha no token longo');
    }
    return { access_token: json.access_token, expires_in: json.expires_in };
  }

  async listManagedPages(userAccessToken: string): Promise<
    Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username?: string };
    }>
  > {
    const version = this.getGraphVersion();
    const u = new URL(`${GRAPH}/${version}/me/accounts`);
    u.searchParams.set('access_token', userAccessToken);
    u.searchParams.set(
      'fields',
      'id,name,access_token,instagram_business_account{id,username}',
    );
    const res = await fetch(u.toString());
    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: { id: string; username?: string };
      }>;
      error?: { message?: string };
    };
    if (!res.ok || json.error) {
      this.log.warn(json.error?.message ?? 'me/accounts falhou');
      throw new Error(json.error?.message ?? 'Não foi possível listar páginas');
    }
    return json.data ?? [];
  }
}
