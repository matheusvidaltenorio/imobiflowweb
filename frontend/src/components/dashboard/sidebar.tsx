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
];

const adminLinks = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Usuários' },
  { href: '/admin/properties', label: 'Imóveis' },
  { href: '/admin/developments', label: 'Loteamentos' },
];

const clientLinks = [
  { href: '/', label: 'Início' },
  { href: '/search', label: 'Buscar' },
  { href: '/favorites', label: 'Favoritos' },
  { href: '/interests', label: 'Interesses' },
  { href: '/profile', label: 'Perfil' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const links =
    user?.role === 'ADMIN'
      ? adminLinks
      : user?.role === 'CORRETOR'
        ? brokerLinks
        : clientLinks;

  return (
    <aside className="flex w-64 flex-col border-r bg-white">
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/" className="font-bold text-primary-600">
          ImobiFlow
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'block rounded-lg px-3 py-2 text-sm font-medium',
              pathname === link.href ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-4">
        <p className="truncate text-sm text-gray-600">{user?.name}</p>
        <button
          onClick={logout}
          className="mt-2 text-sm text-primary-600 hover:underline"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
