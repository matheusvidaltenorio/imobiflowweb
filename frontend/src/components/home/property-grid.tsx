'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
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
          <Card key={i} className="overflow-hidden p-0">
            <div className="h-52 animate-pulse bg-surface-muted" />
            <div className="space-y-3 p-5">
              <div className="h-4 w-[75%] animate-pulse rounded-lg bg-surface-muted" />
              <div className="h-4 w-[50%] animate-pulse rounded-lg bg-surface-muted" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(
        (p: {
          id: string;
          title: string;
          price: number;
          images: { url: string }[];
          city: string;
          neighborhood: string;
        }) => (
          <Link key={p.id} href={`/property/${p.id}`} className="group block">
            <Card className="h-full overflow-hidden p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
              <div className="relative h-52 bg-gradient-to-br from-surface-muted to-gray-100">
                {p.images?.[0]?.url ? (
                  <Image
                    src={p.images[0].url}
                    alt={p.title}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-medium text-gray-400">Sem imagem</div>
                )}
              </div>
              <div className="p-5">
                <h3 className="line-clamp-2 min-h-[2.5rem] font-bold leading-snug text-primary-950">{p.title}</h3>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-gray-500">
                  <MapPin className="h-4 w-4 shrink-0 text-accent-500" />
                  {p.neighborhood}, {p.city}
                </p>
                <p className="mt-3 text-xl font-bold text-accent-600">{formatPrice(Number(p.price))}</p>
                <span className="mt-3 inline-block text-xs font-bold uppercase tracking-wide text-primary-600 opacity-0 transition group-hover:opacity-100">
                  Ver detalhes →
                </span>
              </div>
            </Card>
          </Link>
        ),
      )}
    </div>
  );
}
