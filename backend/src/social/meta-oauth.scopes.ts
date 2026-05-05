/**
 * Escopos OAuth Meta — duas fases.
 *
 * Minimal (META_OAUTH_SCOPE_MODE=minimal ou fluxo principal): apenas public_profile (validar OAuth).
 *
 * Extended: permissões para listar páginas / Instagram / publicação (etapa futura ou ?scope=extended).
 *
 * Override total: META_OAUTH_SCOPES=scope1,scope2 (uma linha, vírgulas — ignora modos).
 * META_OAUTH_SCOPE_MODE=minimal | extended quando META_OAUTH_SCOPES está vazio.
 */
export const META_OAUTH_SCOPES_MINIMAL = ['public_profile'] as const;

/** Permissões avançadas (não usar no botão principal de conectar). */
export const META_OAUTH_SCOPES_EXTENDED = [
  'public_profile',
  'email',
  'pages_show_list',
  'pages_manage_posts',
  'business_management',
  'instagram_basic',
  'instagram_content_publish',
] as const;

export type MetaOAuthScopeMode = 'minimal' | 'extended';
