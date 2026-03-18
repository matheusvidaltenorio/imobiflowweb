'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';

const profileSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Mínimo 6 caracteres'),
  newPassword: z.string().min(6, 'Mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, { message: 'As senhas não conferem', path: ['confirmPassword'] });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user-me'],
    queryFn: async () => {
      const { data } = await api.get('/users/me');
      return data;
    },
  });

  const { register: regProfile, handleSubmit: handleProfile } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: user ? { name: user.name, phone: user.phone ?? '' } : undefined,
  });

  const { register: regPass, handleSubmit: handlePass, reset: resetPass } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const updateProfile = useMutation({
    mutationFn: (data: ProfileForm) => api.patch('/users/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-me'] });
      toast({ title: 'Perfil atualizado', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao atualizar', type: 'error' }),
  });

  const updatePassword = useMutation({
    mutationFn: (d: PasswordForm) => api.patch('/users/me/password', { currentPassword: d.currentPassword, newPassword: d.newPassword }),
    onSuccess: () => {
      resetPass();
      toast({ title: 'Senha alterada!', type: 'success' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Senha atual incorreta';
      toast({ title: msg, type: 'error' });
    },
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="mb-8 text-2xl font-bold">Meu Perfil</h1>

        <div className="space-y-8">
          <Card className="max-w-md p-6">
            <h2 className="mb-4 font-semibold">Dados pessoais</h2>
            <form onSubmit={handleProfile((d) => updateProfile.mutate(d))} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input value={user?.email} disabled className="bg-gray-50" />
              </div>
              <div>
                <Label>Nome</Label>
                <Input {...regProfile('name')} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input {...regProfile('phone')} />
              </div>
              <Button type="submit" disabled={updateProfile.isPending}>Salvar</Button>
            </form>
          </Card>

          <Card className="max-w-md p-6">
            <h2 className="mb-4 font-semibold">Alterar senha</h2>
            <form onSubmit={handlePass((d) => updatePassword.mutate(d))} className="space-y-4">
              <div>
                <Label>Senha atual</Label>
                <Input type="password" {...regPass('currentPassword')} />
              </div>
              <div>
                <Label>Nova senha</Label>
                <Input type="password" {...regPass('newPassword')} />
              </div>
              <div>
                <Label>Confirmar nova senha</Label>
                <Input type="password" {...regPass('confirmPassword')} />
              </div>
              <Button type="submit" disabled={updatePassword.isPending}>
                {updatePassword.isPending ? 'Alterando...' : 'Alterar senha'}
              </Button>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}
