/**
 * Redireciona para a URL de OAuth da Meta na janela de navegação atual.
 * Usa `location.assign` (não popup, não iframe) para evitar contexto de extensão ou wrapper estranho.
 */
export function redirectToMetaOAuthUrl(url: string): void {
  if (typeof window === 'undefined') return;

  const isHttpsFacebook =
    url.startsWith('https://www.facebook.com/') || url.startsWith('https://facebook.com/');
  if (!isHttpsFacebook) {
    console.warn('[ImobiFlow Meta] URL inesperada (esperado domínio facebook.com):', url.slice(0, 120));
  }

  console.info('[ImobiFlow Meta] URL recebida da API (prefixo):', url.slice(0, 80) + (url.length > 80 ? '…' : ''));
  console.info('[ImobiFlow Meta] Redirecionando a janela principal (location.assign) — não use popup/extensão');

  try {
    window.location.assign(url);
  } catch (e) {
    console.error('[ImobiFlow Meta] Falha em location.assign, tentando href', e);
    window.location.href = url;
  }
}
