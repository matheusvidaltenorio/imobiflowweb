'use client';

import Link from 'next/link';
import { PropertyGrid } from '@/components/home/property-grid';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-50 border-b border-surface-muted bg-white/90 shadow-sm backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold tracking-tight text-primary-950">
            Imobi<span className="text-accent-500">Flow</span>
          </Link>
          <nav className="flex items-center gap-5">
            <Link href="/search" className="text-sm font-semibold text-gray-600 transition hover:text-primary-800">
              Buscar imóveis
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

      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 py-20 text-white md:py-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent-500/15 via-transparent to-transparent" />
          <div className="container relative mx-auto px-4 text-center">
            <p className="mb-4 text-sm font-bold uppercase tracking-widest text-accent-400">Mercado imobiliário inteligente</p>
            <h1 className="mb-4 text-balance text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              Encontre o imóvel ideal
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-primary-100/90 md:text-xl">
              Explore opções com confiança e fale com corretores em poucos cliques.
            </p>
            <Link
              href="/search"
              className="inline-flex items-center rounded-xl bg-accent-500 px-10 py-3.5 text-base font-bold text-white shadow-cta transition hover:bg-accent-600 hover:shadow-lg"
            >
              Buscar imóveis
            </Link>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16 md:py-20">
          <div className="mb-10 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-primary-950 md:text-3xl">Imóveis em destaque</h2>
              <p className="mt-2 text-gray-600">Seleção atualizada para você comparar com clareza.</p>
            </div>
            <Link
              href="/search"
              className="text-sm font-bold text-accent-600 transition hover:text-accent-700"
            >
              Ver todos →
            </Link>
          </div>
          <PropertyGrid />
        </section>
      </main>

      <footer className="border-t border-surface-muted bg-white py-10">
        <div className="container mx-auto px-4 text-center text-sm font-medium text-gray-500">
          © {new Date().getFullYear()} ImobiFlow. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
