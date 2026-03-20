'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const brokerLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/properties', label: 'Imóveis' },
  { href: '/developments', label: 'Loteamentos' },
  { href: '/lots', label: 'Lotes' },
  { href: '/visits', label: 'Visitas' },
  { href: '/visits/agenda', label: 'Agenda' },
  { href: '/leads', label: 'Leads' },
  { href: '/clients', label: 'Clientes' },
  { href: '/payments', label: 'Pagamentos' },
  { href: '/simulacao', label: 'Simulação' },
  { href: '/propostas', label: 'Propostas' },
  { href: '/contracts', label: 'Contratos' },
];

const adminLinks = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Usuários' },
  { href: '/admin/properties', label: 'Imóveis' },
  { href: '/admin/developments', label: 'Loteamentos' },
  { href: '/simulacao', label: 'Simulação' },
  { href: '/propostas', label: 'Propostas' },
  { href: '/contracts', label: 'Contratos' },
];

const clientLinks = [
  { href: '/', label: 'Início' },
  { href: '/search', label: 'Buscar' },
  { href: '/favorites', label: 'Favoritos' },
  { href: '/interests', label: 'Interesses' },
  { href: '/profile', label: 'Perfil' },
];

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/contracts' && pathname.startsWith('/contracts/')) return true;
  return pathname === href;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const links =
    user?.role === 'ADMIN' ? adminLinks : user?.role === 'CORRETOR' ? brokerLinks : clientLinks;

  const isBrokerNav = user?.role === 'ADMIN' || user?.role === 'CORRETOR';

  if (!isBrokerNav) {
    return (
      <aside className="flex w-64 flex-col border-r border-surface-muted bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-surface-muted px-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-primary-900">
            Imobi<span className="text-accent-500">Flow</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'block rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                pathname === link.href
                  ? 'bg-primary-50 text-primary-800'
                  : 'text-gray-600 hover:bg-surface hover:text-primary-900',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-surface-muted p-4">
          <p className="truncate text-sm font-medium text-gray-700">{user?.name}</p>
          <button type="button" onClick={logout} className="mt-2 text-sm font-semibold text-accent-600 hover:text-accent-700">
            Sair
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col border-r border-primary-900/50 bg-gradient-to-b from-primary-950 via-primary-900 to-primary-950 text-primary-100 shadow-xl shadow-primary-950/25">
      <div className="flex h-16 items-center border-b border-primary-800/60 px-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          Imobi<span className="text-accent-400">Flow</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {links.map((link) => {
          const active = isActivePath(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'block rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                active
                  ? 'bg-primary-800/90 text-white shadow-inner ring-1 ring-white/10'
                  : 'text-primary-200/90 hover:bg-primary-800/40 hover:text-white',
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-primary-800/60 p-4">
        <p className="truncate text-sm font-medium text-primary-100">{user?.name}</p>
        <button
          type="button"
          onClick={logout}
          className="mt-2 text-sm font-semibold text-accent-400 transition-colors hover:text-accent-300"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
