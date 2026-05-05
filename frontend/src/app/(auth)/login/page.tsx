'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toaster';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type FormData = z.infer<typeof schema>;

const DEV_TEST_PASSWORD = '123456';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const isDev = process.env.NODE_ENV === 'development';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  function fillQuickLogin(email: string) {
    setValue('email', email, { shouldValidate: true });
    setValue('password', DEV_TEST_PASSWORD, { shouldValidate: true });
  }

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const u = await login(data.email, data.password);
      toast({ title: 'Login realizado!', type: 'success' });
      if (u.role === 'GESTORA') {
        router.push('/gestora');
      } else if (u.role === 'ADMIN') {
        router.push('/admin');
      } else if (u.role === 'CORRETOR') {
        router.push('/dashboard');
      } else {
        router.push('/');
      }
      router.refresh();
    } catch (err: unknown) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';
      let msg = 'Erro ao entrar';
      if (isAxiosError(err) && !err.response) {
        msg = `API indisponível (${apiUrl}). Abra outro terminal na pasta do projeto e rode: npm run dev (na raiz) ou npm run dev na pasta backend — a API usa a porta 3333.`;
      } else if (isAxiosError(err) && err.response?.data) {
        const d = err.response.data as { message?: string | string[] };
        msg = Array.isArray(d.message) ? d.message.join(', ') : d.message ?? msg;
      }
      toast({ title: 'Erro', description: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface via-white to-primary-50/40 px-4 py-12">
      <Card className="w-full max-w-md border-primary-100/50 shadow-card">
        <CardHeader className="space-y-2 text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight text-primary-950">
            Imobi<span className="text-accent-500">Flow</span>
          </Link>
          <CardTitle className="text-lg text-gray-700">Entre na sua conta</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="post" noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" {...register('email')} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>
            <Link href="/forgot-password" className="block text-sm text-primary-600 hover:underline">
              Esqueceu a senha?
            </Link>
            {isDev ? (
              <div className="space-y-2 rounded-lg border border-dashed border-primary-200/80 bg-primary-50/30 p-3">
                <p className="text-center text-xs text-gray-600">Desenvolvimento — login rápido (seed local)</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs sm:flex-1"
                    onClick={() => fillQuickLogin('admin@teste.com')}
                  >
                    Entrar como Admin
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs sm:flex-1"
                    onClick={() => fillQuickLogin('corretor1@teste.com')}
                  >
                    Entrar como Corretor
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs sm:flex-1"
                    onClick={() => fillQuickLogin('cliente1@teste.com')}
                  >
                    Entrar como Cliente
                  </Button>
                </div>
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-600">
            Não tem conta?{' '}
            <Link href="/register" className="font-medium text-primary-600 hover:underline">
              Cadastre-se
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
