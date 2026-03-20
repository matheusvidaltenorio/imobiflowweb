'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  DISPONIVEL: 'bg-success-50 text-success-700 ring-success-500/20',
  VENDIDO: 'bg-primary-100 text-primary-800 ring-primary-500/15',
  RESERVADO: 'bg-amber-50 text-amber-800 ring-amber-500/20',
  INDISPONIVEL: 'bg-gray-100 text-gray-600 ring-gray-200',
};

export default function PropertiesPage() {
  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties-mine'],
    queryFn: async () => {
      const { data } = await api.get('/properties');
      return data;
    },
  });

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 p-6 md:p-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-primary-950">Meus imóveis</h1>
              <p className="mt-2 max-w-xl text-gray-600">
                Gerencie seu portfólio com clareza. Destaque preço e localização para converter mais visitas.
              </p>
            </div>
            <Link href="/properties/new">
              <Button type="button" className="w-full sm:w-auto">
                Novo imóvel
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-80 animate-pulse rounded-2xl bg-surface-muted/80" />
              ))}
            </div>
          ) : properties?.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map(
                (p: {
                  id: string;
                  title: string;
                  price: number;
                  status: string;
                  images: { url: string }[];
                  city: string;
                }) => (
                  <Card key={p.id} className="group overflow-hidden p-0 transition-shadow hover:shadow-card-hover">
                    <div className="relative h-44 bg-gradient-to-br from-surface-muted to-gray-100">
                      {p.images?.[0]?.url ? (
                        <Image src={p.images[0].url} alt={p.title} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm font-medium text-gray-400">
                          Sem foto
                        </div>
                      )}
                      <span
                        className={cn(
                          'absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold ring-1 backdrop-blur-sm',
                          statusStyles[p.status] ?? 'bg-white/90 text-gray-700 ring-gray-200',
                        )}
                      >
                        {p.status}
                      </span>
                    </div>
                    <div className="p-5">
                      <h3 className="line-clamp-2 font-bold text-primary-950">{p.title}</h3>
                      <p className="mt-1 text-sm font-medium text-gray-500">{p.city}</p>
                      <p className="mt-3 text-xl font-bold text-accent-600">{formatPrice(Number(p.price))}</p>
                      <div className="mt-4 flex gap-2">
                        <Link href={`/property/${p.id}`} className="flex-1">
                          <Button variant="outline" size="sm" type="button" className="w-full">
                            Ver página
                          </Button>
                        </Link>
                        <Link href={`/properties/edit/${p.id}`} className="flex-1">
                          <Button variant="secondary" size="sm" type="button" className="w-full">
                            Editar
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                ),
              )}
            </div>
          ) : (
            <Card className="border-dashed border-surface-muted p-12 text-center">
              <p className="font-semibold text-gray-700">Nenhum imóvel cadastrado</p>
              <p className="mt-2 text-sm text-gray-500">Comece cadastrando seu primeiro imóvel para aparecer nas buscas.</p>
              <Link href="/properties/new">
                <Button className="mt-6" type="button">
                  Cadastrar imóvel
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
