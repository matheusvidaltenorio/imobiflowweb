'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { MetaSocialPanel } from '@/components/integrations/meta-social-panel';

export default function IntegrationsPage() {
  return (
    <main className="min-h-0 bg-slate-50/30 p-4 sm:p-6 md:p-8 lg:p-10">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Integrações"
          description="Conecte contas externas para automatizar publicações. A Meta (Facebook e Instagram) usa OAuth seguro pelo servidor — o segredo do app não aparece no navegador."
          breadcrumbs={[{ label: 'Integrações' }]}
        />
        <MetaSocialPanel />
      </div>
    </main>
  );
}
