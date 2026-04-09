'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2, MessageCircle, Navigation, RefreshCw, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatPrice } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import Link from 'next/link';
import {
  DevelopmentLotsMap,
  type GeoMapDevelopment,
  type GeoMapLot,
  type GeoMapNearbyPlace,
} from '@/components/maps/development-lots-map';
import type { DevelopmentLocationPrecision } from '@/components/developments/location-precision-badge';
import { CampaignStudioWizard } from '@/components/marketing/campaign-studio-wizard';
import { googleDirectionsUrl } from '@/lib/maps/lot-map-styles';

const schema = z.object({
  number: z.string().min(1),
  area: z.number().optional(),
  price: z.number().optional(),
  status: z.enum(['DISPONIVEL', 'VENDIDO', 'RESERVADO', 'INDISPONIVEL']),
  latStr: z.string().optional(),
  lngStr: z.string().optional(),
  polygonJson: z.string().optional(),
  mapLabel: z.string().optional(),
  referencePoint: z.string().optional(),
  streetFront: z.string().optional(),
});

type LotPitchBundle = {
  primaryType: string;
  arguments: string[];
  lotSummary: string[];
  strategySummary: string;
  suggestions: Array<{ tone: string; message: string; justification: string }>;
};

export default function EditLotPage() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const developmentId = searchParams.get('development');
  const blockId = searchParams.get('block');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pitch, setPitch] = useState<LotPitchBundle | null>(null);
  const [nearbyTravelMode, setNearbyTravelMode] = useState<'driving' | 'walking'>('driving');

  const { data: lot, isLoading } = useQuery({
    queryKey: ['lot', id],
    queryFn: async () => {
      const { data } = await api.get(`/lots/${id}`);
      return data as {
        id: string;
        number: string;
        area?: number;
        price?: number;
        status: string;
        saleScore?: number | null;
        saleClassification?: string | null;
        latitude?: unknown;
        longitude?: unknown;
        polygonCoordinates?: unknown;
        mapLabel?: string | null;
        referencePoint?: string | null;
        streetFront?: string | null;
        geoStatus?: string;
        block?: {
          id: string;
          name: string;
          development?: {
            id: string;
            name: string;
            description?: string | null;
            city?: string;
            state?: string | null;
            address?: string | null;
            referenceAddress?: string | null;
            neighborhood?: string | null;
            zipCode?: string | null;
            locationPrecision?: DevelopmentLocationPrecision | null;
            locationNotes?: string | null;
            latitude?: unknown;
            longitude?: unknown;
            polygonCoordinates?: unknown;
          };
        };
      };
    },
  });

  const { data: devMapMini } = useQuery({
    queryKey: ['lot-map', developmentId, nearbyTravelMode],
    queryFn: async () => {
      const { data } = await api.get<{ nearbyPlaces?: GeoMapNearbyPlace[] }>(
        `/lots/development/${developmentId}/map?nearbyRadius=3000&nearbyMode=${nearbyTravelMode}`,
      );
      return data;
    },
    enabled: !!developmentId && !!lot?.block?.development?.id,
  });

  const lotPitch = useMutation({
    mutationFn: (regenerate: boolean) =>
      api.post<LotPitchBundle>(`/commercial-assistant/lots/${id}/suggestions`, { regenerate }),
    onSuccess: (res) => {
      setPitch(res.data);
      toast({ title: 'Sugestões geradas', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao gerar sugestões', type: 'error' }),
  });

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado', type: 'success' });
    } catch {
      toast({ title: 'Não foi possível copiar', type: 'error' });
    }
  }

  const { register, handleSubmit } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: lot
      ? {
          number: lot.number,
          area: lot.area ? Number(lot.area) : undefined,
          price: lot.price ? Number(lot.price) : undefined,
          status: lot.status as z.infer<typeof schema>['status'],
          latStr:
            lot.latitude != null && lot.latitude !== ''
              ? String(Number(lot.latitude as number))
              : '',
          lngStr:
            lot.longitude != null && lot.longitude !== ''
              ? String(Number(lot.longitude as number))
              : '',
          polygonJson: lot.polygonCoordinates
            ? JSON.stringify(lot.polygonCoordinates, null, 2)
            : '',
          mapLabel: lot.mapLabel ?? '',
          referencePoint: lot.referencePoint ?? '',
          streetFront: lot.streetFront ?? '',
        }
      : undefined,
  });

  const update = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/lots/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lot', id] });
      if (developmentId) queryClient.invalidateQueries({ queryKey: ['lot-map', developmentId] });
      if (blockId) queryClient.invalidateQueries({ queryKey: ['lots', blockId] });
      toast({ title: 'Lote atualizado!', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao atualizar', type: 'error' }),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/lots/${id}`),
    onSuccess: () => {
      toast({ title: 'Lote removido', type: 'success' });
      router.push(`/lots?development=${developmentId}&block=${blockId}`);
    },
  });

  if (isLoading || !lot) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;

  const dev = lot.block?.development;
  const geoDev: GeoMapDevelopment | null = dev
    ? {
        id: dev.id,
        name: dev.name,
        description: dev.description,
        city: dev.city ?? '',
        state: dev.state,
        address: dev.address,
        referenceAddress: dev.referenceAddress,
        neighborhood: dev.neighborhood,
        zipCode: dev.zipCode,
        locationPrecision: dev.locationPrecision,
        locationNotes: dev.locationNotes,
        latitude: dev.latitude != null ? Number(dev.latitude as number) : null,
        longitude: dev.longitude != null ? Number(dev.longitude as number) : null,
        polygonCoordinates: dev.polygonCoordinates,
      }
    : null;

  const geoLot: GeoMapLot = {
    id: lot.id,
    number: lot.number,
    status: lot.status,
    area: lot.area != null ? Number(lot.area) : null,
    price: lot.price != null ? Number(lot.price) : null,
    blockId: lot.block?.id ?? '',
    blockName: lot.block?.name ?? '',
    latitude: lot.latitude != null ? Number(lot.latitude as number) : null,
    longitude: lot.longitude != null ? Number(lot.longitude as number) : null,
    polygonCoordinates: lot.polygonCoordinates,
    geoStatus: lot.geoStatus,
    saleScore: lot.saleScore != null ? Number(lot.saleScore) : null,
    saleClassification: lot.saleClassification ?? undefined,
    mapLabel: lot.mapLabel,
    referencePoint: lot.referencePoint,
    streetFront: lot.streetFront,
  };

  const routeTarget =
    geoLot.latitude != null && geoLot.longitude != null
      ? { lat: geoLot.latitude, lng: geoLot.longitude }
      : geoDev?.latitude != null && geoDev?.longitude != null
        ? { lat: geoDev.latitude, lng: geoDev.longitude }
        : null;

  function submitLot(d: z.infer<typeof schema>) {
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
      number: d.number,
      area: d.area,
      price: d.price,
      status: d.status,
      latitude,
      longitude,
      polygonCoordinates,
      mapLabel: d.mapLabel?.trim() || null,
      referencePoint: d.referencePoint?.trim() || null,
      streetFront: d.streetFront?.trim() || null,
    });
  }

  return (
    <main className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Editar Lote</h1>
          <Link href={`/lots?development=${developmentId}&block=${blockId}`}>
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>

        <Card className="max-w-md p-6">
          <form onSubmit={handleSubmit(submitLot)} className="space-y-4">
            <div>
              <Label>Número</Label>
              <Input {...register('number')} />
            </div>
            <div>
              <Label>Área (m²)</Label>
              <Input type="number" step="0.01" {...register('area', { valueAsNumber: true })} />
            </div>
            <div>
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" {...register('price', { valueAsNumber: true })} />
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
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={update.isPending}>
                Salvar
              </Button>
              <Link
                href={`/lots?development=${developmentId}&block=${blockId}`}
                className={buttonVariants({ variant: 'outline' })}
              >
                Voltar à lista
              </Link>
              <Button type="button" variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
                Excluir
              </Button>
            </div>
          </form>
        </Card>

        <Card className="mt-8 max-w-4xl p-6">
          <h2 className="text-lg font-bold text-primary-950">Localização no mapa</h2>
          <p className="mt-1 text-sm text-gray-600">
            Informe coordenadas centrais ou um array JSON de vértices{' '}
            <code className="rounded bg-surface-muted px-1">[&#123;&quot;lat&quot;,-7.12,&quot;lng&quot;:-39.3&#125;, …]</code>.
            Com 3+ pontos válidos o sistema marca como localização exata (polígono).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Latitude</Label>
              <Input {...register('latStr')} placeholder="-7.123456" />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input {...register('lngStr')} placeholder="-39.123456" />
            </div>
          </div>
          <div className="mt-3">
            <Label>Rótulo no mapa (opcional)</Label>
            <Input {...register('mapLabel')} placeholder="Ex.: Esquina com a Rua das Palmeiras" />
          </div>
          <div className="mt-3">
            <Label>Ponto de referência</Label>
            <Input {...register('referencePoint')} placeholder="Ex.: Próximo à portaria" />
          </div>
          <div className="mt-3">
            <Label>Frente / testada</Label>
            <Input {...register('streetFront')} placeholder="Ex.: 12 m de frente para Rua A" />
          </div>
          <div className="mt-3">
            <Label>Polígono (JSON)</Label>
            <textarea
              {...register('polygonJson')}
              className="min-h-[120px] w-full rounded-lg border px-3 py-2 font-mono text-xs"
              placeholder='[{"lat":-7.12,"lng":-39.31},{"lat":-7.121,"lng":-39.31}, …]'
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Status geográfico atual: <strong>{lot.geoStatus ?? '—'}</strong>
          </p>
          {routeTarget ? (
            <a
              href={googleDirectionsUrl(routeTarget.lat, routeTarget.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary-700 underline"
            >
              <Navigation className="h-4 w-4" />
              Como chegar (Google Maps)
            </a>
          ) : (
            <p className="mt-3 text-sm text-amber-800">
              Cadastre coordenadas do lote ou do loteamento para habilitar rota.
            </p>
          )}
          {geoDev ? (
            <div className="mt-6 space-y-2">
              <p className="text-sm text-gray-800">
                <span className="font-bold text-primary-950">Lote {lot.number}</span>
                <span className="text-gray-500"> · Quadra {lot.block?.name ?? '—'}</span>
                <span className="text-gray-500"> · </span>
                <span className="font-semibold text-primary-800">{geoDev.name}</span>
                <span className="text-gray-500"> ({geoDev.city})</span>
              </p>
              <DevelopmentLotsMap
                development={geoDev}
                lots={[geoLot]}
                highlightLotId={lot.id}
                compact
                nearbyPlaces={devMapMini?.nearbyPlaces ?? []}
                nearbyTravelMode={nearbyTravelMode}
                onNearbyTravelModeChange={setNearbyTravelMode}
              />
            </div>
          ) : null}
        </Card>

        <Card className="mt-8 max-w-2xl border-primary-100 bg-gradient-to-br from-white to-primary-50/30 p-6 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary-700" />
              <h2 className="text-lg font-bold text-primary-950">Assistente comercial — divulgação do lote</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="brand"
                className="gap-1.5"
                disabled={lotPitch.isPending}
                onClick={() => lotPitch.mutate(false)}
              >
                {lotPitch.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Gerar mensagens
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={lotPitch.isPending || !pitch}
                onClick={() => lotPitch.mutate(true)}
              >
                <RefreshCw className="h-4 w-4" />
                Novas versões
              </Button>
            </div>
          </div>
          <p className="mb-4 text-sm text-gray-600">
            Textos prontos para WhatsApp usando preço, metragem, score e tags do ranking (campeão, encalhado,
            etc.). Revise antes de enviar.
          </p>
          {lot ? (
            <div className="mb-4 rounded-lg border border-surface-muted bg-white/80 px-3 py-2 text-sm text-gray-800">
              <p className="font-semibold text-primary-900">
                Lote {lot.number} — Quadra {lot.block?.name ?? '—'}
              </p>
              <p className="text-xs text-gray-600">{lot.block?.development?.name}</p>
              <p className="mt-1 text-xs">
                {formatPrice(Number(lot.price ?? 0))}
                {lot.area != null ? ` · ${lot.area} m²` : ''}
                {lot.saleScore != null ? ` · Score ${Math.round(Number(lot.saleScore))}` : ''}
                {lot.saleClassification ? ` (${lot.saleClassification})` : ''}
              </p>
            </div>
          ) : null}
          {pitch ? (
            <div className="space-y-4">
              {pitch.arguments.length ? (
                <div>
                  <p className="text-xs font-bold uppercase text-gray-500">Argumentos principais</p>
                  <ul className="mt-2 list-inside list-disc text-sm text-gray-800">
                    {pitch.arguments.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {pitch.lotSummary.length ? (
                <div className="rounded-lg bg-primary-50/90 px-3 py-2 text-xs text-primary-950">
                  <p className="font-bold">Mini resumo para colar</p>
                  {pitch.lotSummary.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-gray-600">{pitch.strategySummary}</p>
              <div className="space-y-3">
                {pitch.suggestions.map((s) => (
                  <div key={s.tone} className="rounded-xl border border-surface-muted bg-white p-4">
                    <p className="mb-1 text-[10px] font-bold uppercase text-primary-800">{s.tone}</p>
                    <p className="text-sm leading-relaxed text-gray-900">{s.message}</p>
                    <p className="mt-2 text-xs italic text-gray-600">{s.justification}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => copyText(s.message)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </Button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(s.message)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: 'default', size: 'sm' }),
                          'gap-1.5 bg-success-600 hover:bg-success-700',
                        )}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Clique em &quot;Gerar mensagens&quot; para criar sugestões.</p>
          )}
        </Card>

        {lot?.block?.development?.id ? (
          <CampaignStudioWizard
            mode="lot"
            lotId={id}
            developmentId={lot.block.development.id}
            developmentName={lot.block.development.name}
            defaultTitle={`Divulgação — lote ${lot.number}`}
          />
        ) : null}
    </main>
  );
}
