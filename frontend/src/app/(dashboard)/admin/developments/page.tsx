'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Layers, MapPin, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/dashboard/page-header';
import { EmptyState } from '@/components/dashboard/empty-state';
import { DevelopmentCover } from '@/components/developments/development-cover';

export default function AdminDevelopmentsPage() {
  const { data: developments, isLoading } = useQuery({
    queryKey: ['admin-developments'],
    queryFn: async () => {
      const { data } = await api.get<
        Array<{
          id: string;
          name: string;
          city: string;
          slug?: string | null;
          coverImage?: string | null;
          coverImageAlt?: string | null;
          lotsCount?: number;
          _count?: { properties: number; blocks: number };
        }>
      >('/developments');
      return data;
    },
  });

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Loteamentos"
          description="Visão administrativa dos empreendimentos. Abra quadras e lotes pelo inventário."
        />

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : developments?.length ? (
          <div className="space-y-4">
            {developments.map((d) => (
              <Card
                key={d.id}
                className="flex flex-col overflow-hidden p-0 transition-shadow hover:shadow-card-hover sm:flex-row sm:items-stretch"
              >
                <div className="relative h-32 w-full shrink-0 sm:h-auto sm:w-40">
                  <DevelopmentCover
                    coverImage={d.coverImage}
                    coverImageAlt={d.coverImageAlt}
                    name={d.name}
                    className="h-full w-full"
                    imgClassName="h-full w-full"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-800 sm:hidden">
                    <MapPin className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-primary-950">{d.name}</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {d.city} • {d._count?.blocks ?? 0} quadras •{' '}
                      <span className="inline-flex items-center gap-1 font-medium text-primary-800">
                        <Layers className="h-3.5 w-3.5" />
                        {d.lotsCount ?? 0} lotes
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/lots?development=${d.id}`}>
                    <Button variant="brand" size="sm" type="button" className="gap-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      Lotes
                    </Button>
                  </Link>
                  <Link href={`/developments/edit/${d.id}`}>
                    <Button variant="outline" size="sm" type="button" className="gap-1.5">
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                  </Link>
                </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={MapPin}
            title="Nenhum loteamento"
            description="Não há empreendimentos cadastrados no sistema."
          />
        )}
      </div>
    </main>
  );
}
