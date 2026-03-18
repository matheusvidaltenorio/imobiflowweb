'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="mb-8 text-2xl font-bold">Painel Administrativo</h1>

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
                <Link href="/admin/properties" className="mt-2 text-sm text-primary-600 hover:underline">
                  Gerenciar
                </Link>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-gray-500">Usuários</p>
                <p className="text-2xl font-bold">-</p>
                <Link href="/admin/users" className="mt-2 text-sm text-primary-600 hover:underline">
                  Gerenciar
                </Link>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-gray-500">Loteamentos</p>
                <p className="text-2xl font-bold">-</p>
                <Link href="/admin/developments" className="mt-2 text-sm text-primary-600 hover:underline">
                  Gerenciar
                </Link>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-gray-500">Leads</p>
                <p className="text-2xl font-bold">{data?.leadsCount ?? 0}</p>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
