'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { UserPlus, Building2, Users, Map } from 'lucide-react';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard');
      return data;
    },
  });

  const tiles = [
    {
      label: 'Imóveis',
      value: data?.propertiesCount ?? 0,
      href: '/admin/properties',
      action: 'Gerenciar',
      icon: Building2,
      tone: 'from-primary-800 to-primary-700',
    },
    {
      label: 'Usuários',
      value: '—',
      href: '/admin/users',
      action: 'Gerenciar',
      icon: Users,
      tone: 'from-primary-700 to-primary-600',
    },
    {
      label: 'Loteamentos',
      value: '—',
      href: '/admin/developments',
      action: 'Gerenciar',
      icon: Map,
      tone: 'from-accent-600 to-accent-500',
    },
    {
      label: 'Leads',
      value: data?.leadsCount ?? 0,
      href: '/leads',
      action: 'Ver funil',
      icon: UserPlus,
      tone: 'from-success-600 to-success-500',
    },
  ];

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 p-6 md:p-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            Administração
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary-950">Painel administrativo</h1>
          <p className="mt-2 max-w-2xl text-gray-600">
            Visão consolidada do marketplace. Acesse módulos para manter dados e equipe organizados.
          </p>

          {isLoading ? (
            <div className="mt-10 grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-muted/80" />
              ))}
            </div>
          ) : (
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {tiles.map((t) => (
                <Card key={t.label} className="group relative overflow-hidden p-0">
                  <div
                    className={`absolute right-0 top-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-gradient-to-br ${t.tone} opacity-15 blur-2xl`}
                  />
                  <div className="relative p-6">
                    <div
                      className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${t.tone} text-white shadow-md`}
                    >
                      <t.icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-gray-500">{t.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-primary-950">{t.value}</p>
                    <Link
                      href={t.href}
                      className="mt-3 inline-block text-sm font-bold text-accent-600 transition group-hover:text-accent-700"
                    >
                      {t.action} →
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
