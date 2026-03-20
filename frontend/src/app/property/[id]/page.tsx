'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toaster';
import { LeadForm } from '@/components/property/lead-form';
import { buildMapsSearchUrl } from '@/lib/geocode';

const PropertyMap = dynamic(() => import('@/components/property/property-map').then((m) => ({ default: m.PropertyMap })), {
  ssr: false,
  loading: () => <div className="h-[300px] animate-pulse rounded-lg bg-gray-200" />,
});

export default function PropertyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      const { data } = await api.get(`/properties/${id}`);
      return data;
    },
  });

  const { data: isFav } = useQuery({
    queryKey: ['favorite-check', id],
    queryFn: async () => {
      const { data } = await api.get(`/favorites/check/${id}`);
      return data;
    },
    enabled: !!user,
  });

  const addFavorite = useMutation({
    mutationFn: () => api.post(`/favorites/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-check', id] });
      toast({ title: 'Adicionado aos favoritos', type: 'success' });
    },
    onError: () => toast({ title: 'Erro ao favoritar', type: 'error' }),
  });

  const removeFavorite = useMutation({
    mutationFn: () => api.delete(`/favorites/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-check', id] });
      toast({ title: 'Removido dos favoritos', type: 'success' });
    },
    onError: () => toast({ title: 'Erro', type: 'error' }),
  });

  const whatsappNumber = property?.user?.phone?.replace(/\D/g, '') || '';
  const hasWhatsApp = whatsappNumber.length >= 10;
  const whatsappLink = hasWhatsApp
    ? `https://wa.me/55${whatsappNumber}?text=Olá! Tenho interesse no imóvel: ${encodeURIComponent(property?.title || '')}`
    : null;

  if (isLoading || !property) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <div className="h-96 animate-pulse rounded-xl bg-gray-200" />
      </div>
    );
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-50 border-b border-surface-muted bg-white/95 shadow-sm backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold tracking-tight text-primary-950">
            Imobi<span className="text-accent-500">Flow</span>
          </Link>
          <nav className="flex items-center gap-5">
            <Link href="/search" className="text-sm font-semibold text-gray-600 transition hover:text-primary-800">
              Buscar
            </Link>
            {user ? (
              <>
                <Link
                  href={user.role === 'ADMIN' ? '/admin' : user.role === 'CORRETOR' ? '/dashboard' : '/favorites'}
                  className="text-sm font-semibold text-gray-600 transition hover:text-primary-800"
                >
                  {user.role === 'ADMIN' ? 'Admin' : user.role === 'CORRETOR' ? 'Dashboard' : 'Favoritos'}
                </Link>
                <Link href="/profile" className="text-sm font-semibold text-gray-600 transition hover:text-primary-800">
                  Perfil
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="text-sm font-semibold text-gray-600 transition hover:text-primary-800"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-semibold text-gray-600 transition hover:text-primary-800">
                  Entrar
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-bold text-white shadow-cta transition hover:bg-accent-600"
                >
                  Cadastrar
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
        <div className="mb-6 flex flex-wrap gap-2">
          <span className="rounded-full bg-primary-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-800 ring-1 ring-primary-200/50">
            {property.type}
          </span>
          <span className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-700">
            {property.status}
          </span>
        </div>

        <h1 className="mb-3 text-3xl font-bold tracking-tight text-primary-950 md:text-4xl">{property.title}</h1>
        <p className="mb-2 text-3xl font-bold text-accent-600 md:text-4xl">{formatPrice(Number(property.price))}</p>
        <p className="mb-8 text-sm font-medium text-gray-500">
          Valor de referência — fale com o corretor para condições e visita.
        </p>

        <div className="relative mb-8 h-96 overflow-hidden rounded-2xl bg-surface-muted shadow-card ring-1 ring-black/5">
          {property.images?.[0]?.url ? (
            <Image src={property.images[0].url} alt={property.title} fill className="object-cover" priority />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">Sem imagem</div>
          )}
        </div>

        {property.images?.length > 1 && (
          <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
            {property.images.slice(1, 6).map((img: { id: string; url: string }) => (
              <div key={img.id} className="relative h-24 w-32 flex-shrink-0 overflow-hidden rounded-lg">
                <Image src={img.url} alt="" fill className="object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          {property.bedrooms != null && (
            <div className="rounded-xl border border-surface-muted bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-primary-800">{property.bedrooms}</p>
              <p className="text-sm text-gray-500">Quartos</p>
            </div>
          )}
          {property.bathrooms != null && (
            <div className="rounded-xl border border-surface-muted bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-primary-800">{property.bathrooms}</p>
              <p className="text-sm text-gray-500">Banheiros</p>
            </div>
          )}
          {property.area != null && (
            <div className="rounded-xl border border-surface-muted bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-primary-800">{property.area}m²</p>
              <p className="text-sm text-gray-500">Área</p>
            </div>
          )}
          {property.garageSpaces != null && (
            <div className="rounded-xl border border-surface-muted bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-primary-800">{property.garageSpaces}</p>
              <p className="text-sm text-gray-500">Vagas</p>
            </div>
          )}
        </div>

        {property.description && (
          <div className="mb-8">
            <h2 className="mb-2 font-semibold">Descrição</h2>
            <p className="whitespace-pre-wrap text-gray-600">{property.description}</p>
          </div>
        )}

        <div className="mb-8">
          <h2 className="mb-2 font-semibold">Localização</h2>
          <p className="mb-4 text-gray-600">
            {[property.street, property.number, property.neighborhood, property.city, property.zipCode]
              .filter(Boolean)
              .join(', ') || 'Endereço não informado'}
          </p>
          {property.latitude != null && property.longitude != null ? (
            <div>
              <PropertyMap
                latitude={Number(property.latitude)}
                longitude={Number(property.longitude)}
                title={property.title}
              />
              {[property.street, property.number, property.neighborhood, property.city].filter(Boolean).length > 0 && (
                <a
                  href={buildMapsSearchUrl({
                    street: property.street ?? undefined,
                    number: property.number ?? undefined,
                    neighborhood: property.neighborhood ?? undefined,
                    city: property.city ?? undefined,
                    zipCode: property.zipCode ?? undefined,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-bold text-accent-600 hover:text-accent-700 hover:underline"
                >
                  Abrir no Google Maps para rotas
                </a>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-gray-50 p-6 text-center">
              <p className="mb-3 text-sm text-gray-500">Mapa não disponível para este imóvel.</p>
              <p className="mb-3 text-xs text-gray-400">
                Ao editar o imóvel, use &quot;Preencher pelo endereço&quot; para adicionar a localização no mapa.
              </p>
              {[property.street, property.number, property.neighborhood, property.city].filter(Boolean).length > 0 && (
                <a
                  href={buildMapsSearchUrl({
                    street: property.street ?? undefined,
                    number: property.number ?? undefined,
                    neighborhood: property.neighborhood ?? undefined,
                    city: property.city ?? undefined,
                    zipCode: property.zipCode ?? undefined,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-800 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-primary-900"
                >
                  Ver no Google Maps
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {user && (
            isFav ? (
              <Button variant="outline" onClick={() => removeFavorite.mutate()}>
                Remover dos favoritos
              </Button>
            ) : (
              <Button variant="outline" onClick={() => addFavorite.mutate()}>
                Adicionar aos favoritos
              </Button>
            )
          )}
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-success-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-success-600/25 transition hover:bg-success-700"
            >
              WhatsApp com corretor
            </a>
          )}
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              toast({ title: 'Link copiado!', type: 'success' });
            }}
          >
            Compartilhar
          </Button>
        </div>

        <div className="mt-12 rounded-2xl border border-surface-muted bg-white p-6 shadow-card md:p-8">
          <h2 className="mb-1 text-lg font-bold text-primary-950">Tenho interesse</h2>
          <p className="mb-4 text-sm text-gray-500">Deixe seus dados — o corretor retorna rapidamente.</p>
          <LeadForm propertyId={id} />
        </div>
      </main>
    </div>
  );
}
