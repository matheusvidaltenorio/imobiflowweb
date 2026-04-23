'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, ReactNode } from 'react';

const queryDefaults = {
  queries: {
    /** Dados “bons” por 1 min — reduz refetch em navegação entre telas. */
    staleTime: 60_000,
    /** Mantém cache em memória 5 min após desmontar (TanStack Query v5: gcTime). */
    gcTime: 5 * 60_000,
    /** Menos carga em produção ao voltar à aba; invalidações explícitas após mutações. */
    refetchOnWindowFocus: false,
    retry: 1,
  },
} as const;

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: queryDefaults }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
