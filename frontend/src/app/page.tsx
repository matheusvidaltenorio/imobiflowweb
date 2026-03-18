'use client';

import Link from 'next/link';
import { PropertyGrid } from '@/components/home/property-grid';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold text-primary-600">
            ImobiFlow
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/search" className="text-sm font-medium text-gray-600 hover:text-primary-600">
              Buscar Imóveis
            </Link>
            {user ? (
              <>
                <Link href={user.role === 'ADMIN' ? '/admin' : user.role === 'CORRETOR' ? '/dashboard' : '/favorites'} className="text-sm font-medium text-gray-600 hover:text-primary-600">
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

      <main>
        <section className="bg-gradient-to-b from-primary-50 to-white py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
              Encontre o imóvel ideal
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600">
              Explore milhares de imóveis e realize o sonho da casa própria
            </p>
            <Link
              href="/search"
              className="inline-flex items-center rounded-lg bg-primary-600 px-8 py-3 text-base font-medium text-white hover:bg-primary-700"
            >
              Buscar Imóveis
            </Link>
          </div>
        </section>

        <section className="container mx-auto py-16 px-4">
          <h2 className="mb-8 text-2xl font-bold">Imóveis em Destaque</h2>
          <PropertyGrid />
        </section>
      </main>

      <footer className="border-t bg-gray-50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600">
          © {new Date().getFullYear()} ImobiFlow. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
