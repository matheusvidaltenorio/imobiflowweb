/**
 * Redireciona para a URL de autorização Meta.
 * Preferimos `window.top` para sair de iframe / Simple Browser / WebView onde só o frame interno navegaria (erro chrome-error ↔ localhost).
 */
export function redirectToMetaOAuthUrl(url: string): void {
  if (typeof window === 'undefined') return;

  const isHttpsFacebook =
    url.startsWith('https://www.facebook.com/') || url.startsWith('https://facebook.com/');
  if (!isHttpsFacebook) {
    console.warn('[ImobiFlow Meta] URL inesperada (esperado domínio facebook.com):', url.slice(0, 120));
  }

  console.info('[ImobiFlow Meta] URL recebida da API (prefixo):', url.slice(0, 80) + (url.length > 80 ? '…' : ''));
  console.info('[ImobiFlow Meta] Preferindo navegação no window.top para sair de iframe/WebView');

  const nav = typeof window.top !== 'undefined' && window.top !== window ? window.top : window;
  try {
    nav.location.assign(url);
  } catch (e) {
    console.error('[ImobiFlow Meta] Falha em assign no top/nav, tentando self', e);
    try {
      window.location.assign(url);
    } catch {
      window.location.href = url;
    }
  }
}
