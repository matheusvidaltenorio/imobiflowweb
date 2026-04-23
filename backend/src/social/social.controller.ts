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
import { MetaOAuthService } from './meta-oauth.service';
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

  private redirectPublication(
    res: Response,
    query: Record<string, string>,
  ): void {
    const base = this.frontendBase();
    const sp = new URLSearchParams(query);
    res.redirect(`${base}/publication?${sp.toString()}`);
  }

  @Get('meta/status')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  metaStatus() {
    return { configured: this.metaOAuth.isConfigured() };
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
  @Roles(UserRole.ADMIN)
  selectMetaPage(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: SelectMetaPageDto,
  ) {
    return this.connections.setDefaultConnection(userId, role, body.connectionId);
  }

  /** Desconecta uma página (mesmo efeito de DELETE /social/connections/:id). */
  @Post('meta/disconnect')
  @Roles(UserRole.ADMIN)
  disconnectMeta(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: MetaDisconnectDto,
  ) {
    return this.connections.delete(userId, role, body.connectionId);
  }

  /**
   * Inicia OAuth. Escopos:
   * - padrão: minimal (public_profile, email, pages_show_list)
   * - ?scope=extended ou ?scope=full: inclui publicação Instagram/Facebook
   * Override: META_OAUTH_SCOPES no servidor.
   */
  private startMetaOAuth(userId: string, requestMode: MetaOAuthScopeMode | null) {
    if (!this.metaOAuth.isConfigured()) {
      throw new BadRequestException(
        'Integração Meta não configurada no servidor (META_APP_ID / META_APP_SECRET / META_OAUTH_REDIRECT_URI).',
      );
    }
    const state = this.metaOAuth.createState(userId, requestMode);
    const { url, scopes: scopesStr } = this.metaOAuth.buildAuthorizeUrl(state, requestMode);
    const scopeModeLabel: 'minimal' | 'extended' =
      requestMode === 'extended' || scopesStr.includes('instagram_content_publish')
        ? 'extended'
        : 'minimal';
    return { url, scopeMode: scopeModeLabel, scopes: scopesStr };
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
  @Roles(UserRole.ADMIN)
  startMetaLegacy(@CurrentUser('id') userId: string, @Query('scope') scope?: string) {
    return this.startMetaOAuth(userId, this.parseScopeQuery(scope));
  }

  /** OAuth Meta: apenas administradores iniciam conexão (tokens ficam no servidor). */
  @Get('meta/connect')
  @Roles(UserRole.ADMIN)
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

      return this.redirectPublication(res, {
        meta_error: msg,
        meta_error_code: codeKey,
      });
    }

    if (!code || !state) {
      this.logger.warn('Meta OAuth callback: resposta incompleta (code/state).');
      return this.redirectPublication(res, {
        meta_error: 'Resposta incompleta da Meta (code/state). Tente conectar novamente.',
        meta_error_code: 'incomplete',
      });
    }

    try {
      const statePayload = this.metaOAuth.parseState(state);
      const { uid } = statePayload;
      const scopeModeForScopes =
        statePayload.scopeMode === 'extended'
          ? 'extended'
          : statePayload.scopeMode === 'minimal'
            ? 'minimal'
            : null;
      const grantedScopes = this.metaOAuth.resolveScopesString(scopeModeForScopes);

      const short = await this.metaOAuth.exchangeCodeForShortLivedToken(code);
      const long = await this.metaOAuth.exchangeForLongLivedUserToken(short.access_token);
      const pages = await this.metaOAuth.listManagedPages(long.access_token);
      const expiresAt = long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null;
      for (const p of pages) {
        await this.connections.upsertPageConnection({
          userId: uid,
          facebookPageId: p.id,
          facebookPageName: p.name,
          instagramUserId: p.instagram_business_account?.id ?? null,
          instagramUsername: p.instagram_business_account?.username ?? null,
          pageAccessToken: p.access_token,
          expiresAt,
          grantedScopes,
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
      return this.redirectPublication(res, {
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
          'Faltam permissões para listar páginas. Use “Conectar com permissões para publicar” ou adicione escopos no app Meta.';
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

      return this.redirectPublication(res, {
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
  @Roles(UserRole.ADMIN)
  removeConnection(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    return this.connections.delete(userId, role, id);
  }
}
