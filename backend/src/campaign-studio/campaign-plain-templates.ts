/**
 * Templates de legenda comercial (sem IA externa).
 * Usados em `applyCaptionTemplate` para preencher `CampaignCopy` por plataforma.
 */
export type TemplateContext = {
  campaignTitle: string;
  developmentName?: string | null;
  city?: string | null;
  lotNumber?: string | null;
  blockName?: string | null;
  priceLabel?: string | null;
  audienceNotes?: string | null;
  internalDescription?: string | null;
};

export type PlainCaptionParts = {
  headline: string;
  feedCaption: string;
  shortCaption: string;
  storyText: string;
  whatsapp: string;
  cta: string;
  hashtags: string;
};

export const CAPTION_TEMPLATE_IDS = [
  'lote_individual',
  'loteamento',
  'urgencia',
  'institucional',
  'whatsapp_cta',
] as const;

export type CaptionTemplateId = (typeof CAPTION_TEMPLATE_IDS)[number];

function fmtPrice(p?: string | null): string {
  if (!p?.trim()) return '';
  return p.trim();
}

/** Lista para GET /campaign-studio/caption-templates (metadados + CTAs sugeridos). */
export function listCaptionTemplateMeta() {
  return [
    {
      id: 'lote_individual',
      label: 'Lote individual',
      description: 'Destaque de um lote com quadra, local e preço.',
      suggestedCtas: ['Agende sua visita', 'Consulte disponibilidade', 'Garanta seu lote'],
    },
    {
      id: 'loteamento',
      label: 'Loteamento / empreendimento',
      description: 'Divulgação do empreendimento e diferenciais de localização.',
      suggestedCtas: ['Saiba valores e condições', 'Agende sua visita', 'Fale agora no WhatsApp'],
    },
    {
      id: 'urgencia',
      label: 'Urgência / oportunidade',
      description: 'Tom comercial direto sem inventar desconto (ajuste valores no texto).',
      suggestedCtas: ['Garanta seu lote', 'Fale agora no WhatsApp', 'Consulte disponibilidade'],
    },
    {
      id: 'institucional',
      label: 'Institucional / marca',
      description: 'Marca e confiança; use quando não houver loteamento fixo.',
      suggestedCtas: ['Conheça nossos empreendimentos', 'Fale com um consultor'],
    },
    {
      id: 'whatsapp_cta',
      label: 'Chamar no WhatsApp',
      description: 'Mensagem curta focada em resposta rápida.',
      suggestedCtas: ['Fale agora no WhatsApp', 'Tire suas dúvidas no Zap'],
    },
  ];
}

export function buildPlainCaption(templateId: string, ctx: TemplateContext): PlainCaptionParts {
  const dev = ctx.developmentName?.trim() || 'Seu novo endereço';
  const city = ctx.city?.trim();
  const loc = city ? `${dev} — ${city}` : dev;
  const lotLine =
    ctx.lotNumber && ctx.blockName
      ? `Lote ${ctx.lotNumber} — Quadra ${ctx.blockName}`
      : ctx.lotNumber
        ? `Lote ${ctx.lotNumber}`
        : null;
  const price = fmtPrice(ctx.priceLabel);
  const extra = ctx.internalDescription?.trim() || ctx.audienceNotes?.trim();

  switch (templateId) {
    case 'loteamento': {
      const headline = ctx.campaignTitle.trim() || loc;
      const feed = [
        `🏡 ${headline}`,
        '',
        `📍 ${loc}`,
        extra ? `\n${extra}` : '',
        price ? `\n💰 A partir de ${price}` : '',
        '\n📲 Chame no WhatsApp e agende sua visita.',
      ]
        .filter(Boolean)
        .join('\n');
      return {
        headline,
        feedCaption: feed,
        shortCaption: `${headline} · ${loc}`.slice(0, 300),
        storyText: `${headline}\n${loc}\n${price ? `💰 ${price}\n` : ''}👉 Toque para falar com a equipe.`,
        whatsapp: `Olá! Tenho interesse em ${headline}${city ? ` (${city})` : ''}. Podemos falar?`,
        cta: 'Agende sua visita',
        hashtags: '#loteamento #terreno #moradia #investimento #imobiliaria',
      };
    }
    case 'urgencia': {
      const headline = ctx.campaignTitle.trim() || (lotLine ? `Oportunidade: ${lotLine}` : 'Oportunidade no loteamento');
      const feed = [
        `⚡ ${headline}`,
        '',
        loc,
        lotLine ?? '',
        price ? `💰 ${price}` : '',
        extra ?? '',
        '',
        '⏳ Unidades limitadas — consulte disponibilidade hoje.',
        '',
        '👉 Chame no WhatsApp e garanta sua análise.',
      ]
        .filter((l) => l !== '')
        .join('\n');
      return {
        headline,
        feedCaption: feed,
        shortCaption: headline.slice(0, 280),
        storyText: `${headline}\n${loc}\nConsulte já 👇`,
        whatsapp: `Olá! Vi o lote${ctx.lotNumber ? ` ${ctx.lotNumber}` : ''} e quero mais informações.`,
        cta: 'Garanta seu lote',
        hashtags: '#lote #terreno #oportunidade #imoveis #loteamento',
      };
    }
    case 'institucional': {
      const headline = ctx.campaignTitle.trim() || 'Solidez e transparência na sua compra de terreno';
      const feed = [
        `✨ ${headline}`,
        '',
        dev !== 'Seu novo endereço' ? `Construímos ${dev} com foco em segurança jurídica e atendimento próximo.` : 'Atendimento consultivo para você escolher o melhor terreno.',
        extra ? `\n${extra}` : '',
        '',
        '📲 Fale com nosso time e tire suas dúvidas.',
      ].join('\n');
      return {
        headline,
        feedCaption: feed,
        shortCaption: headline.slice(0, 280),
        storyText: `${headline}\nConfiança de ponta a ponta.`,
        whatsapp: 'Olá! Gostaria de conhecer os empreendimentos e condições.',
        cta: 'Conheça nossos empreendimentos',
        hashtags: '#imobiliaria #terrenos #confianca #atendimento',
      };
    }
    case 'whatsapp_cta': {
      const headline = ctx.campaignTitle.trim() || (lotLine ?? loc);
      const feed = [
        `💬 Resposta rápida no WhatsApp`,
        '',
        headline,
        loc,
        '',
        'Envie uma mensagem e receba valores, disponibilidade e visita.',
      ].join('\n');
      return {
        headline,
        feedCaption: feed,
        shortCaption: `WhatsApp · ${headline}`.slice(0, 280),
        storyText: `${headline}\n📲 Chame agora no WhatsApp.`,
        whatsapp: `Olá! Quero informações sobre ${headline}.`,
        cta: 'Fale agora no WhatsApp',
        hashtags: '#whatsapp #atendimento #lotes #terrenos',
      };
    }
    case 'lote_individual':
    default: {
      const headline =
        ctx.campaignTitle.trim() ||
        (lotLine ? `${lotLine} disponível` : `Lotes em ${loc}`);
      const feed = [
        `🔑 ${headline}`,
        '',
        loc,
        lotLine ? `📐 ${lotLine}` : '',
        price ? `💰 ${price}` : '',
        extra ? `\n${extra}` : '',
        '',
        '✅ Agende uma visita e conheça o projeto no local.',
      ]
        .filter((l) => l !== '')
        .join('\n');
      return {
        headline,
        feedCaption: feed,
        shortCaption: `${headline} · ${loc}`.slice(0, 300),
        storyText: `${headline}\n${loc}\n${price ? `${price}\n` : ''}👉 Visita sob agendamento.`,
        whatsapp: `Olá! Tenho interesse no ${lotLine || 'lote'} em ${dev}.`,
        cta: 'Agende sua visita',
        hashtags: '#lote #terreno #loteamento #moradia #investimento',
      };
    }
  }
}

export function isValidTemplateId(id: string): id is CaptionTemplateId {
  return (CAPTION_TEMPLATE_IDS as readonly string[]).includes(id);
}
