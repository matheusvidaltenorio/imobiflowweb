'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ClientsPage() {
  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await api.get('/clients');
      return data;
    },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Clientes</h1>
          <Link href="/clients/new">
            <Button>Novo Cliente</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : clients?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c: { id: string; name: string; email: string; phone?: string; _count?: { visits: number; leads: number } }) => (
              <Card key={c.id} className="p-4">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-sm text-gray-500">{c.email}</p>
                    {c.phone && <p className="text-sm text-gray-500">{c.phone}</p>}
                    <p className="mt-2 text-xs text-gray-400">{c._count?.visits ?? 0} visitas • {c._count?.leads ?? 0} leads</p>
                  </div>
                  <Link href={`/clients/edit/${c.id}`}>
                    <Button variant="outline" size="sm">Editar</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Nenhum cliente cadastrado. <Link href="/clients/new" className="text-primary-600 hover:underline">Cadastrar primeiro cliente</Link></p>
        )}
      </main>
    </div>
  );
}
