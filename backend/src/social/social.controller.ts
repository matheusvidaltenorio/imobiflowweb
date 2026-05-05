import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { MetaOAuthScopeMode } from './meta-oauth.scopes';
import { isBasicProfileOnlyScope, metaOAuthRequestsPagesList, MetaOAuthService } from './meta-oauth.service';
import { SocialConnectionService } from './social-connection.service';
import { SocialIntegrationLogService } from './social-integration-log.service';
import { SelectMetaPageDto } from './dto/select-meta-page.dto';
import { MetaDisconnectDto } from './dto/meta-disconnect.dto';

@Controller('social')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SocialController {
  private readonly logger = new Logger(SocialController.name);

  constructor(
    private readonly metaOAuth: MetaOAuthService,
    private readonly connections: SocialConnectionService,
    private readonly integrationLog: SocialIntegrationLogService,
    private readonly config: ConfigService,
  ) {}

  private frontendBase(): string {
    const raw = this.config.get<string>('FRONTEND_URL')?.trim();
    const base = (raw || 'http://localhost:3000').replace(/\/$/, '');
    return base;
  }

  /** Após OAuth Meta, volta para Integrações (cada usuário gerencia suas conexões ali). */
  private redirectAfterMetaOAuth(
    res: Response,
    query: Record<string, string>,
  ): void {
    const base = this.frontendBase();
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      sp.set(k, v);
    }
    const dest = `${base}/integrations?${sp.toString()}`;
    let destOrigin = base;
    try {
      destOrigin = new URL(dest).origin;
    } catch {
      /* usar base já normalizado */
    }
    /** Permite só este HTML de “ponte” e envio GET para FRONTEND_URL (troca código OAuth no iframe/WebView → top). */
    const csp = [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      "script-src 'unsafe-inline'",
      `form-action 'self' ${destOrigin}`,
      "base-uri 'none'",
      "frame-ancestors 'none'",
      'sandbox allow-scripts allow-forms allow-same-origin allow-top-navigation',
    ].join('; ');

    const hrefEsc = dest.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const actionEsc = dest.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

    const body = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width"/>
<title>Voltando ao ImobiFlow</title>
<style>body{font-family:system-ui,sans-serif;padding:1.5rem}</style>
</head>
<body>
<p>Finalizando conexão…</p>
<p><a href="${hrefEsc}" rel="noopener noreferrer" target="_top">Continuar para o ImobiFlow</a></p>
<form id="f" method="get" action="${actionEsc}" target="_top"></form>
<script>document.getElementById('f').submit();</script>
</body>
</html>`;

    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Content-Security-Policy-Report-Only');
    res
      .status(200)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Content-Security-Policy', csp)
      .send(body);
  }

  @Get('meta/status')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  metaStatus() {
    const envMode =
      this.config.get<string>('META_OAUTH_SCOPE_MODE')?.trim().toLowerCase() ?? null;
    return {
      configured: this.metaOAuth.isConfigured(),
      oauthScopeMode: envMode ?? 'default(minimal_via_public_profile_when_unset)',
      hints: {
        primaryConnectUsesMinimalRoute: true,
        extendedUsesQueryScopeExtended: true,
      },
    };
  }

  /**
   * Páginas Facebook já sincronizadas após OAuth (tokens no servidor; sem segredos na resposta).
   * Alias semântico de GET /social/connections.
   */
  @Get('meta/pages')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  listMetaPages(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.connections.list(userId, role);
  }

  @Post('meta/select-page')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  selectMetaPage(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: SelectMetaPageDto,
  ) {
    return this.connections.setDefaultConnection(userId, role, body.connectionId);
  }

  /** Desconecta uma página (mesmo efeito de DELETE /social/connections/:id). */
  @Post('meta/disconnect')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  disconnectMeta(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: MetaDisconnectDto,
  ) {
    return this.connections.delete(userId, role, body.connectionId);
  }

  /**
   * Inicia OAuth.
   * - Rota principal (sem query): escopos mínimos (ex.: apenas public_profile com META_OAUTH_SCOPE_MODE=minimal).
   * - ?scope=extended: fluxo estendido (páginas + publicação IG/FB quando aprovados no app Meta).
   * Override total: META_OAUTH_SCOPES.
   */
  private startMetaOAuth(userId: string, requestMode: MetaOAuthScopeMode | null) {
    if (!this.metaOAuth.isConfigured()) {
      throw new BadRequestException(
        'Integração Meta não configurada no servidor (META_APP_ID / META_APP_SECRET / META_OAUTH_REDIRECT_URI).',
      );
    }
    const scopesStr = this.metaOAuth.resolveScopesString(requestMode);
    const state = this.metaOAuth.createState(userId, requestMode, scopesStr);
    const { url, scopes } = this.metaOAuth.buildAuthorizeUrl(state, requestMode, scopesStr);
    const scopeModeLabel: 'minimal' | 'extended' =
      scopesStr.includes('pages_show_list') ||
      scopesStr.includes('instagram_content_publish') ||
      scopesStr.includes('pages_manage_posts')
        ? 'extended'
        : 'minimal';
    return { url, scopeMode: scopeModeLabel, scopes };
  }

  private parseScopeQuery(scope?: string): MetaOAuthScopeMode | null {
    const s = scope?.trim().toLowerCase();
    if (!s) return null;
    if (s === 'extended' || s === 'full' || s === 'publish') return 'extended';
    if (s === 'minimal' || s === 'basic') return 'minimal';
    return null;
  }

  /** @deprecated Use meta/connect */
  @Get('meta/start')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  startMetaLegacy(@CurrentUser('id') userId: string, @Query('scope') scope?: string) {
    return this.startMetaOAuth(userId, this.parseScopeQuery(scope));
  }

  /** OAuth Meta: cada usuário autenticado conecta as próprias páginas (tokens ficam no servidor). */
  @Get('meta/connect')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  connectMeta(@CurrentUser('id') userId: string, @Query('scope') scope?: string) {
    return this.startMetaOAuth(userId, this.parseScopeQuery(scope));
  }

  @Get('meta/callback')
  @Public()
  async metaCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Query('error_reason') errorReason: string | undefined,
    @Res() res: Response,
  ) {
    if (error) {
      const desc = `${errorDescription ?? ''} ${errorReason ?? ''}`.toLowerCase();
      this.logger.warn(`Meta OAuth callback error: ${error} — ${errorDescription ?? ''}`);

      let codeKey = 'meta_oauth';
      let msg =
        'Não foi possível conectar à Meta. Verifique se o app está em modo de teste e se você está autorizado.';

      if (error === 'access_denied') {
        codeKey = 'access_denied';
        msg = 'Autorização cancelada na Meta. Você pode tentar conectar novamente quando quiser.';
      } else if (desc.includes('redirect_uri') || desc.includes('redirect uri')) {
        codeKey = 'redirect_uri';
        msg =
          'redirect_uri: a URL de callback no painel Meta deve ser idêntica a META_OAUTH_REDIRECT_URI no servidor (incluindo https e /api/...).';
      } else if (desc.includes('scope') || desc.includes('permission') || desc.includes('perm')) {
        codeKey = 'scopes';
        msg =
          'Permissões: confira escopos aprovados no app Meta, usuários de teste e se o fluxo pede permissões extras (use primeiro “conexão básica”).';
      } else if (desc.includes('blocked') || desc.includes('bloquead') || desc.includes('url')) {
        codeKey = 'url_blocked';
        msg =
          'A Meta bloqueou ou não reconheceu a URL. Abra o ImobiFlow em uma aba normal do navegador (sem extensão que intercepte OAuth) e tente de novo.';
      }

      return this.redirectAfterMetaOAuth(res, {
        meta_error: msg,
        meta_error_code: codeKey,
      });
    }

    if (!code || !state) {
      this.logger.warn('Meta OAuth callback: resposta incompleta (code/state).');
      return this.redirectAfterMetaOAuth(res, {
        meta_error: 'Resposta incompleta da Meta (code/state). Tente conectar novamente.',
        meta_error_code: 'incomplete',
      });
    }

    try {
      const statePayload = this.metaOAuth.parseState(state);
      const { uid } = statePayload;
      const grantedScopesCsv = statePayload.scopesRequested ?? '';
      const short = await this.metaOAuth.exchangeCodeForShortLivedToken(code);
      const long = await this.metaOAuth.exchangeForLongLivedUserToken(short.access_token);
      const expiresAt = long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null;

      const minimalOnly =
        isBasicProfileOnlyScope(grantedScopesCsv) || !metaOAuthRequestsPagesList(grantedScopesCsv);

      if (minimalOnly) {
        await this.connections.upsertMetaUserBasicConnection({
          userId: uid,
          userAccessToken: long.access_token,
          expiresAt,
          grantedScopes: grantedScopesCsv,
          lastError: null,
        });
        await this.integrationLog.log({
          userId: uid,
          action: 'META_BASIC_CONNECTED',
          channel: 'META',
          status: 'SUCCESS',
          message:
            'Login OAuth Meta concluído (fluxo mínimo). Permissões de páginas ainda não foram concedidas.',
          metadataJson: { grantedScopesCsv },
        });
        return this.redirectAfterMetaOAuth(res, {
          meta_basic_connected: '1',
        });
      }

      let pages: Awaited<ReturnType<MetaOAuthService['listManagedPages']>> = [];
      try {
        pages = await this.metaOAuth.listManagedPages(long.access_token);
      } catch (pageErr) {
        const hint = pageErr instanceof Error ? pageErr.message : String(pageErr);
        this.logger.warn(`Meta OAuth: listagem de páginas não disponível: ${hint}`);
        await this.connections.upsertMetaUserBasicConnection({
          userId: uid,
          userAccessToken: long.access_token,
          expiresAt,
          grantedScopes: grantedScopesCsv,
          lastError:
            'Login Meta conectado, mas permissões de páginas ainda não foram concedidas ou a lista falhou.',
        });
        await this.integrationLog.log({
          userId: uid,
          action: 'META_BASIC_CONNECTED',
          channel: 'META',
          status: 'WARN',
          message:
            'Login Meta OK; permissões de páginas não concedidas ou listagem falhou. Use permissões estendidas.',
          metadataJson: { hint: hint.slice(0, 500), grantedScopesCsv },
        });
        return this.redirectAfterMetaOAuth(res, {
          meta_basic_connected: '1',
          meta_pages_pending: '1',
        });
      }

      await this.connections.removeMetaUserBasicConnection(uid);

      if (pages.length === 0) {
        await this.connections.upsertMetaUserBasicConnection({
          userId: uid,
          userAccessToken: long.access_token,
          expiresAt,
          grantedScopes: grantedScopesCsv,
          lastError:
            'Login Meta OK. Nenhuma página retornada; confira permissões ou se esta conta gerencia alguma página Facebook.',
        });
        await this.integrationLog.log({
          userId: uid,
          action: 'META_BASIC_CONNECTED',
          channel: 'META',
          status: 'WARN',
          message:
            'Token Meta válido mas nenhuma página listada — permissões incompletas ou conta sem páginas administradas.',
          metadataJson: { pageCount: 0, grantedScopesCsv },
        });
        return this.redirectAfterMetaOAuth(res, {
          meta_basic_connected: '1',
          meta_pages_pending: '1',
          pages: '0',
        });
      }

      for (const p of pages) {
        await this.connections.upsertPageConnection({
          userId: uid,
          facebookPageId: p.id,
          facebookPageName: p.name,
          instagramUserId: p.instagram_business_account?.id ?? null,
          instagramUsername: p.instagram_business_account?.username ?? null,
          pageAccessToken: p.access_token,
          expiresAt,
          grantedScopes: grantedScopesCsv,
        });
      }
      await this.connections.ensureDefaultIfSingle(uid);
      await this.integrationLog.log({
        userId: uid,
        action: 'META_OAUTH_CONNECTED',
        channel: 'META',
        status: 'SUCCESS',
        message: `${pages.length} página(s) sincronizada(s).`,
        metadataJson: { pageCount: pages.length },
      });
      return this.redirectAfterMetaOAuth(res, {
        meta_connected: '1',
        pages: String(pages.length),
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      this.logger.error(`Meta OAuth callback falhou: ${raw}`, e instanceof Error ? e.stack : undefined);

      let codeKey = 'callback';
      let msg = 'Erro ao finalizar conexão com a Meta. Tente novamente em instantes.';
      const low = raw.toLowerCase();

      if (low.includes('redirect_uri') || low.includes('redirect uri')) {
        codeKey = 'redirect_uri';
        msg =
          'redirect_uri: o mesmo endereço deve estar no app Meta e em META_OAUTH_REDIRECT_URI. Confira o log do servidor.';
      } else if (low.includes('code') && (low.includes('invalid') || low.includes('expired'))) {
        codeKey = 'session';
        msg = 'Código OAuth inválido ou expirado. Inicie a conexão novamente a partir do ImobiFlow.';
      } else if (low.includes('token') && (low.includes('invalid') || low.includes('expired'))) {
        codeKey = 'token';
        msg = 'Token inválido ou expirado. Desconecte e conecte de novo na tela de integrações.';
      } else if (low.includes('permission') || low.includes('scope') || low.includes('#200')) {
        codeKey = 'scopes';
        msg =
          'Faltam permissões para esta operação na Meta. Abra Integrações e use “Conceder permissões de páginas/publicação” ou revise os produtos/aprovações do app.';
      }

      try {
        if (state) {
          const { uid } = this.metaOAuth.parseState(state);
          await this.integrationLog.log({
            userId: uid,
            action: 'META_OAUTH_FAILED',
            channel: 'META',
            status: 'FAILED',
            message: msg.slice(0, 2000),
            metadataJson: { codeKey },
          });
        }
      } catch {
        /* state inválido: sem userId para auditoria */
      }

      return this.redirectAfterMetaOAuth(res, {
        meta_error: msg,
        meta_error_code: codeKey,
      });
    }
  }

  @Get('connections')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  listConnections(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.connections.list(userId, role);
  }

  @Delete('connections/:id')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  removeConnection(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    return this.connections.delete(userId, role, id);
  }
}
