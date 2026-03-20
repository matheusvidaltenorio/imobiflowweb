/**
 * Mapa de logos por nome do banco (igual ao seed / retorno da API).
 * Arquivos servidos de /public/banks/.
 */
export const bankLogos: Record<string, string> = {
  Caixa: '/banks/caixa.png',
  'Banco do Brasil': '/banks/bb.png',
  Itaú: '/banks/itau.png',
  Bradesco: '/banks/bradesco.png',
  Santander: '/banks/santander.png',
};

/** Cor de destaque por banco (fallback de avatar com iniciais). */
export const bankAccentColors: Record<string, string> = {
  Caixa: '#0066B3',
  'Banco do Brasil': '#FFCC29',
  Itaú: '#EC7000',
  Bradesco: '#CC092F',
  Santander: '#EC0000',
};

export function getBankLogoUrl(bankName: string): string | undefined {
  const trimmed = bankName?.trim();
  if (!trimmed) return undefined;
  if (bankLogos[trimmed]) return bankLogos[trimmed];
  const hit = Object.keys(bankLogos).find(
    (k) => trimmed.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(trimmed.toLowerCase()),
  );
  return hit ? bankLogos[hit] : undefined;
}

export function getBankAccent(bankName: string): string {
  const trimmed = bankName?.trim();
  if (!trimmed) return '#16a34a';
  if (bankAccentColors[trimmed]) return bankAccentColors[trimmed];
  const hit = Object.keys(bankAccentColors).find(
    (k) => trimmed.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(trimmed.toLowerCase()),
  );
  return hit ? bankAccentColors[hit] : '#16a34a';
}
