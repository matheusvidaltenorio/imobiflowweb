'use client';

import { useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import Link from 'next/link';
import { DevelopmentLotsMap, type GeoMapDevelopment, type GeoMapLot } from '@/components/maps/development-lots-map';
import { DevelopmentCover } from '@/components/developments/development-cover';
import type { DevelopmentLocationPrecision } from '@/components/developments/location-precision-badge';
import { InstagramAdGenerator } from '@/components/marketing/instagram-ad-generator';

const locationPrecisionEnum = z.enum(['EXATA', 'APROXIMADA', 'PENDENTE']);

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  address: z.string().optional(),
  referenceAddress: z.string().optional(),
  city: z.string().min(2),
  state: z.string().max(2).optional().or(z.literal('')),
  neighborhood: z.string().optional(),
  zipCode: z.string().optional(),
  locationPrecision: locationPrecisionEnum,
  locationNotes: z.string().optional(),
  latStr: z.string().optional(),
  lngStr: z.string().optional(),
  placeId: z.string().optional(),
  polygonJson: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type DevDto = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string;
  address?: string;
  referenceAddress?: string | null;
  city: string;
  state?: string | null;
  neighborhood?: string;
  zipCode?: string | null;
  locationPrecision?: DevelopmentLocationPrecision;
  locationNotes?: string | null;
  latitude?: unknown;
  longitude?: unknown;
  placeId?: string | null;
  polygonCoordinates?: unknown;
  coverImage?: string | null;
  coverImageAlt?: string | null;
};

type MapPayload = {
  development: GeoMapDevelopment & { coverImage?: string | null };
  lots: GeoMapLot[];
};

export default function EditDevelopmentPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const { data: dev, isLoading } = useQuery({
    queryKey: ['development', id],
    queryFn: async () => {
      const { data } = await api.get(`/developments/${id}`);
      return data as DevDto;
    },
  });

  const { data: mapData, isLoading: mapLoading } = useQuery({
    queryKey: ['lot-map', id],
    queryFn: async () => {
      const { data } = await api.get<MapPayload>(`/lots/development/${id}/map`);
      return data;
    },
    enabled: !!dev?.id,
  });

  const { register, handleSubmit, setValue, getValues } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: dev
      ? {
          name: dev.name,
          description: dev.description ?? '',
          address: dev.address ?? '',
          referenceAddress: dev.referenceAddress ?? '',
          city: dev.city,
          state: dev.state ?? '',
          neighborhood: dev.neighborhood ?? '',
          zipCode: dev.zipCode ?? '',
          locationPrecision: dev.locationPrecision ?? 'PENDENTE',
          locationNotes: dev.locationNotes ?? '',
          latStr:
            dev.latitude != null && dev.latitude !== ''
              ? String(Number(dev.latitude as number))
              : '',
          lngStr:
            dev.longitude != null && dev.longitude !== ''
              ? String(Number(dev.longitude as number))
              : '',
          placeId: dev.placeId ?? '',
          polygonJson: dev.polygonCoordinates
            ? JSON.stringify(dev.polygonCoordinates, null, 2)
            : '',
        }
      : undefined,
  });

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/developments/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development', id] });
      queryClient.invalidateQueries({ queryKey: ['developments'] });
      queryClient.invalidateQueries({ queryKey: ['lot-map', id] });
      toast({ title: 'Loteamento atualizado!', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao atualizar', type: 'error' }),
  });

  const geocode = useMutation({
    mutationFn: () =>
      api.post<{
        lat: number;
        lng: number;
        formattedAddress?: string;
        placeId?: string;
      }>('/maps/geocode', {
        referenceAddress: getValues('referenceAddress'),
        address: getValues('address'),
        city: getValues('city'),
        state: getValues('state'),
        zipCode: getValues('zipCode'),
        neighborhood: getValues('neighborhood'),
      }),
    onSuccess: (res) => {
      const d = res.data;
      setValue('latStr', String(d.lat));
      setValue('lngStr', String(d.lng));
      if (d.placeId) setValue('placeId', d.placeId);
      toast({ title: 'Coordenadas obtidas (geocoding no servidor)', type: 'success' });
    },
    onError: () => toast({ title: 'Não foi possível geocodificar. Confira o endereço ou a chave no servidor.', type: 'error' }),
  });

  const uploadCover = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post(`/developments/${id}/cover`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development', id] });
      queryClient.invalidateQueries({ queryKey: ['developments'] });
      toast({ title: 'Capa atualizada', type: 'success' });
    },
    onError: () => toast({ title: 'Erro no upload', type: 'error' }),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/developments/${id}`),
    onSuccess: () => {
      toast({ title: 'Loteamento removido', type: 'success' });
      router.push('/developments');
    },
  });

  function submitDev(d: FormValues) {
    const lt = d.latStr?.trim() ?? '';
    const lg = d.lngStr?.trim() ?? '';
    let latitude: number | null | undefined;
    let longitude: number | null | undefined;
    if (!lt && !lg) {
      latitude = null;
      longitude = null;
    } else if (lt && lg) {
      const la = parseFloat(lt.replace(',', '.'));
      const lo = parseFloat(lg.replace(',', '.'));
      if (!Number.isFinite(la) || !Number.isFinite(lo)) {
        toast({ title: 'Latitude/longitude inválidas', type: 'error' });
        return;
      }
      latitude = la;
      longitude = lo;
    } else {
      toast({ title: 'Preencha latitude e longitude juntos ou deixe ambos vazios.', type: 'error' });
      return;
    }

    let polygonCoordinates: unknown | null | undefined = undefined;
    const pj = d.polygonJson?.trim() ?? '';
    if (pj) {
      try {
        polygonCoordinates = JSON.parse(pj);
      } catch {
        toast({ title: 'Polígono: JSON inválido', type: 'error' });
        return;
      }
    } else if (d.polygonJson !== undefined && d.polygonJson.trim() === '') {
      polygonCoordinates = null;
    }

    update.mutate({
      name: d.name,
      description: d.description?.trim() || undefined,
      address: d.address?.trim() || undefined,
      referenceAddress: d.referenceAddress?.trim() || null,
      city: d.city,
      state: d.state?.trim() || undefined,
      neighborhood: d.neighborhood?.trim() || undefined,
      zipCode: d.zipCode?.trim() || null,
      locationPrecision: d.locationPrecision,
      locationNotes: d.locationNotes?.trim() || null,
      latitude,
      longitude,
      placeId: d.placeId?.trim() || null,
      polygonCoordinates,
    });
  }

  if (isLoading || !dev) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;

  return (
    <main className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Editar Loteamento</h1>
        <div className="flex gap-2">
          <Link href={`/lots?development=${id}`}>
            <Button variant="secondary" type="button" className="gap-1.5">
              <MapPin className="h-4 w-4" />
              Quadras e lotes
            </Button>
          </Link>
          <Link href="/developments">
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>
      </div>

      <Card className="max-w-lg p-6">
        <form onSubmit={handleSubmit(submitDev)} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input {...register('name')} />
          </div>
          <div>
            <Label>Descrição</Label>
            <textarea {...register('description')} className="flex min-h-[80px] w-full rounded-lg border px-3 py-2" />
          </div>
          <div>
            <Label>Endereço</Label>
            <Input {...register('address')} />
          </div>
          <div>
            <Label>Endereço de referência (mapa / geocodificação)</Label>
            <textarea
              {...register('referenceAddress')}
              className="flex min-h-[72px] w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Ex.: Rua e ponto de referência ainda sem CEP confirmado"
            />
          </div>
          <div>
            <Label>Precisão da localização</Label>
            <select
              {...register('locationPrecision')}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="EXATA">EXATA</option>
              <option value="APROXIMADA">APROXIMADA</option>
              <option value="PENDENTE">PENDENTE</option>
            </select>
          </div>
          <div>
            <Label>Observações de localização</Label>
            <textarea
              {...register('locationNotes')}
              className="flex min-h-[72px] w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Notas internas sobre dúvidas de endereço ou fontes"
            />
          </div>
          <div>
            <Label>CEP</Label>
            <Input {...register('zipCode')} placeholder="00000-000" />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input {...register('city')} />
          </div>
          <div>
            <Label>UF</Label>
            <Input {...register('state')} placeholder="SP" maxLength={2} className="uppercase" />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input {...register('neighborhood')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Latitude</Label>
              <Input {...register('latStr')} placeholder="-7.123456" />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input {...register('lngStr')} placeholder="-39.123456" />
            </div>
          </div>
          <input type="hidden" {...register('placeId')} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={geocode.isPending}
              onClick={() => geocode.mutate()}
            >
              {geocode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Buscar coordenadas
            </Button>
            <span className="text-xs text-gray-500">
              Geocoding no backend: Google se <code className="rounded bg-surface-muted px-1">GOOGLE_MAPS_API_KEY</code>{' '}
              estiver definida; senão Nominatim (OSM). Mapas no sistema usam MapLibre.
            </span>
          </div>
          <div>
            <Label>Polígono do loteamento (JSON, opcional)</Label>
            <textarea
              {...register('polygonJson')}
              className="min-h-[100px] w-full rounded-lg border px-3 py-2 font-mono text-xs"
              placeholder='[{"lat":...,"lng":...}, …]'
            />
          </div>
          <div>
            <Label>Imagem de capa</Label>
            <div className="mb-2 max-h-48 overflow-hidden rounded-lg border">
              <DevelopmentCover
                coverImage={dev.coverImage}
                coverImageAlt={dev.coverImageAlt}
                name={dev.name}
                className="h-44 w-full"
                imgClassName="h-full w-full max-h-48"
              />
            </div>
            {dev.slug ? (
              <p className="mb-2 text-xs text-gray-500">
                Slug: <span className="font-mono">{dev.slug}</span> (gerado automaticamente no cadastro)
              </p>
            ) : null}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadCover.mutate(f);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={uploadCover.isPending}
              onClick={() => coverInputRef.current?.click()}
            >
              {uploadCover.isPending ? 'Enviando...' : 'Enviar nova capa'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={update.isPending}>
              Salvar
            </Button>
            <Button type="button" variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
              Excluir
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-10 max-w-5xl space-y-3">
        <h2 className="text-lg font-bold text-primary-950">Mapa do empreendimento e lotes</h2>
        <p className="text-sm text-gray-600">
          Lotes com latitude/longitude ou polígono aparecem automaticamente. Cadastre geo em cada lote para precisão na
          visita.
        </p>
        {mapLoading ? (
          <div className="h-[480px] animate-pulse rounded-xl bg-surface-muted/80" />
        ) : mapData ? (
          <DevelopmentLotsMap development={mapData.development} lots={mapData.lots} />
        ) : null}
      </div>

      <InstagramAdGenerator
        mode="development"
        developmentId={id}
        title="Gerar anúncio geral do loteamento (Instagram)"
      />
    </main>
  );
}
