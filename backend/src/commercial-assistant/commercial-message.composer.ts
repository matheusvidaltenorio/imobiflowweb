import type {
  CommercialMessageContext,
  CommercialMessageType,
  CommercialTone,
  ComposedSuggestion,
  LeadMessageBundle,
  LotPitchBundle,
} from './commercial-assistant.types';

const TYPE_LABELS: Record<CommercialMessageType, string> = {
  PRIMEIRO_CONTATO: 'Primeiro contato',
  FOLLOW_UP: 'Follow-up',
  VISITA: 'Agendamento / confirmação de visita',
  OPORTUNIDADE: 'Apresentação de oportunidade',
  RETOMADA: 'Retomada de conversa',
  URGENCIA: 'Urgência comercial (equilibrada)',
  POS_VISITA: 'Pós-visita',
  NEGOCIACAO: 'Negociação',
  REATIVACAO_ENCALHADO: 'Reativação (lote com baixa conversão)',
};

function pickVariant(seed: number, options: string[]): string {
  if (!options.length) return '';
  return options[Math.abs(seed) % options.length];
}

function basePlaceholders(ctx: CommercialMessageContext): Record<string, string> {
  const nome = ctx.lead?.firstName?.trim() || '';
  const lot = ctx.lot;
  const prop = ctx.property;
  return {
    nome: nome || 'tudo bem',
    lote: lot?.number ?? '',
    quadra: lot?.blockName ?? '',
    loteamento: lot?.developmentName ?? '',
    cidade: lot?.city ? ` em ${lot.city}` : '',
    preco: lot?.priceText ?? prop?.priceText ?? '',
    area: lot?.areaText ?? '',
    classificacao: lot?.saleClassification ?? '',
    motivoScore: lot?.saleScoreReason ? lot.saleScoreReason.slice(0, 120) : 'bom posicionamento no empreendimento',
    imovel: prop?.title ?? 'imóvel',
  };
}

function applyTemplate(tpl: string, ctx: CommercialMessageContext): string {
  const ph = basePlaceholders(ctx);
  return tpl.replace(/\{(\w+)\}/g, (_, k) => ph[k] ?? '');
}

/** Escolhe o tipo principal de abordagem com base no funil, ranking e visitas. */
export function decidePrimaryType(ctx: CommercialMessageContext): CommercialMessageType {
  const st = ctx.lead?.status ?? 'NOVO_LEAD';
  const days = ctx.lead?.daysSinceLastInteraction ?? 0;
  const lot = ctx.lot;
  const cs = ctx.lead?.closingScore;

  if (cs != null && cs >= 78 && (st === 'PROPOSTA_ENVIADA' || st === 'RESERVADO')) {
    return 'NEGOCIACAO';
  }
  if (cs != null && cs <= 34 && days >= 5) {
    return 'RETOMADA';
  }
  if (cs != null && ctx.lead?.closingTrend === 'down' && cs < 55 && days >= 4) {
    return 'FOLLOW_UP';
  }

  if (ctx.hasUpcomingVisit) return 'VISITA';
  if (ctx.hadRecentCompletedVisit && (st === 'EM_ATENDIMENTO' || st === 'PROPOSTA_ENVIADA' || st === 'VISITA_AGENDADA')) {
    return 'POS_VISITA';
  }
  if (st === 'PROPOSTA_ENVIADA' || st === 'RESERVADO') return 'NEGOCIACAO';
  if (lot?.tags.includes('NECESITA_ATENCAO_COMERCIAL') && days >= 4) {
    return 'REATIVACAO_ENCALHADO';
  }
  if (days >= 14) return 'RETOMADA';
  if (days >= 6) return 'FOLLOW_UP';
  if (lot?.tags.includes('CAMPEAO_VENDA') && ctx.lead?.isHot) return 'OPORTUNIDADE';
  if (lot?.belowMedianPrice || lot?.tags.includes('CAMPEAO_VENDA')) return 'OPORTUNIDADE';
  if (
    lot &&
    lot.status === 'DISPONIVEL' &&
    lot.viewCount >= 8 &&
    lot.contactCount >= 2 &&
    (lot.saleScore ?? 0) >= 62
  ) {
    return 'URGENCIA';
  }
  if (st === 'NOVO_LEAD') return 'PRIMEIRO_CONTATO';
  if (st === 'EM_ATENDIMENTO' || st === 'VISITA_AGENDADA') return 'VISITA';
  return 'FOLLOW_UP';
}

function recommendTone(type: CommercialMessageType, ctx: CommercialMessageContext): CommercialTone {
  if (type === 'RETOMADA' || type === 'FOLLOW_UP' || type === 'REATIVACAO_ENCALHADO') {
    return 'CONSULTIVO';
  }
  if (type === 'NEGOCIACAO' || type === 'POS_VISITA' || type === 'VISITA') return 'OBJETIVO';
  if (ctx.lead?.isHot && (type === 'OPORTUNIDADE' || type === 'URGENCIA')) return 'PERSUASIVO';
  if (type === 'URGENCIA' || type === 'OPORTUNIDADE') return 'PERSUASIVO';
  return 'CONSULTIVO';
}

function contactTiming(ctx: CommercialMessageContext): string {
  if (ctx.lead?.closingScore != null && ctx.lead.closingScore >= 75) {
    return 'Alta probabilidade de fechamento — priorizar contato hoje';
  }
  if (ctx.lead?.isHot) return 'Prioridade alta — contatar hoje';
  if ((ctx.lead?.daysSinceLastInteraction ?? 0) >= 12) {
    return 'Lead parado: retomar hoje ou amanhã cedo';
  }
  if ((ctx.lead?.daysSinceLastInteraction ?? 0) >= 5) {
    return 'Bom momento para follow-up leve';
  }
  if (ctx.hasUpcomingVisit) return 'Reforçar confirmação antes da visita';
  return 'Bom momento para contato hoje';
}

function nextAction(type: CommercialMessageType): string {
  const m: Record<CommercialMessageType, string> = {
    PRIMEIRO_CONTATO: 'Enviar mensagem de acolhimento e apresentar o lote',
    FOLLOW_UP: 'Retomar conversa sem pressão',
    VISITA: 'Confirmar ou convidar para visita',
    OPORTUNIDADE: 'Apresentar argumentos do ranking e convidar ao próximo passo',
    RETOMADA: 'Reabrir diálogo com novo gancho',
    URGENCIA: 'Comunicar movimento do mercado com responsabilidade',
    POS_VISITA: 'Coletar percepção e avançar negociação',
    NEGOCIACAO: 'Manter engajamento rumo à proposta',
    REATIVACAO_ENCALHADO: 'Mudar narrativa (custo-benefício / condições)',
  };
  return m[type];
}

function strategySummary(type: CommercialMessageType, ctx: CommercialMessageContext): string {
  const lot = ctx.lot;
  const parts: string[] = [];
  parts.push(`Foco: ${TYPE_LABELS[type]}.`);
  if (lot?.tags.includes('CAMPEAO_VENDA')) {
    parts.push('O lote está entre os melhores do ranking — use isso como prova social leve.');
  }
  if (lot?.belowMedianPrice) {
    parts.push('Preço abaixo da média do loteamento — destaque custo-benefício.');
  }
  if (lot?.tags.includes('NECESITA_ATENCAO_COMERCIAL')) {
    parts.push('Lote com baixa conversão: evite pressa; traga valor e flexibilidade de conversa.');
  }
  if (ctx.lead?.isHot) {
    parts.push('Lead quente: pode avançar convite de visita ou próximo passo.');
  }
  if ((ctx.lead?.daysSinceLastInteraction ?? 0) >= 10) {
    parts.push('Há dias sem interação — mensagem consultiva funciona melhor.');
  }
  return parts.join(' ');
}

function buildLotSummary(ctx: CommercialMessageContext): string[] {
  const lot = ctx.lot;
  if (!lot) return [];
  const lines: string[] = [
    `${lot.developmentName} — Lote ${lot.number}, quadra ${lot.blockName}`,
    `Preço: ${lot.priceText} · ${lot.areaText}`,
  ];
  if (lot.saleScore != null) {
    lines.push(`Score comercial: ${Math.round(lot.saleScore)} (${lot.saleClassification ?? '—'})`);
  }
  if (lot.saleScoreReason) {
    lines.push(`Resumo: ${lot.saleScoreReason.slice(0, 160)}${lot.saleScoreReason.length > 160 ? '…' : ''}`);
  }
  return lines;
}

function buildArguments(ctx: CommercialMessageContext): string[] {
  const lot = ctx.lot;
  if (!lot) return [];
  const a: string[] = [];
  if (lot.belowMedianPrice) a.push('Preço competitivo em relação à média do empreendimento');
  if (lot.tags.includes('CAMPEAO_VENDA')) {
    a.push('Destaque no ranking comercial (alta prioridade de venda)');
  }
  if (lot.areaText) a.push(`Metragem ${lot.areaText} — boa flexibilidade para projeto`);
  if (lot.contactCount >= 2 || lot.viewCount >= 6) {
    a.push('Interesse recorrente de outros compradores no empreendimento');
  }
  if (lot.saleScore != null && lot.saleScore >= 70) {
    a.push(`Classificação: ${lot.saleClassification ?? 'alto potencial'}`);
  }
  if (a.length === 0) {
    a.push('Lote disponível no loteamento com condições alinhadas ao mercado local');
  }
  return a.slice(0, 5);
}

/** Mensagens para lead + lote (ou imóvel legado). */
function composeToneForType(
  type: CommercialMessageType,
  tone: CommercialTone,
  ctx: CommercialMessageContext,
  index: number,
): ComposedSuggestion {
  const seed = ctx.variantSeed + index * 17 + tone.length;
  const hasLot = !!ctx.lot;
  const hasPerson = !!ctx.lead?.firstName;

  const open = hasPerson ? (pickVariant(seed, ['Oi, {nome}!', 'Olá, {nome}!', 'Oi {nome}, tudo bem?']) + ' ') : pickVariant(seed, ['Oi!', 'Olá!', 'Oi, tudo bem?']) + ' ';

  let message = '';
  let justification = '';

  if (!hasLot && ctx.property) {
    const base =
      tone === 'OBJETIVO'
        ? `${open}Vi seu interesse no imóvel {imovel} ({preco}). Posso te passar mais detalhes e próximos passos?`
        : tone === 'CONSULTIVO'
          ? `${open}Queria retomar seu interesse no {imovel}. Posso te ajudar com dúvidas e agenda para conhecer?`
          : `${open}Separei um momento para falar do {imovel} — é uma opção que está com boa procura. Quer que eu te envie os detalhes?`;
    message = applyTemplate(base, ctx);
    justification =
      'Sem lote vinculado: mensagem focada no imóvel cadastrado e próximo passo de atendimento.';
    return { tone, message: message.trim(), justification };
  }

  switch (type) {
    case 'PRIMEIRO_CONTATO': {
      if (tone === 'OBJETIVO') {
        message = applyTemplate(
          `${open}Sou da equipe comercial do {loteamento}. Vi seu interesse no lote {lote}, quadra {quadra}{cidade}. É {preco}, {area}. Posso te enviar planta do empreendimento e combinar uma visita?`,
          ctx,
        );
        justification =
          'Primeiro contato direto: apresenta empreendimento, lote e convite claro para visita.';
      } else if (tone === 'CONSULTIVO') {
        message = applyTemplate(
          `${open}Obrigado pelo interesse no lote {lote} (quadra {quadra}) no {loteamento}. Pelo que você busca, essa unidade tem boa relação entre metragem ({area}) e investimento ({preco}). Quer que eu te explique melhor e já vejamos uma data para conhecer?`,
          ctx,
        );
        justification =
          'Tom consultivo: valida interesse e posiciona metragem/preço sem apelos forçados.';
      } else {
        message = applyTemplate(
          `${open}Separei o lote {lote}, quadra {quadra}, no {loteamento} — está entre as opções mais equilibradas do momento ({preco}, {area}). Se fizer sentido, já deixo uma visita encaminhada para você ver o terreno. Posso?`,
          ctx,
        );
        justification =
          'Tom mais comercial: reforça oportunidade com linguagem natural e convite à ação.';
      }
      break;
    }
    case 'FOLLOW_UP': {
      if (tone === 'OBJETIVO') {
        message = applyTemplate(
          `${open}Passando para saber se ainda faz sentido o lote {lote} no {loteamento} ({preco}). Posso te mandar um resumo rápido?`,
          ctx,
        );
        justification = 'Follow-up curto: retoma tema sem cobrar resposta.';
      } else if (tone === 'CONSULTIVO') {
        message = applyTemplate(
          `${open}Sei que a correria aperta — queria só retomar o lote {lote}, quadra {quadra}. Se quiser, te mando em uma mensagem os pontos principais e você me diz se faz sentido seguir.`,
          ctx,
        );
        justification = 'Consultivo: reconhece ausência de resposta e oferece facilitador.';
      } else {
        message = applyTemplate(
          `${open}O lote {lote} no {loteamento} segue disponível e continua bem cotado internamente ({classificacao}). Quer que eu reserve um horário para você conhecer antes de decidir?`,
          ctx,
        );
        justification = 'Leve senso de oportunidade usando classificação comercial real do sistema.';
      }
      break;
    }
    case 'VISITA': {
      const when = ctx.upcomingVisitLabel
        ? ` sobre nosso combinado (${ctx.upcomingVisitLabel})`
        : '';
      if (tone === 'OBJETIVO') {
        message = applyTemplate(
          `${open}Só confirmando a visita${when} ao lote {lote}, quadra {quadra}, {loteamento}. Alguma dúvida de endereço ou horário?`,
          ctx,
        );
        justification = 'Confirmação objetiva quando há visita agendada.';
      } else if (tone === 'CONSULTIVO') {
        message = applyTemplate(
          `${open}Queria alinhar a visita ao lote {lote} no {loteamento}. Prefere manter o horário ou ajustamos? Posso te mandar o ponto de encontro.`,
          ctx,
        );
        justification = 'Convite flexível para agendar ou ajustar visita.';
      } else {
        message = applyTemplate(
          `${open}Visitar o {lote} na {quadra} costuma fechar muitas dúvidas — o terreno fala por si. Posso confirmar contigo${when}?`,
          ctx,
        );
        justification = 'Persuasivo suave: valoriza experiência presencial.';
      }
      break;
    }
    case 'OPORTUNIDADE': {
      const rankHint = ctx.lot?.tags.includes('CAMPEAO_VENDA')
        ? ' Está entre as melhores oportunidades do nosso ranking agora.'
        : '';
      if (tone === 'OBJETIVO') {
        message =
          applyTemplate(
            `${open}O lote {lote}, quadra {quadra}, no {loteamento}, está {preco} ({area}).`,
            ctx,
          ) +
          rankHint +
          ' Quer receber o resumo e avaliar visita?';
        justification =
          'Argumenta com dados do lote + ranking quando o lote é campeão ou bem posicionado.';
      } else if (tone === 'CONSULTIVO') {
        message =
          applyTemplate(
            `${open}Revendo opções, o lote {lote} no {loteamento} aparece com ótimo custo-benefício ({preco}, {area}).`,
            ctx,
          ) +
          rankHint +
          ' Posso te explicar o porquê em dois minutos no WhatsApp?';
        justification = 'Consultivo: convida explicação sem pressão.';
      } else {
        message =
          applyTemplate(
            `${open}Esse lote {lote}/quadra {quadra} no {loteamento} está chamando atenção na equipe — {motivoScore}.`,
            ctx,
          ) +
          rankHint +
          ' Se quiser, já encaixo uma visita essa semana.';
        justification = 'Usa motivo do score comercial como gancho autêntico.';
      }
      break;
    }
    case 'RETOMADA': {
      if (tone === 'OBJETIVO') {
        message = applyTemplate(
          `${open}Faz um tempo que não conversamos sobre o lote {lote} no {loteamento}. Ainda faz sentido para você?`,
          ctx,
        );
        justification = 'Retomada direta por inatividade prolongada.';
      } else if (tone === 'CONSULTIVO') {
        message = applyTemplate(
          `${open}Sem pressão nenhuma: queria só saber se você ainda considera o lote {lote} ({loteamento}). Se não for o momento, me avisa que eu respeito — se for, te atualizo o que mudou.`,
          ctx,
        );
        justification = 'Retomada leve, explícita em não ser insistente.';
      } else {
        message = applyTemplate(
          `${open}Atualizei algumas condições no {loteamento} e o lote {lote} segue uma peça interessante ({preco}). Vale um “sim” ou “não” para eu te mandar o resumo?`,
          ctx,
        );
        justification = 'Convite binário simples para reengajar.';
      }
      break;
    }
    case 'URGENCIA': {
      const soft = pickVariant(seed, [
        'tem movimentação boa de consultas',
        'outros clientes também perguntaram por lotes nessa faixa',
        'o empreendimento está com ritmo positivo de visitas',
      ]);
      if (tone === 'OBJETIVO') {
        message =
          applyTemplate(`${open}Só um heads up: o lote {lote} no {loteamento} `, ctx) +
          soft +
          '. Se quiser segurar conversa, posso te passar o status certinho.';
        justification =
          'Urgência responsável: fala de movimento sem inventar escassez artificial.';
      } else if (tone === 'CONSULTIVO') {
        message = applyTemplate(
          `${open}O lote {lote} ({loteamento}) está com interesse relevante — não para pressionar, mas para você decidir com informação. Quer um panorama rápido?`,
          ctx,
        );
        justification = 'Transparência + convite a decidir com dados.';
      } else {
        message = applyTemplate(
          `${open}O {lote} na {quadra} está entre os mais procurados agora ({classificacao}). Se fizer sentido, sugiro visita em breve para você comparar com calma.`,
          ctx,
        );
        justification = 'Combina classificação do ranking com call-to-action moderado.';
      }
      break;
    }
    case 'POS_VISITA': {
      if (tone === 'OBJETIVO') {
        message = applyTemplate(
          `${open}O que achou da visita ao lote {lote}? Ficou alguma dúvida sobre documentação ou condições?`,
          ctx,
        );
        justification = 'Pós-visita focada em feedback e próximo passo prático.';
      } else if (tone === 'CONSULTIVO') {
        message = applyTemplate(
          `${open}Queria ouvir sua percepção depois de conhecer o lote {lote} no {loteamento}. O que mais pesou a favor ou contra?`,
          ctx,
        );
        justification = 'Consultivo: abre espaço para objeções.';
      } else {
        message = applyTemplate(
          `${open}Normalmente depois da visita ao {lote} as dúvidas ficam menores. Quer que eu monte simulação de entrada/parcelas para você avaliar?`,
          ctx,
        );
        justification = 'Conduz para negociação com simulação.';
      }
      break;
    }
    case 'NEGOCIACAO': {
      if (tone === 'OBJETIVO') {
        message = applyTemplate(
          `${open}Para avançarmos no lote {lote} ({loteamento}), qual faixa de entrada ficaria confortável para você? Assim já preparo simulação alinhada.`,
          ctx,
        );
        justification = 'Negociação objetiva: pergunta chave financeira.';
      } else if (tone === 'CONSULTIVO') {
        message = applyTemplate(
          `${open}Estamos bem perto no {loteamento} (lote {lote}). Posso te apresentar duas formas de pagamento para você comparar sem compromisso?`,
          ctx,
        );
        justification = 'Reduz atrito oferecendo opções.';
      } else {
        message = applyTemplate(
          `${open}O {lote} na {quadra} continua alinhado ao que conversamos ({preco}). Se topar, já encaminho proposta formal para você analisar com calma.`,
          ctx,
        );
        justification = 'Convite claro à proposta mantendo respeito ao ritmo do cliente.';
      }
      break;
    }
    case 'REATIVACAO_ENCALHADO': {
      if (tone === 'OBJETIVO') {
        message = applyTemplate(
          `${open}O lote {lote} no {loteamento} tem ótima posição física e {preco}. Posso te mostrar um ângulo diferente (condições / comparativo) que às vezes passa despercebido?`,
          ctx,
        );
        justification = 'Reativação: muda ângulo para lote com baixa conversão no ranking.';
      } else if (tone === 'CONSULTIVO') {
        message = applyTemplate(
          `${open}Queria retomar o lote {lote} com um olhar de custo-benefício: {area} por {preco} no {loteamento}. Faz sentido conversarmos 10 minutos?`,
          ctx,
        );
        justification = 'Foco custo-benefício explícito para narrativa alternativa.';
      } else {
        message = applyTemplate(
          `${open}Separei o lote {lote}, quadra {quadra}, como opção para quem busca pagar menos “por metro” sem abrir mão do empreendimento. Quer o comparativo rápido?`,
          ctx,
        );
        justification = 'Argumento de eficiência por m², adequado a lote “encalhado”.';
      }
      break;
    }
    default:
      message = applyTemplate(
        `${open}Passando para alinhar o lote {lote} no {loteamento}. Posso te ajudar com alguma dúvida?`,
        ctx,
      );
      justification = 'Mensagem neutra por fallback seguro.';
  }

  return {
    tone,
    message: message.replace(/\s+/g, ' ').trim(),
    justification,
  };
}

export function composeLeadMessages(ctx: CommercialMessageContext): LeadMessageBundle {
  const primaryType = decidePrimaryType(ctx);
  const tones: CommercialTone[] = ['OBJETIVO', 'CONSULTIVO', 'PERSUASIVO'];
  const suggestions = tones.map((tone, i) => composeToneForType(primaryType, tone, ctx, i));

  return {
    primaryType,
    typeLabel: TYPE_LABELS[primaryType],
    contactTiming: contactTiming(ctx),
    recommendedTone: recommendTone(primaryType, ctx),
    nextAction: nextAction(primaryType),
    strategySummary: strategySummary(primaryType, ctx),
    lotSummary: buildLotSummary(ctx),
    suggestions,
  };
}

function composeLotOnlyTone(
  type: CommercialMessageType,
  tone: CommercialTone,
  ctx: CommercialMessageContext,
  index: number,
): ComposedSuggestion {
  const seed = ctx.variantSeed + index * 19;
  const lot = ctx.lot!;
  const ph = basePlaceholders(ctx);

  const intro = pickVariant(seed, ['Oi!', 'Olá!', 'Boa tarde!']);

  if (type === 'REATIVACAO_ENCALHADO') {
    const msgs =
      tone === 'OBJETIVO'
        ? `${intro} Lote ${lot.number}, quadra ${ph.quadra}, ${ph.loteamento}: ${ph.preco}, ${ph.area}. Destaque para custo-benefício no empreendimento. Quer saber mais?`
        : tone === 'CONSULTIVO'
          ? `${intro} Estou divulgando o lote ${lot.number} (${ph.loteamento}) — ${ph.area} por ${ph.preco}. Posso te contar por que vale a pena avaliar?`
          : `${intro} Oportunidade no ${ph.loteamento}: lote ${lot.number}, ${ph.quadra}. ${ph.preco}. Bom “custo por metro” para quem quer construir com folga.`;
    return {
      tone,
      message: msgs,
      justification: 'Pitch para lote com baixa conversão — narrativa de valor e metragem.',
    };
  }

  const rank =
    lot.tags.includes('CAMPEAO_VENDA') && tone === 'PERSUASIVO'
      ? ' Uma das prioridades comerciais do empreendimento neste momento.'
      : '';

  if (tone === 'OBJETIVO') {
    return {
      tone,
      message: `${intro} Disponível: lote ${lot.number}, quadra ${ph.quadra}, ${ph.loteamento}. ${ph.preco}. ${ph.area}.${rank}`.trim(),
      justification: 'Divulgação direta com dados objetivos do cadastro e ranking quando aplicável.',
    };
  }
  if (tone === 'CONSULTIVO') {
    return {
      tone,
      message: `${intro} Separei o lote ${lot.number} no ${ph.loteamento} (quadra ${ph.quadra}): ${ph.area}, ${ph.preco}. Posso explicar o contexto do empreendimento?${rank}`.trim(),
      justification: 'Convite consultivo para explicar o empreendimento.',
    };
  }
  return {
    tone,
    message: `${intro} O lote ${lot.number}/${ph.quadra} no ${ph.loteamento} está bem posicionado comercialmente (${ph.classificacao || 'boa aceitação'}). ${ph.preco}, ${ph.area}.${rank} Quer indicar para um cliente?`.trim(),
    justification: 'Usa classificação comercial do sistema como argumento de venda.',
  };
}

export function composeLotPitch(ctx: CommercialMessageContext): LotPitchBundle {
  if (!ctx.lot) {
    return {
      primaryType: 'OPORTUNIDADE',
      arguments: [],
      lotSummary: [],
      strategySummary: 'Sem lote no contexto — cadastre o lote para gerar pitch automático.',
      suggestions: [
        {
          tone: 'OBJETIVO',
          message: 'Olá! Posso te enviar opções de lotes no empreendimento. Qual perfil você busca?',
          justification: 'Contexto mínimo: convite genérico até haver dados do lote.',
        },
        {
          tone: 'CONSULTIVO',
          message: 'Oi! Quando tiver um lote selecionado, monto um texto personalizado com preço e metragem.',
          justification: 'Explica limitação ao usuário.',
        },
        {
          tone: 'PERSUASIVO',
          message: 'Olá! Estou à disposição para apresentar as melhores unidades disponíveis no loteamento.',
          justification: 'Abertura comercial neutra.',
        },
      ],
    };
  }

  let primaryType: CommercialMessageType = 'OPORTUNIDADE';
  if (ctx.lot.tags.includes('NECESITA_ATENCAO_COMERCIAL')) {
    primaryType = 'REATIVACAO_ENCALHADO';
  } else if (ctx.lot.tags.includes('CAMPEAO_VENDA')) {
    primaryType = 'OPORTUNIDADE';
  }

  const tones: CommercialTone[] = ['OBJETIVO', 'CONSULTIVO', 'PERSUASIVO'];
  const suggestions = tones.map((tone, i) => composeLotOnlyTone(primaryType, tone, ctx, i));

  return {
    primaryType,
    arguments: buildArguments(ctx),
    lotSummary: buildLotSummary(ctx),
    suggestions,
    strategySummary: strategySummary(primaryType, ctx),
  };
}
