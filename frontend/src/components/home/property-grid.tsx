'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Card } from '@/components/ui/card';

export function PropertyGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ['properties-public'],
    queryFn: async () => {
      const { data } = await api.get('/properties/public');
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <div className="h-48 animate-pulse bg-gray-200" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((p: { id: string; title: string; price: number; images: { url: string }[]; city: string; neighborhood: string }) => (
        <Link key={p.id} href={`/property/${p.id}`}>
          <Card className="overflow-hidden transition-shadow hover:shadow-lg">
            <div className="relative h-48 bg-gray-100">
              {p.images?.[0]?.url ? (
                <Image
                  src={p.images[0].url}
                  alt={p.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400">Sem imagem</div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900">{p.title}</h3>
              <p className="text-sm text-gray-500">
                {p.neighborhood}, {p.city}
              </p>
              <p className="mt-2 text-lg font-bold text-primary-600">{formatPrice(Number(p.price))}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
