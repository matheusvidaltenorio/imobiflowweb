/**
 * Catálogo inicial de loteamentos (Ceará). Imagens em /uploads/loteamentos/<arquivo>.
 * Adicione linhas aqui e rode `npx prisma db seed` — duplicatas por nome são ignoradas.
 */

export function slugifyForSeed(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'loteamento';
}

export type DevelopmentCatalogEntry = {
  name: string;
  city: string;
  state: string;
  description: string;
  /** apenas o nome do arquivo; o path completo é montado no seed */
  imageFile: string;
};

const PREFIX = '/uploads/loteamentos';

export function coverPathForFile(imageFile: string): string {
  const safe = imageFile.replace(/^\/+/, '').replace(/\.\./g, '');
  return `${PREFIX}/${safe}`;
}

/** Descrições genéricas comerciais (rotação quando não há texto específico). */
const GENERIC = [
  'Loteamento com potencial de valorização e boa localização.',
  'Empreendimento voltado para moradia e investimento.',
  'Loteamento com proposta residencial em expansão.',
  'Opção interessante para quem busca terreno na região.',
];

function genericDescription(i: number): string {
  return GENERIC[i % GENERIC.length]!;
}

export const DEVELOPMENTS_CATALOG: DevelopmentCatalogEntry[] = [
  {
    name: 'Zé Nery 2',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: 'Loteamento com localização privilegiada e fácil acesso',
    imageFile: 'ze-nery-2.jpg',
  },
  {
    name: 'Loteamento Secasa Barbalha',
    city: 'Barbalha',
    state: 'CE',
    description: genericDescription(0),
    imageFile: 'secasa-barbalha.jpg',
  },
  {
    name: 'Madre de Deus Residencial',
    city: 'Barbalha',
    state: 'CE',
    description: genericDescription(1),
    imageFile: 'madre-de-deus-residencial.jpg',
  },
  {
    name: 'Vale do Cariri',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: 'Loteamento com ampla área e potencial de valorização',
    imageFile: 'vale-do-cariri.jpg',
  },
  {
    name: 'O Conviver Riviera',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: genericDescription(2),
    imageFile: 'o-conviver-riviera.jpg',
  },
  {
    name: 'Terras Araruna',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: genericDescription(3),
    imageFile: 'terras-araruna.jpg',
  },
  {
    name: 'Cidade Luz',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: 'Loteamento planejado com infraestrutura urbana',
    imageFile: 'cidade-luz.jpg',
  },
  {
    name: 'Conviver Lagoa Seca',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: 'Lançamento com ótima proposta para moradia',
    imageFile: 'conviver-lagoa-seca.jpg',
  },
  {
    name: 'Arte Residence 3',
    city: 'Barbalha',
    state: 'CE',
    description: 'Loteamento com acesso asfaltado e boa localização',
    imageFile: 'art-residence-3.jpg',
  },
  {
    name: 'Art Residence 2',
    city: 'Barbalha',
    state: 'CE',
    description: genericDescription(0),
    imageFile: 'art-residence-2.jpg',
  },
  {
    name: 'Lagoa Seca 3',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: genericDescription(1),
    imageFile: 'lagoa-seca-3.jpg',
  },
  {
    name: 'Lagoa Seca 1 e 2',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: genericDescription(2),
    imageFile: 'lagoa-seca-1-e-2.jpg',
  },
  {
    name: 'Jardim das Araçás',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: 'Loteamento com ótima localização e fácil acesso',
    imageFile: 'jardim-aracas.jpg',
  },
  {
    name: 'Conquista Aeroporto',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: 'Próximo ao aeroporto, ideal para investimento',
    imageFile: 'conquista.jpg',
  },
  {
    name: 'Imaculada Conceição',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: genericDescription(3),
    imageFile: 'imaculada-conceicao.jpg',
  },
  {
    name: 'Barão do Araruna',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: 'Loteamento com proposta moderna para morar ou investir',
    imageFile: 'barao-araruna.jpg',
  },
  {
    name: 'Sol Nascente',
    city: 'Crato',
    state: 'CE',
    description: 'Loteamento com ótima valorização e alta procura',
    imageFile: 'sol-nascente.jpg',
  },
  {
    name: 'Matriz do Juá',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: genericDescription(0),
    imageFile: 'matriz-do-jua.jpg',
  },
  {
    name: 'Jardins dos Ipês',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: 'Lotes a partir de 200m² com boa localização',
    imageFile: 'jardins-ipes.jpg',
  },
  {
    name: 'Grã Village Juazeiro',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: genericDescription(1),
    imageFile: 'gra-village-juazeiro.jpg',
  },
  {
    name: 'Art Residence 4',
    city: 'Barbalha',
    state: 'CE',
    description: genericDescription(2),
    imageFile: 'art-residence-4.jpg',
  },
  {
    name: 'Santa Amélia',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: genericDescription(3),
    imageFile: 'santa-amelia.jpg',
  },
  {
    name: 'Portal dos Municípios',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: genericDescription(0),
    imageFile: 'portal-dos-municipios.jpg',
  },
  {
    name: 'Desmembramento João Landim',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: genericDescription(1),
    imageFile: 'desmembramento-joao-landim.jpg',
  },
  {
    name: 'Boa Vista',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: genericDescription(2),
    imageFile: 'boa-vista.jpg',
  },
  {
    name: 'Canaã',
    city: 'Juazeiro do Norte',
    state: 'CE',
    description: genericDescription(3),
    imageFile: 'canaa.jpg',
  },
];
