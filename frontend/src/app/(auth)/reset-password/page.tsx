'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toaster';

const schema = z.object({
  newPassword: z.string().min(6, 'Mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'As senhas não conferem',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

function ResetPasswordForm() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();
  const { toast } = useToast();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    if (!token) {
      toast({ title: 'Token inválido', description: 'Acesse pelo link enviado no email.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: data.newPassword });
      toast({ title: 'Senha alterada!', type: 'success' });
      router.push('/login');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Token expirado ou inválido.';
      toast({ title: 'Erro', description: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface via-white to-primary-50/40 px-4 py-12">
        <Card className="w-full max-w-md border-primary-100/50 shadow-card">
          <CardHeader className="space-y-2 text-center">
            <Link href="/" className="text-2xl font-bold tracking-tight text-primary-950">
              Imobi<span className="text-accent-500">Flow</span>
            </Link>
            <CardTitle className="text-lg text-gray-700">Link inválido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-center text-sm leading-relaxed text-gray-600">
              O link de recuperação de senha está incompleto ou expirou. Solicite um novo.
            </p>
            <Link href="/forgot-password" className="block">
              <Button className="w-full">Solicitar novo link</Button>
            </Link>
            <p className="mt-4 text-center">
              <Link href="/login" className="text-sm font-semibold text-primary-700 hover:text-primary-800 hover:underline">
                Voltar ao login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface via-white to-primary-50/40 px-4 py-12">
      <Card className="w-full max-w-md border-primary-100/50 shadow-card">
        <CardHeader className="space-y-2 text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight text-primary-950">
            Imobi<span className="text-accent-500">Flow</span>
          </Link>
          <CardTitle className="text-lg text-gray-700">Redefinir senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="post" noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input id="newPassword" type="password" {...register('newPassword')} />
              {errors.newPassword && <p className="text-sm text-red-500">{errors.newPassword.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Alterando...' : 'Alterar senha'}
            </Button>
          </form>
          <p className="mt-4 text-center">
            <Link href="/login" className="text-sm font-semibold text-primary-700 hover:text-primary-800 hover:underline">
              Voltar ao login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary-200 border-t-accent-500" />
            <p className="text-sm font-medium text-gray-500">Carregando…</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
