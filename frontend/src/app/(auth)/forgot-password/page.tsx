'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toaster';

const schema = z.object({ email: z.string().email('Email inválido') });

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  async function onSubmit(data: { email: string }) {
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', data);
      toast({ title: 'Verifique seu email', description: 'Se o email existir, você receberá instruções.', type: 'success' });
    } catch {
      toast({ title: 'Verifique seu email', description: 'Se o email existir, você receberá instruções.', type: 'success' });
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
          <CardTitle className="text-lg text-gray-700">Recuperar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="post" noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" {...register('email')} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar instruções'}
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
