'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  CalendarDays,
  LayoutGrid,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Radio,
  Shield,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

type ActionItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const ACTIONS: ActionItem[] = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/leads', label: 'CRM / Leads', icon: Users },
  { href: '/chat', label: 'Chat comercial', icon: MessageCircle },
  { href: '/visits/new', label: 'Nova visita', icon: CalendarDays },
  { href: '/visits/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/lots', label: 'Quadras e lotes', icon: LayoutGrid },
  { href: '/campaigns', label: 'Campanhas', icon: Radio },
  { href: '/publication', label: 'Publicação', icon: Megaphone },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin', label: 'Administração', icon: Shield, adminOnly: true },
];

/**
 * Atalhos comerciais flutuantes (mobile e desktop). Não altera rotas; apenas navegação rápida.
 */
export function BrokerQuickActions() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!user || user.role === 'CLIENTE') return null;

  const items = ACTIONS.filter((a) => !a.adminOnly || user.role === 'ADMIN');

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-[35] bg-primary-950/30 backdrop-blur-[2px] transition-opacity lg:bg-primary-950/15"
          aria-label="Fechar atalhos"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div
        className={cn(
          'pointer-events-none fixed bottom-0 right-0 z-[40] flex flex-col items-end p-4',
          'pb-[max(1rem,env(safe-area-inset-bottom))] pl-8 pt-8 lg:bottom-2 lg:right-6 lg:p-0 lg:pb-[max(0.5rem,env(safe-area-inset-bottom))]',
        )}
      >
      <div
        className={cn(
          'pointer-events-auto flex flex-col items-end gap-2',
          open && 'animate-in fade-in slide-in-from-bottom-3 duration-200',
        )}
      >
        {open ? (
          <div
            className="mb-1 w-[min(92vw,18rem)] max-h-[min(70vh,420px)] overflow-y-auto overflow-x-hidden rounded-2xl border border-surface-muted/90 bg-white shadow-card-hover ring-1 ring-primary-950/5 scrollbar-thin"
            role="menu"
            aria-label="Ações rápidas"
          >
            <div className="flex items-center justify-between border-b border-surface-muted/80 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-primary-800">Ações rápidas</p>
              <button
                type="button"
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-surface hover:text-primary-900"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="px-2 py-2">
              {items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      role="menuitem"
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                        active
                          ? 'bg-primary-50 text-primary-900'
                          : 'text-gray-700 hover:bg-surface hover:text-primary-950',
                      )}
                      onClick={() => setOpen(false)}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500 text-white shadow-cta transition hover:bg-accent-600 hover:shadow-lg hover:shadow-accent-500/30 active:scale-[0.97]',
            open && 'ring-2 ring-accent-300 ring-offset-2 ring-offset-white',
          )}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={open ? 'Fechar menu de ações rápidas' : 'Abrir ações rápidas'}
        >
          {open ? <X className="h-6 w-6" strokeWidth={2.5} /> : <Zap className="h-6 w-6" strokeWidth={2.25} />}
        </button>
      </div>
      </div>
    </>
  );
}
