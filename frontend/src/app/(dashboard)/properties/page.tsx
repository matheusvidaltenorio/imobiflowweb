'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';

export default function PropertiesPage() {
  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties-mine'],
    queryFn: async () => {
      const { data } = await api.get('/properties');
      return data;
    },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Meus Imóveis</h1>
          <Link
            href="/properties/new"
            className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Novo Imóvel
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : properties?.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p: { id: string; title: string; price: number; status: string; images: { url: string }[]; city: string }) => (
              <Card key={p.id} className="overflow-hidden">
                <div className="relative h-40 bg-gray-100">
                  {p.images?.[0]?.url ? (
                    <Image src={p.images[0].url} alt={p.title} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">Sem imagem</div>
                  )}
                  <span className="absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-xs">{p.status}</span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="text-sm text-gray-500">{p.city}</p>
                  <p className="mt-2 font-bold text-primary-600">{formatPrice(Number(p.price))}</p>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/property/${p.id}`}
                      className="inline-block rounded border px-3 py-1 text-sm hover:bg-gray-50"
                    >
                      Ver
                    </Link>
                    <Link
                      href={`/properties/edit/${p.id}`}
                      className="inline-block rounded border px-3 py-1 text-sm hover:bg-gray-50"
                    >
                      Editar
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Nenhum imóvel cadastrado.</p>
        )}
      </main>
    </div>
  );
}
