/** Mantém apenas dígitos e limita o tamanho. */
export function digitsOnly(value: string, maxLen?: number): string {
  const d = value.replace(/\D/g, '');
  return maxLen ? d.slice(0, maxLen) : d;
}

export function formatCpf(value: string): string {
  const d = digitsOnly(value, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Exibe centavos como moeda BRL (digitação: só números, últimos 2 = centavos). */
export function formatBrlFromCents(cents: number): string {
  const neg = cents < 0;
  const c = Math.abs(Math.round(cents));
  const reais = Math.floor(c / 100);
  const frac = c % 100;
  const parts = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const out = `${parts},${frac.toString().padStart(2, '0')}`;
  return neg ? `-R$ ${out}` : `R$ ${out}`;
}

export function digitsToBrlDisplay(digitsRaw: string): string {
  const d = digitsRaw.replace(/\D/g, '');
  if (!d) return '';
  const cents = parseInt(d, 10);
  if (Number.isNaN(cents)) return '';
  return formatBrlFromCents(cents);
}

export function brlDisplayToCents(display: string): number {
  const d = display.replace(/\D/g, '');
  if (!d) return 0;
  const n = parseInt(d, 10);
  return Number.isNaN(n) ? 0 : n;
}

export function centsToReais(cents: number): number {
  return Math.round(cents) / 100;
}

/** Telefone BR para wa.me (55 + DDD + número). */
export function toWhatsAppDigits(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 11 && !d.startsWith('55')) return `55${d}`;
  if (d.length === 10 && !d.startsWith('55')) return `55${d}`;
  if (d.startsWith('55')) return d;
  return d;
}
