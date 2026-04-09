'use client';

import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type CopyRow = {
  title: string | null;
  caption: string | null;
  cta: string | null;
  hashtags: string | null;
};

type Props = {
  platform: string;
  imageUrl: string | null;
  copy: CopyRow | undefined;
  developmentName?: string;
};

export function CampaignPlatformPreview({ platform, imageUrl, copy, developmentName }: Props) {
  const caption = [copy?.caption, copy?.hashtags ? `\n\n${copy.hashtags}` : ''].filter(Boolean).join('');

  if (platform === 'WHATSAPP') {
    const bubble = copy?.caption?.trim() || 'Mensagem gerada para WhatsApp aparecerá aqui.';
    return (
      <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-[#e5ddd5] p-3 shadow-inner">
        <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
          <p className="whitespace-pre-wrap text-[13px] leading-snug text-slate-900">{bubble}</p>
          {copy?.cta ? (
            <p className="mt-2 text-[12px] font-semibold text-emerald-800">{copy.cta}</p>
          ) : null}
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-600">Prévia estilo conversa</p>
      </div>
    );
  }

  if (platform === 'FACEBOOK_POST') {
    return (
      <div className="mx-auto max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-3 py-2">
          <p className="text-sm font-bold text-slate-900">{developmentName ?? 'Sua imobiliária'}</p>
          <p className="text-xs text-slate-500">Agora · Público</p>
        </div>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-slate-100 text-xs text-slate-500">
            Sem imagem
          </div>
        )}
        <div className="space-y-2 p-3 text-sm text-slate-800">
          {copy?.title ? <p className="font-bold">{copy.title}</p> : null}
          <p className="whitespace-pre-wrap leading-relaxed">{copy?.caption ?? 'Gere o texto na etapa de IA.'}</p>
          {copy?.cta ? <p className="font-semibold text-primary-800">{copy.cta}</p> : null}
        </div>
      </div>
    );
  }

  if (platform === 'INSTAGRAM_STORY' || platform === 'INSTAGRAM_REEL') {
    return (
      <div className="mx-auto w-[min(100%,220px)]">
        <div
          className={cn(
            'relative overflow-hidden rounded-xl border-4 border-slate-900 bg-slate-900 shadow-xl',
            'aspect-[9/16]',
          )}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-b from-purple-900 to-slate-900 p-4 text-center text-xs text-white/80">
              Story / Reel — adicione imagem
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
            <p className="line-clamp-6 whitespace-pre-wrap text-[11px] leading-snug text-white drop-shadow">
              {caption.slice(0, 400) || 'Legenda…'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* INSTAGRAM_FEED default */
  return (
    <div className="mx-auto max-w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-pink-600" />
        <span className="text-xs font-semibold text-slate-900">{developmentName ?? 'imobflow'}</span>
      </div>
      <div className="aspect-[4/5] w-full bg-slate-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">Feed 4:5</div>
        )}
      </div>
      <div className="space-y-1 p-3 text-[12px] leading-snug text-slate-900">
        <p className="line-clamp-4 whitespace-pre-wrap">{caption || 'Legenda do feed…'}</p>
        {copy?.cta ? <p className="text-[11px] font-semibold text-primary-800">{copy.cta}</p> : null}
      </div>
    </div>
  );
}

export function WhatsAppActionHint() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/90 p-3 text-sm text-emerald-950">
      <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        O botão abre o WhatsApp já com o texto. Nada é enviado sozinho — você confirma no aplicativo.
      </p>
    </div>
  );
}
