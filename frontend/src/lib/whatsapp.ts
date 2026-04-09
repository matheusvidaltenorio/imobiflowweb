/**
 * Abre WhatsApp (web ou app) com texto pré-preenchido.
 * Limite prático ~2000 caracteres; wa.me usa query `text`.
 */
export function buildWhatsAppShareUrl(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return 'https://wa.me/';
  const encoded = encodeURIComponent(trimmed);
  return `https://wa.me/?text=${encoded}`;
}
