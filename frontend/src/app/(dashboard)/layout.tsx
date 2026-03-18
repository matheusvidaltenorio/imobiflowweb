'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    // Admin routes: apenas ADMIN
    if (pathname?.startsWith('/admin') && user.role !== 'ADMIN') {
      router.replace(user.role === 'CORRETOR' ? '/dashboard' : '/');
      return;
    }
    // Corretor routes: CORRETOR ou ADMIN
    const brokerRoutes = ['/properties', '/developments', '/lots', '/visits', '/leads', '/clients', '/payments'];
    if (brokerRoutes.some((r) => pathname?.startsWith(r)) && user.role === 'CLIENTE') {
      router.replace('/');
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
