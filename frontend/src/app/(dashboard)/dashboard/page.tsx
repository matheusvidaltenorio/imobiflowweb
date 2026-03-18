'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';

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
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <h1 className="mb-6 text-2xl font-bold">Área do Cliente</h1>
          <p className="text-gray-600">Você está logado como cliente. Acesse favoritos e interesses no menu.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <h1 className="mb-8 text-2xl font-bold">Dashboard</h1>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-4 md:grid-cols-4">
              <Card className="p-6">
                <p className="text-sm text-gray-500">Imóveis</p>
                <p className="text-2xl font-bold">{data?.propertiesCount ?? 0}</p>
                <Link href="/properties" className="mt-2 text-sm text-primary-600 hover:underline">
                  Ver todos
                </Link>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-gray-500">Visitas</p>
                <p className="text-2xl font-bold">{data?.visitsCount ?? 0}</p>
                <Link href="/visits" className="mt-2 text-sm text-primary-600 hover:underline">
                  Ver agenda
                </Link>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-gray-500">Leads</p>
                <p className="text-2xl font-bold">{data?.leadsCount ?? 0}</p>
                <Link href="/leads" className="mt-2 text-sm text-primary-600 hover:underline">
                  Ver leads
                </Link>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-gray-500">Favoritos</p>
                <p className="text-2xl font-bold">{data?.favoritesCount ?? 0}</p>
              </Card>
            </div>

            <Card className="p-6">
              <h2 className="mb-4 font-semibold">Leads Recentes</h2>
              {data?.recentLeads?.length ? (
                <div className="space-y-3">
                  {data.recentLeads.map((lead: { id: string; name: string; email: string; property: { title: string }; createdAt: string }) => (
                    <div key={lead.id} className="flex justify-between border-b pb-2">
                      <div>
                        <p className="font-medium">{lead.name}</p>
                        <p className="text-sm text-gray-500">{lead.property?.title}</p>
                      </div>
                      <p className="text-sm text-gray-500">{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Nenhum lead recente</p>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
