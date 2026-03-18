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
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold text-primary-600">
            ImobiFlow
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/search" className="text-sm font-medium text-gray-600 hover:text-primary-600">
              Buscar
            </Link>
            {user ? (
              <>
                <Link
                  href={user.role === 'ADMIN' ? '/admin' : user.role === 'CORRETOR' ? '/dashboard' : '/favorites'}
                  className="text-sm font-medium text-gray-600 hover:text-primary-600"
                >
                  {user.role === 'ADMIN' ? 'Admin' : user.role === 'CORRETOR' ? 'Dashboard' : 'Favoritos'}
                </Link>
                <Link href="/profile" className="text-sm font-medium text-gray-600 hover:text-primary-600">
                  Perfil
                </Link>
                <button type="button" onClick={logout} className="text-sm font-medium text-gray-600 hover:text-primary-600">
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-primary-600">
                  Entrar
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  Cadastrar
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap gap-2">
          <span className="rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-700">
            {property.type}
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{property.status}</span>
        </div>

        <h1 className="mb-4 text-2xl font-bold">{property.title}</h1>
        <p className="mb-6 text-2xl font-bold text-primary-600">{formatPrice(Number(property.price))}</p>

        <div className="relative mb-8 h-96 overflow-hidden rounded-xl bg-gray-200">
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
            <div className="rounded-lg border bg-white p-4 text-center">
              <p className="text-2xl font-bold text-primary-600">{property.bedrooms}</p>
              <p className="text-sm text-gray-500">Quartos</p>
            </div>
          )}
          {property.bathrooms != null && (
            <div className="rounded-lg border bg-white p-4 text-center">
              <p className="text-2xl font-bold text-primary-600">{property.bathrooms}</p>
              <p className="text-sm text-gray-500">Banheiros</p>
            </div>
          )}
          {property.area != null && (
            <div className="rounded-lg border bg-white p-4 text-center">
              <p className="text-2xl font-bold text-primary-600">{property.area}m²</p>
              <p className="text-sm text-gray-500">Área</p>
            </div>
          )}
          {property.garageSpaces != null && (
            <div className="rounded-lg border bg-white p-4 text-center">
              <p className="text-2xl font-bold text-primary-600">{property.garageSpaces}</p>
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
          {property.latitude != null && property.longitude != null && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
            <PropertyMap
              latitude={Number(property.latitude)}
              longitude={Number(property.longitude)}
              title={property.title}
            />
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
              className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              WhatsApp
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

        <div className="mt-12 rounded-xl border bg-white p-6">
          <h2 className="mb-4 font-semibold">Tenho interesse</h2>
          <LeadForm propertyId={id} />
        </div>
      </main>
    </div>
  );
}
