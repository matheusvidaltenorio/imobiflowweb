/**
 * Gera slug estável para URLs (loteamentos, etc.). Compatível com nomes em português.
 */
export function slugifyDevelopmentName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'loteamento';
}

/** Nome de arquivo seguro a partir do slug ou nome original. */
export function normalizeImageFileName(raw: string): string {
  const base = slugifyDevelopmentName(raw.replace(/\.[a-z0-9]+$/i, ''));
  const ext = (raw.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'jpg').toLowerCase();
  return `${base}.${ext}`;
}
