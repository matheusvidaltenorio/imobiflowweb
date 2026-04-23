'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import { PageHeader } from '@/components/dashboard/page-header';

type PublishMode = 'IMMEDIATE' | 'PENDING_REVIEW';

type AccessRow = {
  id: string;
  userId: string;
  developmentId: string;
  spreadsheetImportEnabled: boolean;
  assistedImageEnabled: boolean;
  publishMode: PublishMode;
  user: { id: string; name: string; email: string; role: string };
  development: { id: string; name: string; city: string };
};

export default function AdminGestoraAccessPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newUserId, setNewUserId] = useState('');
  const [newDevId, setNewDevId] = useState('');
  const [newPublish, setNewPublish] = useState<PublishMode>('IMMEDIATE');
  const [newSpreadsheet, setNewSpreadsheet] = useState(true);
  const [newAssisted, setNewAssisted] = useState(true);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['admin-gestora-access'],
    queryFn: async () => {
      const { data } = await api.get<AccessRow[]>('/admin/manager-development-access');
      return data;
    },
  });

  const { data: gestoraUsers } = useQuery({
    queryKey: ['admin-users', 'GESTORA'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; email: string }>>('/users?role=GESTORA');
      return data;
    },
  });

  const { data: developments } = useQuery({
    queryKey: ['developments'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; city: string }>>('/developments');
      return data;
    },
  });

  const patchAccess = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      spreadsheetImportEnabled?: boolean;
      assistedImageEnabled?: boolean;
      publishMode?: PublishMode;
    }) => api.patch(`/admin/manager-development-access/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-gestora-access'] });
      toast({ title: 'Vínculo atualizado', type: 'success' });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao atualizar';
      toast({ title: msg, type: 'error' });
    },
  });

  const createAccess = useMutation({
    mutationFn: () =>
      api.post('/admin/manager-development-access', {
        userId: newUserId,
        developmentId: newDevId,
        publishMode: newPublish,
        spreadsheetImportEnabled: newSpreadsheet,
        assistedImageEnabled: newAssisted,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-gestora-access'] });
      toast({ title: 'Vínculo criado', type: 'success' });
      setNewUserId('');
      setNewDevId('');
      setNewPublish('IMMEDIATE');
      setNewSpreadsheet(true);
      setNewAssisted(true);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao criar vínculo';
      toast({ title: msg, type: 'error' });
    },
  });

  const deleteAccess = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/manager-development-access/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-gestora-access'] });
      toast({ title: 'Vínculo removido', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao remover', type: 'error' }),
  });

  const canCreate = !!newUserId && !!newDevId;

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader
          title="Gestoras × loteamentos"
          description="Defina quais contas de perfil Gestora podem operar cada empreendimento, o modo de publicação e os canais de atualização (manual, imagem, planilha)."
        />

        <Card className="space-y-4 p-6">
          <h2 className="text-sm font-bold text-primary-950">Novo vínculo</h2>
          <p className="text-xs text-slate-600">
            O usuário precisa estar com perfil <strong>Gestora</strong> em Usuários. Cada par gestora + loteamento é único.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Gestora</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-surface-muted bg-white px-3 text-sm"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {gestoraUsers?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Loteamento</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-surface-muted bg-white px-3 text-sm"
                value={newDevId}
                onChange={(e) => setNewDevId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {developments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.city}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Publicação</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-surface-muted bg-white px-3 text-sm"
                value={newPublish}
                onChange={(e) => setNewPublish(e.target.value as PublishMode)}
              >
                <option value="IMMEDIATE">Imediata (snapshot oficial ao salvar)</option>
                <option value="PENDING_REVIEW">Pendente de aprovação do admin</option>
              </select>
            </div>
            <div className="flex flex-col justify-end gap-3 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newSpreadsheet} onChange={(e) => setNewSpreadsheet(e.target.checked)} />
                Planilha habilitada
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newAssisted} onChange={(e) => setNewAssisted(e.target.checked)} />
                Imagem assistida habilitada
              </label>
            </div>
          </div>
          <Button
            type="button"
            variant="brand"
            disabled={!canCreate || createAccess.isPending}
            onClick={() => createAccess.mutate()}
          >
            Adicionar vínculo
          </Button>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-sm font-bold text-primary-950">Vínculos ativos</h2>
          {isLoading ? (
            <p className="text-sm text-slate-600">Carregando…</p>
          ) : !rows?.length ? (
            <p className="text-sm text-slate-600">Nenhum vínculo cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-3">Gestora</th>
                    <th className="pb-2 pr-3">Loteamento</th>
                    <th className="pb-2 pr-3">Planilha</th>
                    <th className="pb-2 pr-3">Imagem</th>
                    <th className="pb-2 pr-3">Publicação</th>
                    <th className="pb-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-surface-muted align-middle">
                      <td className="py-3 pr-3">
                        <span className="font-medium text-gray-900">{r.user.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-600">{r.user.email}</span>
                      </td>
                      <td className="py-3 pr-3">
                        {r.development.name}
                        <span className="mt-0.5 block text-xs text-slate-600">{r.development.city}</span>
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          type="checkbox"
                          checked={r.spreadsheetImportEnabled}
                          disabled={patchAccess.isPending}
                          onChange={(e) =>
                            patchAccess.mutate({ id: r.id, spreadsheetImportEnabled: e.target.checked })
                          }
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          type="checkbox"
                          checked={r.assistedImageEnabled}
                          disabled={patchAccess.isPending}
                          onChange={(e) =>
                            patchAccess.mutate({ id: r.id, assistedImageEnabled: e.target.checked })
                          }
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <select
                          className="max-w-[200px] rounded border border-surface-muted bg-white px-2 py-1 text-xs"
                          value={r.publishMode}
                          disabled={patchAccess.isPending}
                          onChange={(e) =>
                            patchAccess.mutate({ id: r.id, publishMode: e.target.value as PublishMode })
                          }
                        >
                          <option value="IMMEDIATE">Imediata</option>
                          <option value="PENDING_REVIEW">Revisão</option>
                        </select>
                      </td>
                      <td className="py-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-rose-700"
                          disabled={deleteAccess.isPending}
                          onClick={() => {
                            if (
                              typeof window !== 'undefined' &&
                              window.confirm('Remover este vínculo? A gestora deixa de ver o loteamento.')
                            ) {
                              deleteAccess.mutate(r.id);
                            }
                          }}
                        >
                          Remover
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
