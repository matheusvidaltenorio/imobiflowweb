/**
 * Geração determinística de anúncios Instagram (feed, story, reel, carrossel, patrocínio, ponte WhatsApp).
 * Camada pura — sem Prisma. Ajuste textos e regras aqui.
 */

export type InstagramAdScope = 'LOT' | 'DEVELOPMENT';

export type InstagramAdObjective =
  | 'CAPTAR_LEADS'
  | 'WHATSAPP'
  | 'DESTACAR_CAMPEAO'
  | 'REATIVAR_ENCALHADO'
  | 'LANCAMENTO'
  | 'OPORTUNIDADE'
  | 'CONDICAO_ESPECIAL'
  | 'LOCALIZACAO'
  | 'VISITA'
  | 'AUTO';

export type InstagramAdTone =
  | 'PROFISSIONAL'
  | 'CONSULTIVO'
  | 'PERSUASIVO'
  | 'PREMIUM'
  | 'POPULAR'
  | 'URGENTE_SUAVE'
  | 'AUTO';

export type InstagramContentType =
  | 'FEED'
  | 'STORY'
  | 'REEL'
  | 'CARROSSEL'
  | 'ANUNCIO_PATROCINADO'
  | 'WHATSAPP_BRIDGE';

export type InstagramAdContext = {
  scope: InstagramAdScope;
  developmentName: string;
  city: string;
  state?: string | null;
  neighborhood?: string | null;
  developmentDescription?: string | null;
  address?: string | null;
  lotNumber?: string;
  blockName?: string;
  areaM2?: number | null;
  priceBrl?: number | null;
  status: string;
  saleScore?: number | null;
  saleClassification?: string | null;
  saleScoreReason?: string | null;
  commercialTags: string[];
  belowMedianPrice: boolean;
  suggestedRankAction?: string;
  leadName?: string;
  closingScore?: number | null;
  closingPrediction?: string | null;
  closingNextAction?: string | null;
};

export type InstagramVariation = {
  label: string;
  headline: string;
  feedCaption: string;
  storyText: string;
  reelScript: { hook: string; body: string; closing: string };
  carouselSlides: string[];
  sponsoredText: string;
  whatsappBridge: string;
  cta: string;
  hashtags: string;
  keyArguments: string[];
};

export type InstagramAdPack = {
  scope: InstagramAdScope;
  resolvedObjective: InstagramAdObjective;
  resolvedTone: InstagramAdTone;
  strategicJustification: string;
  visualBullets: string[];
  extraHooks: string[];
  extraCTAs: string[];
  variations: InstagramVariation[];
  /** Camada futura: publicação Meta — hoje sempre null */
  publishing: { ready: false; note: string };
};

function fmtMoney(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function loc(ctx: InstagramAdContext): string {
  const p = [ctx.developmentName, ctx.city, ctx.state].filter(Boolean);
  return p.join(' · ');
}

function lotRef(ctx: InstagramAdContext): string {
  if (ctx.scope === 'DEVELOPMENT') return ctx.developmentName;
  return `Lote ${ctx.lotNumber ?? '—'} · Quadra ${ctx.blockName ?? '—'}`;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export function resolveObjective(
  ctx: InstagramAdContext,
  requested: InstagramAdObjective,
): InstagramAdObjective {
  if (requested !== 'AUTO') return requested;
  if (ctx.commercialTags.includes('CAMPEAO_VENDA')) return 'DESTACAR_CAMPEAO';
  if (ctx.commercialTags.includes('NECESITA_ATENCAO_COMERCIAL')) return 'REATIVAR_ENCALHADO';
  if (ctx.commercialTags.includes('BAIXA_CONVERSAO')) return 'OPORTUNIDADE';
  if (ctx.closingScore != null && ctx.closingScore >= 72) return 'VISITA';
  if (ctx.belowMedianPrice) return 'OPORTUNIDADE';
  return 'CAPTAR_LEADS';
}

export function resolveTone(ctx: InstagramAdContext, requested: InstagramAdTone): InstagramAdTone {
  if (requested !== 'AUTO') return requested;
  if (ctx.commercialTags.includes('CAMPEAO_VENDA')) return 'PERSUASIVO';
  if (ctx.commercialTags.includes('NECESITA_ATENCAO_COMERCIAL')) return 'CONSULTIVO';
  if (ctx.commercialTags.includes('BAIXA_CONVERSAO')) return 'CONSULTIVO';
  if (!ctx.belowMedianPrice && (ctx.saleScore ?? 0) >= 70) return 'PREMIUM';
  return 'PROFISSIONAL';
}

function objectivePhrase(obj: InstagramAdObjective, seed: number): string {
  const m: Record<InstagramAdObjective, string[]> = {
    CAPTAR_LEADS: ['Ideal para quem busca um terreno com projeto de vida ou investimento.'],
    WHATSAPP: ['Quer valores e condições rápidas? Falo com você no WhatsApp.'],
    DESTACAR_CAMPEAO: ['Entre as melhores oportunidades do portfólio no momento.'],
    REATIVAR_ENCALHADO: ['Uma nova leitura de valor: condições para retomar o interesse.'],
    LANCAMENTO: ['Empreendimento em destaque na região.'],
    OPORTUNIDADE: ['Custo-benefício que merece atenção.'],
    CONDICAO_ESPECIAL: ['Condições comerciais sob consulta — vale conversar.'],
    LOCALIZACAO: ['Localização estratégica dentro do loteamento.'],
    VISITA: ['Perfeito para agendar uma visita e sentir o terreno.'],
    AUTO: [''],
  };
  return pick(m[obj] ?? m.CAPTAR_LEADS, seed);
}

function buildStrategicNote(
  ctx: InstagramAdContext,
  obj: InstagramAdObjective,
  tone: InstagramAdTone,
): string {
  const parts: string[] = [];
  parts.push(
    `Copy alinhada ao objetivo ${obj.replace(/_/g, ' ').toLowerCase()} e tom ${tone.toLowerCase().replace(/_/g, ' ')}.`,
  );
  if (ctx.commercialTags.includes('CAMPEAO_VENDA')) {
    parts.push('Destaque de campeão de venda: narrativa mais direta e CTA forte.');
  } else if (ctx.commercialTags.includes('NECESITA_ATENCAO_COMERCIAL')) {
    parts.push('Lote com sinais de estoque: foco em oportunidade e novo ângulo de valor.');
  } else if (ctx.belowMedianPrice) {
    parts.push('Preço competitivo frente à mediana do empreendimento.');
  }
  if (ctx.closingScore != null && ctx.closingScore >= 65) {
    parts.push('Contexto de lead com boa previsão de fechamento: CTA puxado para visita ou próximo passo.');
  }
  if (ctx.saleScoreReason) {
    parts.push(`Inteligência do ranking: ${ctx.saleScoreReason.slice(0, 160)}${ctx.saleScoreReason.length > 160 ? '…' : ''}`);
  }
  return parts.join(' ');
}

function buildHashtags(ctx: InstagramAdContext, seed: number): string {
  const slug = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 22)
      .toLowerCase();
  const pool = [
    'loteamento',
    'terreno',
    'imoveis',
    'investimento',
    'corretordeimoveis',
    'empreendimento',
    slug(ctx.city) || 'brasil',
    slug(ctx.developmentName),
    ctx.commercialTags.includes('CAMPEAO_VENDA') ? 'oportunidade' : 'lote',
  ].filter(Boolean);
  const uniq = [...new Set(pool)].slice(0, 8);
  return uniq.map((t) => `#${t}`).join(' ');
}

function keyArguments(ctx: InstagramAdContext): string[] {
  const out: string[] = [];
  if (ctx.areaM2 != null) out.push(`Metragem: ${ctx.areaM2} m²`);
  if (ctx.priceBrl != null) out.push(`Investimento a partir de ${fmtMoney(ctx.priceBrl)}`);
  out.push(`Local: ${loc(ctx)}`);
  if (ctx.saleScore != null) out.push(`Score comercial: ${Math.round(ctx.saleScore)}`);
  if (ctx.belowMedianPrice) out.push('Preço atrativo frente à média do empreendimento');
  if (ctx.commercialTags.includes('CAMPEAO_VENDA')) out.push('Alto potencial de saída (campeão de venda)');
  if (ctx.suggestedRankAction) out.push(ctx.suggestedRankAction);
  return out.slice(0, 7);
}

function carouselSlides(ctx: InstagramAdContext, obj: InstagramAdObjective, seed: number): string[] {
  const hook = pick(
    [
      `Por que falar desse ${ctx.scope === 'LOT' ? 'lote' : 'empreendimento'} hoje?`,
      `Um cenário que combina com seu próximo passo.`,
      `Se você pesquisa terreno na região, anota esse nome.`,
    ],
    seed,
  );
  const lotLine =
    ctx.scope === 'LOT'
      ? `Lote ${ctx.lotNumber} · Quadra ${ctx.blockName}\n${ctx.areaM2 != null ? `${ctx.areaM2} m²` : 'Metragem sob consulta'}${ctx.priceBrl != null ? ` · ${fmtMoney(ctx.priceBrl)}` : ''}`
      : `${ctx.developmentName}\n${ctx.city}${ctx.state ? ` · ${ctx.state}` : ''}`;
  const benefit = objectivePhrase(obj, seed + 1);
  const locSlide =
    ctx.address || ctx.neighborhood
      ? `Referência: ${[ctx.neighborhood, ctx.address].filter(Boolean).join(' · ')}`
      : `Região: ${ctx.city}`;
  const cta = pick(
    [
      'Chama no direct ou WhatsApp e receba detalhes.',
      'Quer planta, mapa e condições? Me chama.',
      'Agenda uma visita e conhece o loteamento.',
    ],
    seed + 2,
  );
  return [hook, lotLine, benefit, locSlide, cta];
}

function oneVariation(
  ctx: InstagramAdContext,
  obj: InstagramAdObjective,
  tone: InstagramAdTone,
  style: 'objetiva' | 'consultiva' | 'persuasiva',
  seed: number,
): InstagramVariation {
  const lr = lotRef(ctx);
  const place = loc(ctx);
  const priceLine =
    ctx.priceBrl != null ? `Valores a partir de ${fmtMoney(ctx.priceBrl)}.` : 'Valores e condições sob consulta.';
  const areaLine = ctx.areaM2 != null ? `${ctx.areaM2} m²` : 'Metragem para você avaliar com calma';

  let headline: string;
  let feed: string;
  let story: string;
  let hook: string;
  let body: string;
  let closing: string;
  let cta: string;

  const toneAdj = pick(
    {
      PROFISSIONAL: ['consistente', 'estruturado', 'bem posicionado'],
      CONSULTIVO: ['interessante para comparar', 'que vale uma conversa', 'para avaliar com critério'],
      PERSUASIVO: ['que chama atenção', 'com timing favorável', 'para quem quer decidir'],
      PREMIUM: ['com padrão elevado', 'selecionado', 'com diferencial'],
      POPULAR: ['acessível', 'direto', 'sem enrolação'],
      URGENTE_SUAVE: ['com boa movimentação', 'em destaque agora', 'que merece prioridade na agenda'],
      AUTO: ['interessante'],
    }[tone] ?? ['interessante'],
    seed,
  );

  if (style === 'objetiva') {
    headline = `${lr} — ${ctx.developmentName} (${ctx.city})`;
    feed = `${headline}\n\n${ctx.scope === 'LOT' ? `Status: ${ctx.status}. ${areaLine}. ${priceLine}` : `Empreendimento em ${ctx.city}. ${ctx.developmentDescription?.slice(0, 200) ?? 'Projeto com infraestrutura de loteamento.'}`}\n\n${objectivePhrase(obj, seed)}\n\n${ctx.saleClassification ? `Destaque comercial: ${ctx.saleClassification}.\n` : ''}${ctx.suggestedRankAction ? `${ctx.suggestedRankAction}\n` : ''}`;
    story = `${lr}\n${place}\n${ctx.priceBrl != null ? fmtMoney(ctx.priceBrl) : 'Consulte valores'}\n→ Direct ou WhatsApp`;
    hook = pick(
      [
        `Se você busca terreno ${toneAdj}, esse recado é para você.`,
        `Um ${ctx.scope === 'LOT' ? 'lote' : 'loteamento'} ${toneAdj} em ${ctx.city}.`,
      ],
      seed,
    );
    body = `${lr}. ${areaLine}. ${priceLine} ${objectivePhrase(obj, seed + 3)}`;
    closing = `Quer a ficha completa? Chama no WhatsApp com o número do lote.`;
    cta = 'WhatsApp · solicitar detalhes';
  } else if (style === 'consultiva') {
    headline = `Vale conhecer: ${lr}`;
    feed = `Está comparando opções em ${ctx.city}? ${lr} pode ser um bom nome para colocar na lista.\n\n${priceLine}\n${areaLine !== 'Metragem para você avaliar com calma' ? `Metragem: ${areaLine}.\n` : ''}\n${objectivePhrase(obj, seed)}\n\n${ctx.saleScoreReason ? `Por que o ranking comercial aponta atenção: ${ctx.saleScoreReason.slice(0, 280)}${ctx.saleScoreReason.length > 280 ? '…' : ''}\n\n` : ''}Posso te enviar mapa, condições e comparativos — sem compromisso.`;
    story = `Comparando terrenos?\n${lr}\n${place}\nMe chama no direct`;
    hook = pick(
      [
        'Antes de decidir, olha essa combinação de local + proposta.',
        'Se você gosta de comparar com critério, esse caso merece um minuto.',
      ],
      seed,
    );
    body = `${lr} em ${ctx.developmentName}. ${objectivePhrase(obj, seed + 1)} Posso te ajudar a cruzar com seu perfil.`;
    closing = 'Quer uma segunda opinião profissional? Conversa comigo.';
    cta = 'Pedir comparativo no WhatsApp';
  } else {
    headline = pick(
      [
        `Oportunidade em ${ctx.developmentName}`,
        `${ctx.city}: terreno ${toneAdj}`,
        `Momento de olhar para ${lr}`,
      ],
      seed,
    );
    feed = `${headline}\n\n${lr} — ${place}.\n\n${ctx.scope === 'LOT' ? `${areaLine}. ${priceLine}` : (ctx.developmentDescription?.slice(0, 220) ?? 'Loteamento com proposta clara para quem quer construir ou investir.')}\n\n${objectivePhrase(obj, seed + 2)}\n\n${ctx.commercialTags.includes('CAMPEAO_VENDA') ? 'Destaque do ranking: alta aderência de mercado.\n' : ''}${ctx.closingNextAction ? `Próximo passo sugerido: ${ctx.closingNextAction}\n` : ''}\nNão deixa para depois: estoque muda rápido.`;
    story = `${headline}\n${lr}\n${ctx.priceBrl != null ? fmtMoney(ctx.priceBrl) : 'Consulte'}\nDirect`;
    hook = pick(
      [
        'Se você procura lote com potencial, presta atenção nisso.',
        'Essa pode ser a oportunidade que faltava na sua busca.',
        'Terreno bem posicionado com narrativa comercial forte.',
      ],
      seed,
    );
    body = `${lr} em ${ctx.developmentName}. ${objectivePhrase(obj, seed)} ${ctx.belowMedianPrice ? 'Proposta competitiva frente à média. ' : ''}`;
    closing = pick(
      [
        'Quer localização no mapa e valores fechados? Me chama agora.',
        'Chama no WhatsApp e fechamos os próximos passos.',
        'Agenda visita ou pede o dossiê — eu te respondo rápido.',
      ],
      seed + 4,
    );
    cta = pick(
      ['Chamar no WhatsApp', 'Agendar visita', 'Pedir localização e valores'],
      seed + 5,
    );
  }

  const sponsored = `${headline}\n${lr} · ${ctx.city}. ${ctx.priceBrl != null ? fmtMoney(ctx.priceBrl) : 'Consulte valores'}. CTA: mensagem ou WhatsApp. Público: interessados em terreno/loteamento na região.`;
  const wa = pick(
    [
      `Oi! Vi seu anúncio no Instagram sobre ${lr} (${ctx.developmentName}). Pode me enviar mapa, valores e condições?`,
      `Olá! Quero saber mais sobre ${lr} em ${ctx.developmentName}, ${ctx.city}.`,
    ],
    seed,
  );

  return {
    label: style === 'objetiva' ? 'Versão objetiva' : style === 'consultiva' ? 'Versão consultiva' : 'Versão persuasiva',
    headline,
    feedCaption: feed.trim(),
    storyText: story.trim(),
    reelScript: { hook, body: body.trim(), closing: closing.trim() },
    carouselSlides: carouselSlides(ctx, obj, seed + 7),
    sponsoredText: sponsored,
    whatsappBridge: wa,
    cta,
    hashtags: buildHashtags(ctx, seed + 9),
    keyArguments: keyArguments(ctx),
  };
}

export function generateInstagramAdPack(
  ctx: InstagramAdContext,
  contentType: InstagramContentType,
  objectiveIn: InstagramAdObjective,
  toneIn: InstagramAdTone,
  seed: number,
): InstagramAdPack {
  const resolvedObjective = resolveObjective(ctx, objectiveIn);
  const resolvedTone = resolveTone(ctx, toneIn);
  const strategicJustification = buildStrategicNote(ctx, resolvedObjective, resolvedTone);

  const variations: InstagramVariation[] = [
    oneVariation(ctx, resolvedObjective, resolvedTone, 'objetiva', seed),
    oneVariation(ctx, resolvedObjective, resolvedTone, 'consultiva', seed + 11),
    oneVariation(ctx, resolvedObjective, resolvedTone, 'persuasiva', seed + 23),
  ];

  const extraHooks = [
    pick(
      [
        'Se você procura lote com potencial, olha isso.',
        'Essa pode ser a oportunidade que você estava esperando.',
        'Terreno bem posicionado e com ótima proposta comercial.',
      ],
      seed,
    ),
    pick(
      [
        'Um recado rápido para quem acompanha o mercado de terrenos.',
        'Dá um print e manda para quem está buscando lote.',
      ],
      seed + 1,
    ),
    pick(
      [
        'Localização + metragem + condição comercial — tudo na conversa.',
        'Quer sentir o terreno? Vamos agendar.',
      ],
      seed + 2,
    ),
  ];

  const extraCTAs = [
    'Chamar no WhatsApp',
    'Pedir localização no mapa',
    'Solicitar condições e simulação',
    'Agendar visita ao loteamento',
    'Receber dossie por PDF',
  ];

  const visualBullets = keyArguments(ctx);

  void contentType;
  return {
    scope: ctx.scope,
    resolvedObjective,
    resolvedTone,
    strategicJustification,
    visualBullets,
    extraHooks,
    extraCTAs,
    variations,
    publishing: {
      ready: false,
      note:
        'Publicação automática no Instagram não está ativa. Use cópia manual. Futuro: Instagram Graph API (containers de mídia + publish).',
    },
  };
}
