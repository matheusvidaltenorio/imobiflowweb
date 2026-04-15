/**
 * Escopos OAuth Meta — duas fases.
 *
 * Fase 1 (minimal): login + listar páginas (menos atrito em revisão/teste).
 * Fase 2 (extended): publicação Facebook/Instagram e dados de negócio.
 *
 * Override total: META_OAUTH_SCOPES=scope1,scope2 (uma linha, vírgulas).
 * Modo: META_OAUTH_SCOPE_MODE=minimal | extended (se META_OAUTH_SCOPES vazio).
 * Em desenvolvimento o padrão sem env é minimal; em produção também é minimal até você pedir extended.
 */
export const META_OAUTH_SCOPES_MINIMAL = [
  'public_profile',
  'email',
  'pages_show_list',
] as const;

/** Inclui permissões para publicar e Instagram Business */
export const META_OAUTH_SCOPES_EXTENDED = [
  ...META_OAUTH_SCOPES_MINIMAL,
  'pages_manage_posts',
  'business_management',
  'instagram_basic',
  'instagram_content_publish',
] as const;

export type MetaOAuthScopeMode = 'minimal' | 'extended';
