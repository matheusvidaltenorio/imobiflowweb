'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminDevelopmentsPage() {
  const { data: developments, isLoading } = useQuery({
    queryKey: ['admin-developments'],
    queryFn: async () => {
      const { data } = await api.get('/developments');
      return data;
    },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="mb-8 text-2xl font-bold">Loteamentos (Admin)</h1>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : developments?.length ? (
          <div className="space-y-4">
            {developments.map((d: { id: string; name: string; city: string; _count?: { properties: number; blocks: number } }) => (
              <Card key={d.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{d.name}</h3>
                    <p className="text-sm text-gray-500">{d.city} • {d._count?.blocks ?? 0} quadras • {d._count?.properties ?? 0} imóveis</p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/lots?development=${d.id}`}>
                      <Button variant="outline" size="sm">Ver lotes</Button>
                    </Link>
                    <Link href={`/developments/edit/${d.id}`}>
                      <Button variant="outline" size="sm">Editar</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Nenhum loteamento.</p>
        )}
      </main>
    </div>
  );
}
