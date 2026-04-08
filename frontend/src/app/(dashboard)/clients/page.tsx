'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, UserCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/dashboard/page-header';
import { EmptyState } from '@/components/dashboard/empty-state';

export default function ClientsPage() {
  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await api.get('/clients');
      return data;
    },
  });

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Clientes"
          description="Cadastro de pessoas que já passaram pelo funil — acompanhe visitas e leads vinculados."
          actions={
            <Link href="/clients/new">
              <Button type="button" className="gap-2 shadow-md">
                <Plus className="h-4 w-4" />
                Novo cliente
              </Button>
            </Link>
          }
        />

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : clients?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map(
              (c: {
                id: string;
                name: string;
                email: string;
                phone?: string;
                _count?: { visits: number; leads: number };
              }) => (
                <Card
                  key={c.id}
                  className="border-surface-muted/90 p-5 transition-shadow duration-200 hover:shadow-card-hover"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-primary-950">{c.name}</p>
                      <p className="mt-1 truncate text-sm text-gray-600">{c.email}</p>
                      {c.phone ? <p className="mt-0.5 text-sm text-gray-500">{c.phone}</p> : null}
                      <p className="mt-3 text-xs font-medium text-gray-400">
                        {c._count?.visits ?? 0} visitas · {c._count?.leads ?? 0} leads
                      </p>
                    </div>
                    <Link href={`/clients/edit/${c.id}`}>
                      <Button variant="outline" size="sm" type="button">
                        Editar
                      </Button>
                    </Link>
                  </div>
                </Card>
              ),
            )}
          </div>
        ) : (
          <EmptyState
            icon={UserCircle}
            title="Nenhum cliente cadastrado"
            description="Cadastre clientes para registrar visitas e evoluir negociações com histórico organizado."
            action={
              <Link href="/clients/new">
                <Button type="button" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Cadastrar primeiro cliente
                </Button>
              </Link>
            }
          />
        )}
      </div>
    </main>
  );
}
