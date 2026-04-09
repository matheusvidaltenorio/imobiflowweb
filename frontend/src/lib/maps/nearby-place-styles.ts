/** Cores por categoria (POI) no mapa — alinhado às chaves salvas no backend. */
export const NEARBY_CATEGORY_COLOR: Record<string, string> = {
  supermarket: '#16a34a',
  pharmacy: '#dc2626',
  fast_food: '#ea580c',
  restaurant: '#ca8a04',
  school: '#2563eb',
  fuel: '#7c3aed',
  hospital: '#be123c',
  clinic: '#db2777',
  bank: '#0d9488',
  atm: '#0891b2',
  cafe: '#92400e',
  gym: '#4f46e5',
  church: '#78716c',
};

export const NEARBY_CATEGORY_LABEL: Record<string, string> = {
  supermarket: 'Supermercado',
  pharmacy: 'Farmácia',
  fast_food: 'Lanchonete',
  restaurant: 'Restaurante',
  school: 'Escola',
  fuel: 'Posto',
  hospital: 'Hospital',
  clinic: 'Clínica',
  bank: 'Banco',
  atm: 'Caixa eletrônico',
  cafe: 'Café',
  gym: 'Academia',
  church: 'Igreja / templo',
};

export function nearbyCategoryColor(category: string): string {
  return NEARBY_CATEGORY_COLOR[category] ?? '#64748b';
}

export function nearbyCategoryLabel(category: string): string {
  return NEARBY_CATEGORY_LABEL[category] ?? category;
}
