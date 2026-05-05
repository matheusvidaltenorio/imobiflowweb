'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import { IntegrationsHub } from '@/components/integrations/integrations-hub';
import { useToast } from '@/components/ui/toaster';

export default function IntegrationsPage() {
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const ok = sp.get('meta_connected');
    const basicOk = sp.get('meta_basic_connected');
    const pagesPending = sp.get('meta_pages_pending');
    const err = sp.get('meta_error');
    const errCode = sp.get('meta_error_code');
    if (!ok && !basicOk && !err) return;
    if (ok) {
      toast({
        title: 'Meta: páginas sincronizadas',
        description: 'Conexões de página atualizadas. Escolha a página padrão abaixo, se aplicável.',
        type: 'success',
      });
    }
    if (basicOk) {
      const extra =
        pagesPending === '1'
          ? ' Permissões de páginas ainda pendentes — use “Conceder permissões de páginas/publicação” quando estiver pronto.'
          : '';
      toast({
        title: 'Meta: login conectado',
        description: `Conta Meta vinculada em modo básico (OAuth mínimo).${extra}`,
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
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Integrações"
          description="Cada usuário conecta as próprias redes: login na Meta vincula suas páginas do Facebook e Instagram Business. Outras plataformas serão adicionadas aqui. O segredo do app fica só no servidor."
          breadcrumbs={[{ label: 'Integrações' }]}
        />
        <IntegrationsHub showMetaFull />
      </div>
    </main>
  );
}
