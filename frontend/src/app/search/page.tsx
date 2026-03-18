'use client';

import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';

const TYPES = [
  { value: '', label: 'Todos' },
  { value: 'CASA', label: 'Casa' },
  { value: 'APARTAMENTO', label: 'Apartamento' },
  { value: 'TERRENO', label: 'Terreno' },
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'RURAL', label: 'Rural' },
];

export default function SearchPage() {
  const { user, logout } = useAuth();
  const searchParams = useSearchParams();
  const [city, setCity] = useState(searchParams.get('city') ?? '');
  const [neighborhood, setNeighborhood] = useState(searchParams.get('neighborhood') ?? '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '');
  const [type, setType] = useState(searchParams.get('type') ?? '');
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [appliedFilters, setAppliedFilters] = useState({ city, neighborhood, minPrice, maxPrice, type, search });

  const applyFilters = useCallback(() => {
    setAppliedFilters({ city, neighborhood, minPrice, maxPrice, type, search });
  }, [city, neighborhood, minPrice, maxPrice, type, search]);

  const { data, isLoading } = useQuery({
    queryKey: ['properties-search', appliedFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (appliedFilters.city) params.set('city', appliedFilters.city);
      if (appliedFilters.neighborhood) params.set('neighborhood', appliedFilters.neighborhood);
      if (appliedFilters.minPrice) params.set('minPrice', appliedFilters.minPrice);
      if (appliedFilters.maxPrice) params.set('maxPrice', appliedFilters.maxPrice);
      if (appliedFilters.type) params.set('type', appliedFilters.type);
      if (appliedFilters.search) params.set('search', appliedFilters.search);
      const { data } = await api.get(`/properties/public?${params}`);
      return data;
    },
  });

  const items = data?.items ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold text-primary-600">
            ImobiFlow
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/search" className="text-sm font-medium text-primary-600">
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

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 rounded-xl border bg-white p-6">
          <h2 className="mb-4 font-semibold">Filtros</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Cidade</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Bairro" />
            </div>
            <div>
              <Label>Preço mín.</Label>
              <Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Preço máx.</Label>
              <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Tipo</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Busca</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Palavra-chave" />
            </div>
          </div>
          <div className="mt-4">
            <Button type="button" onClick={applyFilters}>
              Buscar
            </Button>
          </div>
        </div>

        <p className="mb-4 text-sm text-gray-500">{data?.total ?? 0} imóveis encontrados</p>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p: { id: string; title: string; price: number; images: { url: string }[]; city: string; neighborhood: string }) => (
              <Link key={p.id} href={`/property/${p.id}`}>
                <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                  <div className="relative h-48 bg-gray-100">
                    {p.images?.[0]?.url ? (
                      <Image src={p.images[0].url} alt={p.title} fill className="object-cover" sizes="33vw" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400">Sem imagem</div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900">{p.title}</h3>
                    <p className="text-sm text-gray-500">
                      {p.neighborhood}, {p.city}
                    </p>
                    <p className="mt-2 text-lg font-bold text-primary-600">{formatPrice(Number(p.price))}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
