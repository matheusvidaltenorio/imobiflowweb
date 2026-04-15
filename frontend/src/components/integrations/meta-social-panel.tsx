'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ExternalLink, Loader2, Plug } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { redirectToMetaOAuthUrl } from '@/lib/meta-oauth-redirect';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

type MetaStatus = { configured: boolean };

type SocialConnectionRow = {
  id: string;
  facebookPageName: string | null;
  instagramUsername: string | null;
  status: string;
  tokenExpiresAt: string | null;
};

function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
  }
  return fallback;
}

type Props = {
  /** Resumo no dashboard; página completa em /integrations */
  compact?: boolean;
};

async function fetchMetaConnectUrl(scope: 'minimal' | 'extended'): Promise<string> {
  const q = scope === 'extended' ? '?scope=extended' : '';
  const { data } = await api.get<{ url: string; scopes?: string; scopeMode?: string }>(`/social/meta/connect${q}`);
  if (data.scopes) {
    console.info('[ImobiFlow Meta] scopes retornados pelo backend:', data.scopes);
  }
  return data.url;
}

export function MetaSocialPanel({ compact = false }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: metaStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['social', 'meta-status'],
    queryFn: async () => {
      const { data } = await api.get<MetaStatus>('/social/meta/status');
      return data;
    },
  });

  const { data: connections, isLoading: connLoading } = useQuery({
    queryKey: ['social', 'connections'],
    queryFn: async () => {
      const { data } = await api.get<SocialConnectionRow[]>('/social/connections');
      return data;
    },
  });

  const onConnectError = (err: unknown) => {
    if (isAxiosError(err) && err.response?.status === 401) {
      toast({
        title: 'Sessão expirada ou inválida',
        description: 'Faça login novamente para conectar sua conta Meta.',
        type: 'error',
      });
      return;
    }
    toast({
      title: 'Não foi possível conectar',
      description: apiErrorMessage(err, 'Tente novamente em instantes.'),
      type: 'error',
    });
  };

  const connectBasic = useMutation({
    mutationFn: () => fetchMetaConnectUrl('minimal'),
    onSuccess: (url) => redirectToMetaOAuthUrl(url),
    onError: onConnectError,
  });

  const connectExtended = useMutation({
    mutationFn: () => fetchMetaConnectUrl('extended'),
    onSuccess: (url) => redirectToMetaOAuthUrl(url),
    onError: onConnectError,
  });

  const connectPending = connectBasic.isPending || connectExtended.isPending;

  const serverReady = metaStatus?.configured === true;
  const hasConnections = (connections?.length ?? 0) > 0;
  const loading = statusLoading || connLoading;

  const statusLine = loading
    ? 'Carregando status…'
    : !serverReady
      ? 'Servidor sem META_APP_ID / META_APP_SECRET / META_OAUTH_REDIRECT_URI — peça ao administrador.'
      : hasConnections
        ? `${connections!.length} página(s) do Facebook conectada(s) para publicação.`
        : 'Nenhuma página conectada ainda. Comece pela conexão básica; use permissões estendidas para publicar no feed.';

  if (compact) {
    return (
      <Card className="border-primary-100/90 bg-gradient-to-r from-white via-primary-50/20 to-accent-50/30 p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-800">
              <Plug className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-bold text-primary-900">Meta (Instagram e Facebook)</p>
              <p className="mt-1 text-xs text-gray-600">{statusLine}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 font-semibold"
              disabled={connectPending || loading || !serverReady}
              onClick={() => connectBasic.mutate()}
            >
              {connectBasic.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
              Conectar ou atualizar Meta
            </Button>
            <Link
              href="/integrations"
              className="text-xs font-bold text-primary-700 underline-offset-2 hover:underline"
            >
              Ver integrações
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-primary-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-800">
          <Plug className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-primary-950">Meta (Instagram e Facebook)</h2>
          <p className="mt-1 text-sm text-gray-600">
            Primeiro use a <strong className="font-semibold text-primary-900">conexão básica</strong> (menos permissões,
            mais fácil de testar). Depois, se for publicar posts pelo sistema, autorize também as permissões estendidas.
          </p>
        </div>
      </div>

      <div
        className={cn(
          'mb-4 rounded-lg border px-4 py-3 text-sm',
          !serverReady
            ? 'border-amber-200 bg-amber-50 text-amber-950'
            : hasConnections
              ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
              : 'border-slate-200 bg-slate-50 text-slate-800',
        )}
      >
        <p className="font-semibold">Status</p>
        <p className="mt-1 text-xs leading-relaxed sm:text-sm">{statusLine}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          type="button"
          variant="brand"
          className="gap-2"
          disabled={connectPending || loading || !serverReady}
          onClick={() => connectBasic.mutate()}
        >
          {connectBasic.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          Conectar ou atualizar Meta
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={connectPending || loading || !serverReady}
          onClick={() => connectExtended.mutate()}
          title="Inclui permissões para publicar no Facebook/Instagram pelo ImobiFlow"
        >
          {connectExtended.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          Permissões para publicar
        </Button>
        {connectPending ? (
          <span className="text-xs text-gray-500">Redirecionando para a Meta na mesma aba…</span>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Use sempre uma aba normal do navegador (evite painéis de extensão que interceptem OAuth). O endereço de callback é
        só o configurado no servidor (<code className="rounded bg-slate-100 px-1">META_OAUTH_REDIRECT_URI</code>).
      </p>

      {hasConnections && connections ? (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="mb-2 text-sm font-semibold text-primary-900">Conexões ativas</p>
          <ul className="space-y-2">
            {connections.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-900">{c.facebookPageName ?? 'Página'}</span>
                <span className="text-xs text-slate-600">
                  {c.instagramUsername ? `@${c.instagramUsername}` : 'Instagram não vinculado'}
                  {' · '}
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Após autorizar na Meta, você é redirecionado ao centro de publicação. As conexões aparecem aqui
            automaticamente.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-auto px-0 text-xs font-semibold text-primary-700"
            onClick={() => void qc.invalidateQueries({ queryKey: ['social', 'connections'] })}
          >
            Atualizar lista
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
