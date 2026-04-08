'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Trash2, Layers } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toaster';
import { PageHeader } from '@/components/dashboard/page-header';
import { EmptyState } from '@/components/dashboard/empty-state';
import { DevelopmentCover } from '@/components/developments/development-cover';

export default function DevelopmentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: developments, isLoading } = useQuery({
    queryKey: ['developments'],
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

  const deleteDev = useMutation({
    mutationFn: (id: string) => api.delete(`/developments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developments'] });
      toast({ title: 'Loteamento removido', type: 'success' });
    },
  });

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Loteamentos"
          description="Cadastre empreendimentos, organize quadras e acompanhe a disponibilidade dos lotes em um só lugar."
          actions={
            <Link href="/developments/new">
              <Button type="button" className="gap-2 shadow-md">
                <Plus className="h-4 w-4" />
                Novo loteamento
              </Button>
            </Link>
          }
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
                className="group overflow-hidden border-surface-muted/90 p-0 transition-shadow duration-200 hover:shadow-card-hover"
              >
                <div className="flex flex-col gap-0 sm:flex-row">
                  <div className="relative h-36 w-full shrink-0 sm:h-auto sm:w-44">
                    <DevelopmentCover
                      coverImage={d.coverImage}
                      coverImageAlt={d.coverImageAlt}
                      name={d.name}
                      className="h-full w-full sm:min-h-[140px]"
                      imgClassName="h-full w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-4 p-6 sm:flex-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-800 sm:hidden">
                        <MapPin className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-primary-950">{d.name}</h3>
                        {d.slug ? (
                          <p className="mt-0.5 font-mono text-[10px] text-gray-400">/{d.slug}</p>
                        ) : null}
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-gray-400" />
                            {d.city}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span>{d._count?.blocks ?? 0} quadras</span>
                          <span className="text-gray-300">•</span>
                          <span className="inline-flex items-center gap-1 font-medium text-primary-800">
                            <Layers className="h-3.5 w-3.5" />
                            {d.lotsCount ?? 0} lotes
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
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
                    <Button
                      variant="destructive"
                      size="sm"
                      type="button"
                      className="gap-1.5"
                      onClick={() => {
                        if (confirm('Excluir este loteamento? Esta ação não pode ser desfeita.')) {
                          deleteDev.mutate(d.id);
                        }
                      }}
                      disabled={deleteDev.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={MapPin}
            title="Nenhum loteamento cadastrado"
            description="Comece criando o primeiro empreendimento para cadastrar quadras e lotes."
            action={
              <Link href="/developments/new">
                <Button type="button" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar loteamento
                </Button>
              </Link>
            }
          />
        )}
      </div>
    </main>
  );
}
