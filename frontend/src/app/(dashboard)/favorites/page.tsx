'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';

export default function FavoritesPage() {
  const { data: favorites, isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const { data } = await api.get('/favorites');
      return data;
    },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="mb-8 text-2xl font-bold">Meus Favoritos</h1>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : favorites?.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((fav: { id: string; property: { id: string; title: string; price: number; images: { url: string }[]; neighborhood: string; city: string } }) => (
              <Link key={fav.id} href={`/property/${fav.property.id}`}>
                <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                  <div className="relative h-48 bg-gray-100">
                    {fav.property.images?.[0]?.url ? (
                      <Image
                        src={fav.property.images[0].url}
                        alt={fav.property.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400">Sem imagem</div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold">{fav.property.title}</h3>
                    <p className="text-sm text-gray-500">
                      {fav.property.neighborhood}, {fav.property.city}
                    </p>
                    <p className="mt-2 font-bold text-primary-600">{formatPrice(Number(fav.property.price))}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Você ainda não tem favoritos. Explore os imóveis e adicione aos favoritos!</p>
        )}
      </main>
    </div>
  );
}
