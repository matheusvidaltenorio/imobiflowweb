'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  CalendarDays,
  ChevronRight,
  FileText,
  Heart,
  Home,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MapPinned,
  Megaphone,
  Menu,
  PanelLeftClose,
  Plug,
  Search,
  TrendingUp,
  UserCircle,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const COLLAPSE_KEY = 'imobiflow-sidebar-collapsed';

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

function navLinkActive(pathname: string | null, href: string, exact?: boolean): boolean {
  if (!pathname) return false;
  if (exact) return pathname === href;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

type NavGroup = { title: string; items: NavItem[] };

const brokerGroups: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/developments', label: 'Loteamentos', icon: MapPinned },
      { href: '/lots', label: 'Quadras e lotes', icon: LayoutGrid },
      { href: '/publication', label: 'Centro de publicação', icon: Megaphone },
      { href: '/integrations', label: 'Integrações', icon: Plug },
      { href: '/melhores-lotes', label: 'Melhores lotes', icon: TrendingUp },
    ],
  },
  {
    title: 'Relacionamento',
    items: [
      { href: '/leads', label: 'Leads', icon: Users },
      { href: '/clients', label: 'Clientes', icon: UserCircle },
    ],
  },
  {
    title: 'Operações',
    items: [
      { href: '/properties', label: 'Imóveis', icon: Building2 },
      { href: '/visits', label: 'Visitas', icon: CalendarDays },
      { href: '/visits/agenda', label: 'Agenda', icon: CalendarDays, exact: true },
      { href: '/payments', label: 'Pagamentos', icon: Wallet },
      { href: '/simulacao', label: 'Simulação', icon: Landmark },
      { href: '/propostas', label: 'Propostas', icon: FileText },
      { href: '/contracts', label: 'Contratos', icon: FileText },
    ],
  },
];

const adminGroups: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/admin/users', label: 'Usuários', icon: Users },
      { href: '/admin/developments', label: 'Loteamentos', icon: MapPinned },
      { href: '/admin/properties', label: 'Imóveis', icon: Building2 },
      { href: '/publication', label: 'Centro de publicação', icon: Megaphone },
      { href: '/integrations', label: 'Integrações', icon: Plug },
      { href: '/melhores-lotes', label: 'Melhores lotes', icon: TrendingUp },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { href: '/simulacao', label: 'Simulação', icon: Landmark },
      { href: '/propostas', label: 'Propostas', icon: FileText },
      { href: '/contracts', label: 'Contratos', icon: FileText },
    ],
  },
];

const clientGroups: NavGroup[] = [
  {
    title: 'Menu',
    items: [
      { href: '/', label: 'Início', icon: Home, exact: true },
      { href: '/search', label: 'Buscar', icon: Search },
      { href: '/favorites', label: 'Favoritos', icon: Heart },
      { href: '/interests', label: 'Interesses', icon: FileText },
      { href: '/profile', label: 'Perfil', icon: UserCircle, exact: true },
    ],
  },
];

type SidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const groups =
    user?.role === 'ADMIN' ? adminGroups : user?.role === 'CORRETOR' ? brokerGroups : clientGroups;
  const isBrokerNav = user?.role === 'ADMIN' || user?.role === 'CORRETOR';

  const linkClass = (active: boolean, dark: boolean) =>
    cn(
      'group flex items-center gap-3 rounded-xl text-sm font-semibold transition-all duration-200',
      collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
      dark
        ? active
          ? 'bg-white/12 text-white shadow-inner ring-1 ring-white/10'
          : 'text-primary-100/85 hover:bg-white/8 hover:text-white'
        : active
          ? 'bg-primary-100 text-primary-900'
          : 'text-gray-600 hover:bg-surface hover:text-primary-950',
    );

  const asideWidth = collapsed ? 'lg:w-[76px]' : 'lg:w-64';
  const mobileTransform = mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0';

  if (!isBrokerNav) {
    return (
      <>
        {mobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-primary-950/40 backdrop-blur-sm lg:hidden"
            aria-label="Fechar menu"
            onClick={onMobileClose}
          />
        ) : null}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex h-full min-h-0 shrink-0 flex-col border-r border-surface-muted bg-white shadow-xl transition-transform duration-200 ease-out lg:static lg:z-0 lg:translate-x-0 lg:shadow-sm',
            'w-64',
            mobileTransform,
          )}
        >
          <div className="flex h-16 shrink-0 items-center border-b border-surface-muted px-4">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-primary-900"
              onClick={onMobileClose}
            >
              Imobi<span className="text-accent-500">Flow</span>
            </Link>
          </div>
          <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto p-3">
            {groups.map((group) => (
              <div key={group.title}>
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = navLinkActive(pathname, item.href, item.exact);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        onClick={onMobileClose}
                        className={linkClass(active, false)}
                      >
                        <Icon className="h-5 w-5 shrink-0 opacity-80" strokeWidth={1.75} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="shrink-0 border-t border-surface-muted p-4">
            <p className="truncate text-sm font-medium text-gray-800">{user?.name}</p>
            <button
              type="button"
              onClick={logout}
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-accent-600 hover:text-accent-700"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-primary-950/50 backdrop-blur-sm lg:hidden"
          aria-label="Fechar menu"
          onClick={onMobileClose}
        />
      ) : null}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full min-h-0 shrink-0 flex-col border-r border-primary-800/40 bg-gradient-to-b from-primary-950 via-primary-900 to-primary-950 text-primary-50 shadow-2xl shadow-primary-950/30 transition-all duration-200 ease-out lg:static lg:z-0 lg:translate-x-0',
          asideWidth,
          mobileTransform,
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-primary-800/50',
            collapsed ? 'justify-center px-2' : 'px-4',
          )}
        >
          {!collapsed ? (
            <Link href="/" className="text-lg font-bold tracking-tight text-white" onClick={onMobileClose}>
              Imobi<span className="text-accent-400">Flow</span>
            </Link>
          ) : (
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-800/80 text-sm font-bold text-white"
              title="ImobiFlow"
              onClick={onMobileClose}
            >
              IF
            </Link>
          )}
        </div>

        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
          {groups.map((group) => (
            <div key={group.title}>
              {!collapsed ? (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-primary-300/70">
                  {group.title}
                </p>
              ) : (
                <div className="mx-2 mb-2 h-px bg-primary-700/60" aria-hidden />
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = navLinkActive(pathname, item.href, item.exact);
                  return (
                    <Link
                      key={`${group.title}-${item.href}`}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      onClick={onMobileClose}
                      className={linkClass(active, true)}
                    >
                      <Icon className="h-5 w-5 shrink-0 opacity-90" strokeWidth={1.75} />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div
          className={cn(
            'shrink-0 border-t border-primary-800/50 p-3',
            collapsed ? 'flex flex-col items-center gap-2' : 'space-y-2',
          )}
        >
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              'hidden w-full items-center justify-center gap-2 rounded-xl border border-primary-700/50 bg-primary-900/40 py-2 text-xs font-semibold text-primary-200 transition hover:bg-primary-800/50 hover:text-white lg:flex',
              collapsed ? 'px-2' : 'px-3',
            )}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                <span>Recolher</span>
              </>
            )}
          </button>

          {!collapsed ? (
            <p className="truncate px-1 text-sm font-medium text-primary-100">{user?.name}</p>
          ) : null}
          <button
            type="button"
            onClick={logout}
            className={cn(
              'flex items-center gap-2 rounded-xl text-sm font-semibold text-accent-400 transition-colors hover:bg-primary-800/40 hover:text-accent-300',
              collapsed ? 'justify-center p-2' : 'w-full px-3 py-2',
            )}
            title="Sair"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>Sair</span> : null}
          </button>
        </div>
      </aside>
    </>
  );
}

export function MobileNavBar({ onOpen }: { onOpen: () => void }) {
  const { user } = useAuth();
  const homeHref =
    user?.role === 'CORRETOR' || user?.role === 'ADMIN' ? '/dashboard' : '/';

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-surface-muted bg-white/95 px-4 backdrop-blur-md lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-muted bg-surface text-primary-900 shadow-sm transition hover:bg-white"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" strokeWidth={2} />
      </button>
      <Link href={homeHref} className="text-base font-bold tracking-tight text-primary-950">
        Imobi<span className="text-accent-500">Flow</span>
      </Link>
    </header>
  );
}
