'use client';

import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { geocodeAddress } from '@/lib/geocode';
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
  status: z.enum(['DISPONIVEL', 'VENDIDO', 'RESERVADO', 'INDISPONIVEL']),
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

export default function EditPropertyPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      const { data } = await api.get(`/properties/${id}`);
      return data;
    },
  });

  const [geocoding, setGeocoding] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: property
      ? {
          title: property.title,
          description: property.description ?? '',
          type: property.type,
          status: property.status,
          price: Number(property.price),
          area: property.area ? Number(property.area) : undefined,
          bedrooms: property.bedrooms ?? undefined,
          bathrooms: property.bathrooms ?? undefined,
          garageSpaces: property.garageSpaces ?? undefined,
          city: property.city,
          neighborhood: property.neighborhood,
          street: property.street ?? '',
          number: property.number ?? '',
          zipCode: property.zipCode ?? '',
          latitude: property.latitude ? Number(property.latitude) : undefined,
          longitude: property.longitude ? Number(property.longitude) : undefined,
        }
      : undefined,
  });

  async function handleFetchLocation() {
    const city = watch('city');
    const neighborhood = watch('neighborhood');
    if (!city?.trim() || !neighborhood?.trim()) {
      toast({ title: 'Preencha Cidade e Bairro para buscar localização', type: 'error' });
      return;
    }
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      toast({ title: 'Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para geocodificar', type: 'error' });
      return;
    }
    setGeocoding(true);
    try {
      const result = await geocodeAddress({
        street: watch('street'),
        number: watch('number'),
        neighborhood: watch('neighborhood'),
        city: watch('city'),
        zipCode: watch('zipCode'),
      });
      if (result) {
        setValue('latitude', result.lat);
        setValue('longitude', result.lng);
        toast({ title: 'Localização encontrada!', type: 'success' });
      } else {
        toast({ title: 'Endereço não encontrado. Tente ser mais específico.', type: 'error' });
      }
    } catch {
      toast({ title: 'Erro ao buscar localização', type: 'error' });
    } finally {
      setGeocoding(false);
    }
  }

  const update = useMutation({
    mutationFn: (data: FormData) => api.patch(`/properties/${id}`, data),
    onSuccess: () => {
      toast({ title: 'Imóvel atualizado!', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['property', id] });
    },
    onError: () => toast({ title: 'Erro ao atualizar', type: 'error' }),
  });

  const addImage = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/properties/${id}/images`, form);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      toast({ title: 'Foto adicionada!', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao enviar foto', type: 'error' }),
  });

  const removeImage = useMutation({
    mutationFn: (imageId: string) => api.delete(`/properties/${id}/images/${imageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      toast({ title: 'Foto removida', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao remover', type: 'error' }),
  });

  const generateDesc = useMutation({
    mutationFn: () => api.post(`/properties/${id}/generate-description`),
    onSuccess: (res: { data?: { description?: string } }) => {
      if (res?.data?.description) {
        queryClient.invalidateQueries({ queryKey: ['property', id] });
        toast({ title: 'Descrição gerada!', type: 'success' });
      }
    },
    onError: () => toast({ title: 'Erro ao gerar descrição', type: 'error' }),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) addImage.mutate(file);
    e.target.value = '';
  }

  if (isLoading || !property) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;

  const images = (property.images ?? []) as { id: string; url: string }[];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="mb-8 text-2xl font-bold">Editar Imóvel</h1>

        <Card className="max-w-2xl p-6">
          <form onSubmit={handleSubmit((d) => update.mutate(d))} className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input {...register('title')} />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label>Descrição</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => generateDesc.mutate()}
                  disabled={generateDesc.isPending}
                >
                  {generateDesc.isPending ? 'Gerando...' : 'Gerar com IA'}
                </Button>
              </div>
              <textarea {...register('description')} className="mt-1 flex min-h-[100px] w-full rounded-lg border px-3 py-2" />
            </div>
            <div>
              <Label>Fotos do imóvel</Label>
              <div className="mt-2 flex flex-wrap gap-4">
                {images.map((img) => (
                  <div key={img.id} className="relative">
                    <div className="relative h-24 w-32 overflow-hidden rounded-lg border bg-gray-100">
                      <Image src={img.url} alt="" fill className="object-cover" sizes="128px" />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage.mutate(img.id)}
                      disabled={removeImage.isPending}
                      className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label className="flex h-24 w-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-500">
                  <span className="text-xs text-gray-500">+ Adicionar</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={addImage.isPending}
                  />
                </label>
              </div>
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
              </div>
              <div>
                <Label>Bairro</Label>
                <Input {...register('neighborhood')} />
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
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Localização no mapa</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFetchLocation}
                  disabled={geocoding || !watch('city')?.trim() || !watch('neighborhood')?.trim()}
                >
                  {geocoding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <MapPin className="mr-1.5 h-4 w-4" />
                      Preencher pelo endereço
                    </>
                  )}
                </Button>
              </div>
              <p className="mb-2 text-xs text-gray-500">
                Preencha o endereço acima e clique em &quot;Preencher pelo endereço&quot; para obter as coordenadas automaticamente.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Latitude</Label>
                  <Input type="number" step="any" {...register('latitude', { valueAsNumber: true })} placeholder="-23.5505" />
                </div>
                <div>
                  <Label className="text-xs">Longitude</Label>
                  <Input type="number" step="any" {...register('longitude', { valueAsNumber: true })} placeholder="-46.6333" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/properties')}>
                Voltar
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
