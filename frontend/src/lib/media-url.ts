/**
 * Monta URL absoluta para mídia servida pela API.
 * - URLs http(s) (ex.: Cloudinary) são retornadas como estão.
 * - Caminhos que começam com / (ex.: /uploads/...) usam a origem da API sem o sufixo /api.
 */
export function getApiOrigin(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';
  const trimmed = base.replace(/\/$/, '');
  if (trimmed.endsWith('/api')) {
    return trimmed.slice(0, -4) || 'http://localhost:3333';
  }
  return trimmed;
}

export function resolveMediaUrl(pathOrUrl: string | null | undefined): string | null {
  if (pathOrUrl == null || pathOrUrl === '') return null;
  const s = pathOrUrl.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return `${getApiOrigin()}${s}`;
  return `${getApiOrigin()}/${s}`;
}
