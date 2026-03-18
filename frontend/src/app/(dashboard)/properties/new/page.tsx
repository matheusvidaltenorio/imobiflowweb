'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';

const schema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  type: z.enum(['CASA', 'APARTAMENTO', 'TERRENO', 'COMERCIAL', 'RURAL']),
  status: z.enum(['DISPONIVEL', 'VENDIDO', 'RESERVADO', 'INDISPONIVEL']).default('DISPONIVEL'),
  price: z.number().min(0),
  area: z.number().optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  garageSpaces: z.number().optional(),
  city: z.string().min(2),
  neighborhood: z.string().min(2),
  street: z.string().optional(),
  number: z.string().optional(),
  zipCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewPropertyPage() {
  const router = useRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'DISPONIVEL', type: 'CASA' },
  });

  const create = useMutation({
    mutationFn: (data: FormData) => api.post('/properties', data),
    onSuccess: (res: { data?: { id?: string } }) => {
      const id = res?.data?.id;
      toast({ title: 'Imóvel criado! Adicione fotos na próxima tela.', type: 'success' });
      router.push(id ? `/properties/edit/${id}` : '/properties');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro';
      toast({ title: msg, type: 'error' });
    },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="mb-8 text-2xl font-bold">Novo Imóvel</h1>

        <Card className="max-w-2xl p-6">
          <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input {...register('title')} />
              {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
            </div>
            <div>
              <Label>Descrição</Label>
              <textarea
                {...register('description')}
                className="flex min-h-[100px] w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tipo</Label>
                <select {...register('type')} className="flex h-10 w-full rounded-lg border px-3 py-2">
                  <option value="CASA">Casa</option>
                  <option value="APARTAMENTO">Apartamento</option>
                  <option value="TERRENO">Terreno</option>
                  <option value="COMERCIAL">Comercial</option>
                  <option value="RURAL">Rural</option>
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select {...register('status')} className="flex h-10 w-full rounded-lg border px-3 py-2">
                  <option value="DISPONIVEL">Disponível</option>
                  <option value="VENDIDO">Vendido</option>
                  <option value="RESERVADO">Reservado</option>
                  <option value="INDISPONIVEL">Indisponível</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <Label>Preço</Label>
                <Input type="number" {...register('price', { valueAsNumber: true })} />
                {errors.price && <p className="text-sm text-red-500">{errors.price.message}</p>}
              </div>
              <div>
                <Label>Área (m²)</Label>
                <Input type="number" {...register('area', { valueAsNumber: true })} />
              </div>
              <div>
                <Label>Quartos</Label>
                <Input type="number" {...register('bedrooms', { valueAsNumber: true })} />
              </div>
              <div>
                <Label>Banheiros</Label>
                <Input type="number" {...register('bathrooms', { valueAsNumber: true })} />
              </div>
            </div>
            <div>
              <Label>Vagas garagem</Label>
              <Input type="number" {...register('garageSpaces', { valueAsNumber: true })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Cidade</Label>
                <Input {...register('city')} />
                {errors.city && <p className="text-sm text-red-500">{errors.city.message}</p>}
              </div>
              <div>
                <Label>Bairro</Label>
                <Input {...register('neighborhood')} />
                {errors.neighborhood && <p className="text-sm text-red-500">{errors.neighborhood.message}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Rua</Label>
                <Input {...register('street')} />
              </div>
              <div>
                <Label>Número</Label>
                <Input {...register('number')} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input {...register('zipCode')} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Latitude (opcional, para mapa)</Label>
                <Input type="number" step="any" {...register('latitude', { valueAsNumber: true })} placeholder="-23.5505" />
              </div>
              <div>
                <Label>Longitude (opcional, para mapa)</Label>
                <Input type="number" step="any" {...register('longitude', { valueAsNumber: true })} placeholder="-46.6333" />
              </div>
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Salvando...' : 'Criar Imóvel'}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
