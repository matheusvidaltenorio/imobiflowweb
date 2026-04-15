/**
 * Classifica mensagens de erro de publicação para decidir retry automático.
 * Erros permanentes não devem reenfileirar (evita loop).
 */
export function isRecoverablePublicationError(message: string): boolean {
  const m = message.toLowerCase();

  const permanentSnippets = [
    'token',
    'revogad',
    'invalid',
    'permission',
    'permiss',
    'oauth',
    'desconect',
    'não possui conta instagram',
    'sem instagram business',
    'instagram business',
    'não inclui o alvo',
    'não foi possível publicar', // prefixo de BadRequest já amigável
    'adicione pelo menos uma imagem',
    'gere o texto',
    'https://',
    'nenhuma página meta',
    'conexão inativa',
    'nenhum canal',
  ];
  if (permanentSnippets.some((s) => m.includes(s))) {
    return false;
  }

  const transientSnippets = [
    'timeout',
    'econnreset',
    'etimedout',
    'socket',
    'network',
    ' 503',
    ' 502',
    ' 429',
    'rate limit',
    'temporari',
    'unavailable',
  ];
  if (transientSnippets.some((s) => m.includes(s))) {
    return true;
  }

  return false;
}

export function computeNextRetryAt(retryCount: number): Date {
  const baseMs = 60_000;
  const capMs = 60 * 60_000;
  const delay = Math.min(baseMs * Math.pow(2, Math.max(0, retryCount)), capMs);
  return new Date(Date.now() + delay);
}
