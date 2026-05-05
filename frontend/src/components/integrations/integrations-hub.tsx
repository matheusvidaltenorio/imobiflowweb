'use client';

import { Megaphone, Share2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { MetaSocialPanel } from '@/components/integrations/meta-social-panel';

const UPCOMING = [
  {
    name: 'LinkedIn',
    description: 'Publicação e OAuth para páginas e perfis profissionais.',
  },
  {
    name: 'TikTok',
    description: 'Integração com conteúdo e contas de negócio.',
  },
  {
    name: 'YouTube',
    description: 'Shorts e metadados de canal (quando disponível na API).',
  },
  {
    name: 'Pinterest',
    description: 'Pins e boards para divulgação visual.',
  },
] as const;

type Props = {
  /** Painel Meta completo; no dashboard use só MetaSocialPanel compact. */
  showMetaFull?: boolean;
};

export function IntegrationsHub({ showMetaFull = true }: Props) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="integrations-meta-heading">
        <h2 id="integrations-meta-heading" className="sr-only">
          Meta — Facebook e Instagram
        </h2>
        {showMetaFull ? <MetaSocialPanel /> : <MetaSocialPanel compact />}
      </section>

      <section aria-labelledby="integrations-more-heading">
        <div className="mb-4 flex items-center gap-2">
          <Share2 className="h-5 w-5 text-slate-500" aria-hidden />
          <h2 id="integrations-more-heading" className="text-base font-bold text-slate-900">
            Outras plataformas
          </h2>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          O hub de integrações está preparado para novos provedores. Cada rede terá fluxo próprio de login e permissões,
          no mesmo estilo seguro da Meta (sem expor segredos no navegador).
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {UPCOMING.map((p) => (
            <li key={p.name}>
              <Card className="border border-dashed border-slate-200 bg-slate-50/60 p-4 shadow-none">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200/80 text-slate-600">
                    <Megaphone className="h-4 w-4" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{p.description}</p>
                    <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Em breve</p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
