'use client';

import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrokerQuickActions } from '@/components/dashboard/broker-quick-actions';
import { MobileNavBar, Sidebar } from '@/components/dashboard/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    // Painel gestora: apenas GESTORA
    if (pathname?.startsWith('/gestora') && user.role !== 'GESTORA') {
      router.replace(user.role === 'ADMIN' ? '/admin' : user.role === 'CORRETOR' ? '/dashboard' : '/');
      return;
    }
    if (user.role === 'GESTORA' && pathname && !pathname.startsWith('/gestora') && !pathname.startsWith('/profile')) {
      router.replace('/gestora');
      return;
    }
    // Admin routes: apenas ADMIN
    if (pathname?.startsWith('/admin') && user.role !== 'ADMIN') {
      router.replace(user.role === 'CORRETOR' ? '/dashboard' : user.role === 'GESTORA' ? '/gestora' : '/');
      return;
    }
    // Corretor routes: CORRETOR ou ADMIN
    const brokerRoutes = [
      '/properties',
      '/developments',
      '/lots',
      '/visits',
      '/leads',
      '/clients',
      '/payments',
      '/simulacao',
      '/propostas',
      '/contracts',
      '/publication',
      '/integrations',
      '/melhores-lotes',
      '/disponiveis-hoje',
      '/crm',
      '/portal-hub',
      '/analytics',
      '/alerts',
      '/chat',
    ];
    if (
      brokerRoutes.some((r) => pathname?.startsWith(r)) &&
      (user.role === 'CLIENTE' || user.role === 'GESTORA') &&
      !pathname?.startsWith('/chat')
    ) {
      router.replace(user.role === 'GESTORA' ? '/gestora' : '/');
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary-200 border-t-accent-500" />
          <p className="text-sm font-medium text-gray-500">Carregando…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const brokerShell = user.role === 'CORRETOR' || user.role === 'ADMIN';
  const gestoraShell = user.role === 'GESTORA';

  return (
    <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-surface">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MobileNavBar onOpen={() => setMobileNavOpen(true)} />
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-app',
            (brokerShell || gestoraShell) && 'pb-[5.5rem] lg:pb-10',
          )}
        >
          {children}
        </div>
        {brokerShell ? <BrokerQuickActions /> : null}
      </div>
    </div>
  );
}
