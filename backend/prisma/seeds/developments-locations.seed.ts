import type { Development, DevelopmentLocationPrecision, PrismaClient } from '@prisma/client';

/**
 * Localização inicial dos loteamentos (MapLibre / geocodificação futura).
 * Por nome: preenche apenas campos de localização ainda vazios; não apaga dados existentes.
 */
type LocationSeedRow = {
  nome: string;
  cidade: string | null;
  estado: string | null;
  endereco_referencia: string | null;
  bairro_ou_regiao: string | null;
  localizacao_precision: DevelopmentLocationPrecision;
  latitude: number | null;
  longitude: number | null;
  observacao_localizacao: string | null;
};

export const DEVELOPMENTS_LOCATION_SEED: LocationSeedRow[] = [
  {
    nome: 'Zé Nery 2',
    cidade: 'Juazeiro do Norte',
    estado: 'CE',
    endereco_referencia: 'Região do anel viário / poucos minutos do centro',
    bairro_ou_regiao: null,
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Validar rua principal exata antes da geocodificação final',
  },
  {
    nome: 'Loteamento Secasa Barbalha',
    cidade: 'Barbalha',
    estado: 'CE',
    endereco_referencia: 'Av. Paraíso, Mata dos Dudas / referência também a 150m da CE-293, Malvinas',
    bairro_ou_regiao: 'Mata dos Dudas / Malvinas',
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Existem duas referências públicas; confirmar acesso principal',
  },
  {
    nome: 'Vale do Cariri',
    cidade: 'Barbalha',
    estado: 'CE',
    endereco_referencia:
      'Rua Alameda Ceará, Parque - Bulandeira, Barbalha - CE, 63180-000',
    bairro_ou_regiao: 'Parque / Bulandeira',
    localizacao_precision: 'EXATA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Endereço de referência pública para geocodificação',
  },
  {
    nome: 'O Conviver Riviera',
    cidade: 'Barbalha',
    estado: 'CE',
    endereco_referencia:
      'Av. Nossa Sra. de Fátima, S/N - Mata dos Limas, Barbalha - CE, 63180-000',
    bairro_ou_regiao: 'Mata dos Limas',
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: null,
  },
  {
    nome: 'Terras Araruna',
    cidade: 'Barbalha',
    estado: 'CE',
    endereco_referencia: 'Alto da Alegria, Loteamento Terras Araruna',
    bairro_ou_regiao: 'Alto da Alegria',
    localizacao_precision: 'EXATA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Usar como base para geocodificação',
  },
  {
    nome: 'Cidade Luz',
    cidade: 'Crato',
    estado: 'CE',
    endereco_referencia: 'Rua Inácio Ferreira Teles, 321',
    bairro_ou_regiao: 'Barro Branco / Muriti',
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Há referências ao bairro Barro Branco e Muriti; manter ambas como contexto',
  },
  {
    nome: 'Conviver Lagoa Seca',
    cidade: 'Juazeiro do Norte',
    estado: 'CE',
    endereco_referencia:
      'Av. Perimetral, 1408 - Planalto, Juazeiro do Norte - CE, 63040-400',
    bairro_ou_regiao: 'Planalto',
    localizacao_precision: 'EXATA',
    latitude: null,
    longitude: null,
    observacao_localizacao: null,
  },
  {
    nome: 'Arte Residence 3',
    cidade: null,
    estado: 'CE',
    endereco_referencia: null,
    bairro_ou_regiao: null,
    localizacao_precision: 'PENDENTE',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Endereço ainda não confirmado',
  },
  {
    nome: 'Art Residence 2',
    cidade: 'Barbalha',
    estado: 'CE',
    endereco_referencia:
      'R. Padre João Moretti, 307 - Mata dos Limas, Barbalha - CE, 63180-000',
    bairro_ou_regiao: 'Mata dos Limas',
    localizacao_precision: 'EXATA',
    latitude: null,
    longitude: null,
    observacao_localizacao: null,
  },
  {
    nome: 'Lagoa Seca 3',
    cidade: 'Juazeiro do Norte',
    estado: 'CE',
    endereco_referencia: 'Região de Lagoa Seca',
    bairro_ou_regiao: 'Lagoa Seca',
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Sem rua exata confirmada',
  },
  {
    nome: 'Lagoa Seca 1 e 2',
    cidade: 'Barbalha',
    estado: 'CE',
    endereco_referencia: 'Próximo à Avenida Leão Sampaio',
    bairro_ou_regiao: null,
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Usar Av. Leão Sampaio como referência inicial',
  },
  {
    nome: 'Conquista Aeroporto',
    cidade: 'Missão Velha',
    estado: 'CE',
    endereco_referencia: 'Rua Gessi Maciel Lopes, 314 / Rua Francisco Brandão de Araújo, 280',
    bairro_ou_regiao: 'Aeroporto',
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Confirmar qual é o acesso oficial do loteamento',
  },
  {
    nome: 'Imaculada Conceição',
    cidade: 'Crato',
    estado: 'CE',
    endereco_referencia: 'Rua Inácio Ferreira Teles',
    bairro_ou_regiao: 'Barro Branco / Nossa Senhora de Fátima',
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Há fontes públicas divergindo no bairro de referência',
  },
  {
    nome: 'Barão do Araruna',
    cidade: 'Juazeiro do Norte',
    estado: 'CE',
    endereco_referencia:
      'CE-060 - Três-Marias, Juazeiro do Norte - CE, 63015-010',
    bairro_ou_regiao: 'Três-Marias',
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Referência ao longo da CE-060; geocodificar ponto de acesso ao loteamento',
  },
  {
    nome: 'Sol Nascente',
    cidade: 'Crato',
    estado: 'CE',
    endereco_referencia: 'Bairro Vila Lobo / Mirandão',
    bairro_ou_regiao: 'Vila Lobo / Mirandão',
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Sem rua exata confirmada',
  },
  {
    nome: 'Jardins dos Ipês',
    cidade: 'Barbalha',
    estado: 'CE',
    endereco_referencia: 'Rua Aderson Sabino',
    bairro_ou_regiao: 'Sítio São Paulo / Alto da Alegria',
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Há CEPs e ruas internas; usar Rua Aderson Sabino como referência',
  },
  {
    nome: 'Art Residence 4',
    cidade: 'Barbalha',
    estado: 'CE',
    endereco_referencia: 'Entre Juazeiro do Norte e Barbalha / a 500m da Av. Leão Sampaio',
    bairro_ou_regiao: null,
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Sem número exato confirmado',
  },
  {
    nome: 'Santa Amélia',
    cidade: 'Crato',
    estado: 'CE',
    endereco_referencia: 'Rua Arthur Bezerra de Menezes, quadra E, lotes 45, 46 e 47',
    bairro_ou_regiao: null,
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Usar como referência inicial do loteamento',
  },
  {
    nome: 'Boa Vista',
    cidade: 'Crato',
    estado: 'CE',
    endereco_referencia: 'Bairro Novo Lameiro',
    bairro_ou_regiao: 'Novo Lameiro / Vila Padre Cícero / São Bento',
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Há múltiplas referências públicas de localização',
  },
  {
    nome: 'Canaã',
    cidade: 'Barbalha',
    estado: 'CE',
    endereco_referencia: 'Barbalha, CE, 63180-000',
    bairro_ou_regiao: null,
    localizacao_precision: 'APROXIMADA',
    latitude: null,
    longitude: null,
    observacao_localizacao: 'Município e CEP de referência; detalhar logradouro quando houver fonte oficial',
  },
];

function isBlank(s: string | null | undefined): boolean {
  return s == null || s.trim() === '';
}

/** Cidade quando o cadastro ainda não tem município confirmado. */
const CITY_PENDING_PLACEHOLDER = 'A confirmar';

export async function seedDevelopmentsLocations(prisma: PrismaClient): Promise<void> {
  console.log('\n[developments] localização inicial (merge por nome, só campos vazios)…');

  for (const row of DEVELOPMENTS_LOCATION_SEED) {
    const existing = await prisma.development.findFirst({
      where: { name: row.nome },
    });
    if (!existing) {
      console.log(`[developments] localização — não encontrado: "${row.nome}"`);
      continue;
    }

    const data = buildLocationPatch(existing, row);
    if (Object.keys(data).length === 0) {
      console.log(`[developments] localização — sem alterações: "${row.nome}"`);
      continue;
    }

    await prisma.development.update({
      where: { id: existing.id },
      data,
    });
    console.log(`[developments] localização atualizada: "${row.nome}"`);
  }
}

function buildLocationPatch(
  existing: Development,
  row: LocationSeedRow,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  const targetCity = row.cidade?.trim() ? row.cidade.trim() : CITY_PENDING_PLACEHOLDER;
  if (isBlank(existing.city) || existing.city.trim() === CITY_PENDING_PLACEHOLDER) {
    data.city = targetCity;
  }

  if (!isBlank(row.estado) && isBlank(existing.state)) {
    data.state = row.estado!.trim();
  }

  if (!isBlank(row.endereco_referencia) && isBlank(existing.referenceAddress)) {
    data.referenceAddress = row.endereco_referencia!.trim();
  }

  if (!isBlank(row.bairro_ou_regiao) && isBlank(existing.neighborhood)) {
    data.neighborhood = row.bairro_ou_regiao!.trim();
  }

  if (!isBlank(row.observacao_localizacao) && isBlank(existing.locationNotes)) {
    data.locationNotes = row.observacao_localizacao!.trim();
  }

  if (existing.locationPrecision === 'PENDENTE' && row.localizacao_precision !== 'PENDENTE') {
    data.locationPrecision = row.localizacao_precision;
  }

  if (row.latitude != null && existing.latitude == null) {
    data.latitude = row.latitude;
  }
  if (row.longitude != null && existing.longitude == null) {
    data.longitude = row.longitude;
  }

  return data;
}
