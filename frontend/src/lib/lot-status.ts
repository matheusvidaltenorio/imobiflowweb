/** Labels para PropertyStatus do Prisma (reutilizado em Lot). */
export const LOT_STATUS_LABEL: Record<string, string> = {
  DISPONIVEL: 'Disponível',
  RESERVADO: 'Reservado',
  VENDIDO: 'Vendido',
  INDISPONIVEL: 'Indisponível',
};

export function lotStatusLabel(status: string): string {
  return LOT_STATUS_LABEL[status] ?? status;
}
