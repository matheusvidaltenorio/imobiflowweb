'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function LeadForm({ propertyId }: { propertyId: string }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      await api.post('/leads', { propertyId, ...data });
      toast({ title: 'Mensagem enviada!', description: 'Entraremos em contato em breve.', type: 'success' });
      reset();
    } catch {
      toast({ title: 'Erro ao enviar', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label>Nome</Label>
        <Input {...register('name')} required />
      </div>
      <div>
        <Label>Email</Label>
        <Input type="email" {...register('email')} required />
      </div>
      <div>
        <Label>Telefone</Label>
        <Input {...register('phone')} />
      </div>
      <div>
        <Label>Mensagem</Label>
        <textarea
          {...register('message')}
          className="flex min-h-[80px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Conte-nos sobre seu interesse..."
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Enviando...' : 'Enviar'}
      </Button>
    </form>
  );
}
