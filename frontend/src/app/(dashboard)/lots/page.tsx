'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';

export default function LotsPage() {
  const searchParams = useSearchParams();
  const developmentId = searchParams.get('development');
  const blockId = searchParams.get('block');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: blocks } = useQuery({
    queryKey: ['blocks', developmentId],
    queryFn: async () => {
      const { data } = await api.get(`/blocks/development/${developmentId}`);
      return data;
    },
    enabled: !!developmentId,
  });

  const { data: lots } = useQuery({
    queryKey: ['lots', blockId],
    queryFn: async () => {
      const { data } = await api.get(`/lots/block/${blockId}`);
      return data;
    },
    enabled: !!blockId,
  });

  const deleteBlock = useMutation({
    mutationFn: (id: string) => api.delete(`/blocks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', developmentId] });
      toast({ title: 'Quadra removida', type: 'success' });
    },
  });

  const deleteLot = useMutation({
    mutationFn: (id: string) => api.delete(`/lots/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lots', blockId] });
      toast({ title: 'Lote removido', type: 'success' });
    },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Lotes</h1>
          {developmentId && (
            <Link href={blockId ? `/lots/lots/new?development=${developmentId}&block=${blockId}` : `/lots/blocks/new?development=${developmentId}`}>
              <Button>{blockId ? 'Novo Lote' : 'Nova Quadra'}</Button>
            </Link>
          )}
        </div>

        {!developmentId ? (
          <p className="text-gray-500">Selecione um loteamento na <Link href="/developments" className="text-primary-600 hover:underline">página de loteamentos</Link>.</p>
        ) : !blockId ? (
          <div className="space-y-2">
            <p className="text-gray-600">Selecione uma quadra:</p>
            {blocks?.map((b: { id: string; name: string }) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50">
                <Link href={`/lots?development=${developmentId}&block=${b.id}`} className="flex-1 font-medium">
                  {b.name}
                </Link>
                <div className="flex gap-2">
                  <Button variant="destructive" size="sm" onClick={() => confirm('Excluir quadra?') && deleteBlock.mutate(b.id)}>
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lots?.map((l: { id: string; number: string; area?: number; price?: number; status: string }) => (
              <Card key={l.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">Lote {l.number}</p>
                    <p className="text-sm text-gray-500">{l.area ? `${l.area}m²` : '-'}</p>
                    <p className="font-bold text-primary-600">{formatPrice(Number(l.price ?? 0))}</p>
                    <span className="mt-2 inline-block rounded bg-gray-100 px-2 py-1 text-xs">{l.status}</span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Link href={`/lots/lots/edit/${l.id}?development=${developmentId}&block=${blockId}`}>
                      <Button variant="outline" size="sm">Editar</Button>
                    </Link>
                    <Button variant="destructive" size="sm" onClick={() => confirm('Excluir lote?') && deleteLot.mutate(l.id)}>
                      Excluir
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
