'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Building2, CalendarDays, Heart, Sparkles, Users, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const flowSteps = [
  { step: 1, label: 'Lead', href: '/leads' },
  { step: 2, label: 'Visita', href: '/visits/agenda' },
  { step: 3, label: 'Simulação', href: '/simulacao' },
  { step: 4, label: 'Proposta', href: '/propostas' },
  { step: 5, label: 'Contrato', href: '/contracts' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard');
      return data;
    },
    enabled: !!user,
  });

  if (user?.role === 'CLIENTE') {
    return (
      <div className="flex min-h-screen bg-surface">
        <Sidebar />
        <main className="flex-1 p-6 md:p-10">
          <h1 className="text-2xl font-bold text-primary-950">Área do Cliente</h1>
          <p className="mt-2 max-w-lg text-gray-600">
            Explore favoritos e interesses pelo menu. Estamos aqui para ajudar na sua escolha.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 md:p-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-800">
              <Sparkles className="h-3.5 w-3.5" />
              Painel comercial
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary-950 md:text-4xl">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-base text-gray-600">
            Visão rápida do seu funil e atalhos para as ações que mais geram fechamento.
          </p>

          <Card className="mt-8 border-primary-100/80 bg-gradient-to-r from-white to-primary-50/40 p-5">
            <p className="text-sm font-bold text-primary-900">Fluxo de venda</p>
            <p className="mt-1 text-xs text-gray-600">Siga a ordem para não perder oportunidades.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {flowSteps.map((s, i) => (
                <span key={s.href} className="flex items-center gap-2">
                  <Link
                    href={s.href}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary-800 shadow-sm ring-1 ring-primary-100 transition hover:bg-accent-500 hover:text-white hover:ring-accent-400"
                  >
                    {s.step}. {s.label}
                  </Link>
                  {i < flowSteps.length - 1 && <ArrowRight className="hidden h-4 w-4 text-gray-300 sm:inline" />}
                </span>
              ))}
            </div>
          </Card>

          {isLoading ? (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-muted/80" />
              ))}
            </div>
          ) : (
            <>
              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: 'Imóveis',
                    value: data?.propertiesCount ?? 0,
                    href: '/properties',
                    sub: 'Ver todos',
                    icon: Building2,
                    tone: 'from-primary-800 to-primary-700',
                  },
                  {
                    label: 'Visitas',
                    value: data?.visitsCount ?? 0,
                    href: '/visits',
                    sub: 'Ver agenda',
                    icon: CalendarDays,
                    tone: 'from-primary-700 to-primary-600',
                  },
                  {
                    label: 'Leads',
                    value: data?.leadsCount ?? 0,
                    href: '/leads',
                    sub: 'Abrir funil',
                    icon: Users,
                    tone: 'from-accent-600 to-accent-500',
                  },
                  {
                    label: 'Favoritos',
                    value: data?.favoritesCount ?? 0,
                    href: '/favorites',
                    sub: null,
                    icon: Heart,
                    tone: 'from-success-600 to-success-500',
                  },
                ].map((item) => (
                  <Card key={item.label} className="group relative overflow-hidden p-0">
                    <div
                      className={cn(
                        'absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full opacity-20 blur-2xl',
                        `bg-gradient-to-br ${item.tone}`,
                      )}
                    />
                    <div className="relative p-6">
                      <div
                        className={cn(
                          'mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md',
                          `bg-gradient-to-br ${item.tone}`,
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-gray-500">{item.label}</p>
                      <p className="mt-1 text-3xl font-bold tabular-nums text-primary-950">{item.value}</p>
                      {item.sub && (
                        <Link
                          href={item.href}
                          className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-accent-600 hover:text-accent-700"
                        >
                          {item.sub}
                          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                        </Link>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              <Card className="mt-8 p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-primary-950">Leads recentes</h2>
                  <Link href="/leads">
                    <Button variant="outline" size="sm" type="button">
                      Ver funil completo
                    </Button>
                  </Link>
                </div>
                {data?.recentLeads?.length ? (
                  <div className="divide-y divide-surface-muted rounded-xl border border-surface-muted/80">
                    {data.recentLeads.map(
                      (lead: {
                        id: string;
                        name: string;
                        email: string;
                        property: { title: string };
                        createdAt: string;
                      }) => (
                        <div
                          key={lead.id}
                          className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-surface/80 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">{lead.name}</p>
                            <p className="text-sm text-gray-500">{lead.property?.title}</p>
                          </div>
                          <p className="text-sm font-medium text-gray-400">
                            {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-surface-muted bg-surface/50 px-6 py-10 text-center">
                    <p className="font-medium text-gray-600">Nenhum lead recente</p>
                    <p className="mt-1 text-sm text-gray-500">Divulgue seus imóveis para começar a receber interessados.</p>
                    <Link href="/leads">
                      <Button className="mt-4" type="button">
                        Ir para leads
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
