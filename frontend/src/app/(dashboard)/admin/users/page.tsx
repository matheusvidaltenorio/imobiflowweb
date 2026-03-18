'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>('');
  const [editActive, setEditActive] = useState<boolean>(true);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return data;
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, role, isActive }: { id: string; role: string; isActive: boolean }) =>
      api.patch(`/users/${id}`, { role, isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditing(null);
      toast({ title: 'Usuário atualizado', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao atualizar', type: 'error' }),
  });

  function startEdit(u: { id: string; role: string; isActive: boolean }) {
    setEditing(u.id);
    setEditRole(u.role);
    setEditActive(u.isActive);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="mb-8 text-2xl font-bold">Usuários</h1>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : users?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left font-medium">Nome</th>
                  <th className="pb-3 text-left font-medium">Email</th>
                  <th className="pb-3 text-left font-medium">Perfil</th>
                  <th className="pb-3 text-left font-medium">Status</th>
                  <th className="pb-3 text-left font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: { id: string; name: string; email: string; role: string; isActive: boolean }) => (
                  <tr key={u.id} className="border-b">
                    <td className="py-3">{u.name}</td>
                    <td className="py-3">{u.email}</td>
                    <td className="py-3">
                      {editing === u.id ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="rounded border px-2 py-1"
                        >
                          <option value="CLIENTE">Cliente</option>
                          <option value="CORRETOR">Corretor</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      ) : (
                        u.role
                      )}
                    </td>
                    <td className="py-3">
                      {editing === u.id ? (
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => setEditActive(e.target.checked)}
                          />
                          {editActive ? 'Ativo' : 'Inativo'}
                        </label>
                      ) : (
                        <span className={u.isActive ? 'text-green-600' : 'text-red-600'}>
                          {u.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      {editing === u.id ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateUser.mutate({ id: u.id, role: editRole, isActive: editActive })}
                            disabled={updateUser.isPending}
                          >
                            Salvar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => startEdit(u)}>
                          Editar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">Nenhum usuário.</p>
        )}
      </main>
    </div>
  );
}
