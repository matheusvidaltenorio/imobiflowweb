'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import { MetaSocialPanel } from '@/components/integrations/meta-social-panel';
import { useToast } from '@/components/ui/toaster';

export default function IntegrationsPage() {
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const ok = sp.get('meta_connected');
    const err = sp.get('meta_error');
    const errCode = sp.get('meta_error_code');
    if (!ok && !err) return;
    if (ok) {
      toast({
        title: 'Conta Meta conectada',
        description: 'Páginas sincronizadas. Escolha a página padrão abaixo, se tiver mais de uma.',
        type: 'success',
      });
    }
    if (err) {
      const titles: Record<string, string> = {
        redirect_uri: 'redirect_uri — app Meta e servidor devem coincidir',
        scopes: 'Permissões Meta',
        access_denied: 'Autorização cancelada',
        url_blocked: 'URL bloqueada ou contexto inválido',
        session: 'Sessão OAuth expirada',
        token: 'Token inválido',
        callback: 'Erro ao finalizar conexão',
        incomplete: 'Resposta incompleta da Meta',
        meta_oauth: 'Conexão Meta',
      };
      toast({
        title: (errCode && titles[errCode]) || 'Erro ao conectar com a Meta',
        description: decodeURIComponent(err),
        type: 'error',
      });
    }
    window.history.replaceState({}, '', pathname || '/integrations');
  }, [pathname, toast]);

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
