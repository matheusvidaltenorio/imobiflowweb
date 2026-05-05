'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ExternalLink, Loader2, Plug, Unlink } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { redirectToMetaOAuthUrl } from '@/lib/meta-oauth-redirect';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

type MetaStatus = {
  configured: boolean;
  oauthScopeMode?: string;
  hints?: { primaryConnectUsesMinimalRoute?: boolean; extendedUsesQueryScopeExtended?: boolean };
};

type SocialConnectionRow = {
  id: string;
  facebookPageId?: string;
  facebookPageName: string | null;
  instagramUsername: string | null;
  status: string;
  tokenExpiresAt: string | null;
  isDefault?: boolean;
  hasInstagramBusiness?: boolean;
  lastError?: string | null;
  isMetaBasicOnly?: boolean;
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

/** ?scope=minimal força apenas public_profile mesmo com META_OAUTH_SCOPE_MODE=extended no servidor. */
async function fetchMetaConnectUrl(flow: 'basic' | 'advanced'): Promise<string> {
  const q = flow === 'advanced' ? '?scope=extended' : '?scope=minimal';
  const { data } = await api.get<{ url: string; scopes?: string; scopeMode?: string }>(
    `/social/meta/connect${q}`,
  );
  if (data.scopes) {
    console.info('[ImobiFlow Meta] scopes retornados pelo backend:', data.scopes);
  }
  if (data.scopeMode) {
    console.info('[ImobiFlow Meta] scopeMode retornado pelo backend:', data.scopeMode);
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
      const { data } = await api.get<SocialConnectionRow[]>('/social/meta/pages');
      return data;
    },
  });

  const selectDefault = useMutation({
    mutationFn: async (connectionId: string) => {
      const { data } = await api.post<SocialConnectionRow[]>('/social/meta/select-page', { connectionId });
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Página padrão para publicação atualizada', type: 'success' });
      void qc.invalidateQueries({ queryKey: ['social', 'connections'] });
    },
    onError: (err) =>
      toast({
        title: apiErrorMessage(err, 'Não foi possível definir a página padrão'),
        type: 'error',
      }),
  });

  const disconnect = useMutation({
    mutationFn: async (connectionId: string) => {
      await api.post('/social/meta/disconnect', { connectionId });
    },
    onSuccess: () => {
      toast({ title: 'Conexão Meta removida do ImobiFlow', type: 'success' });
      void qc.invalidateQueries({ queryKey: ['social', 'connections'] });
    },
    onError: (err) =>
      toast({
        title: apiErrorMessage(err, 'Não foi possível desconectar'),
        type: 'error',
      }),
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

  /** Passo 1: só OAuth leve (`public_profile` no servidor com modo minimal). */
  const connectBasic = useMutation({
    mutationFn: () => fetchMetaConnectUrl('basic'),
    onSuccess: (url) => redirectToMetaOAuthUrl(url),
    onError: onConnectError,
  });

  /** Passo 2: páginas + IG + publicação (quando o app Meta tiver permissões). */
  const connectAdvanced = useMutation({
    mutationFn: () => fetchMetaConnectUrl('advanced'),
    onSuccess: (url) => redirectToMetaOAuthUrl(url),
    onError: onConnectError,
  });

  const connectPending = connectBasic.isPending || connectAdvanced.isPending;

  const serverReady = metaStatus?.configured === true;
  const loading = statusLoading || connLoading;

  const pageConnections = connections?.filter((c) => !c.isMetaBasicOnly && c.status === 'ACTIVE') ?? [];
  const basicConnection = connections?.find((c) => c.isMetaBasicOnly === true || c.status === 'META_BASIC_CONNECTED');

  const hasPages = pageConnections.length > 0;

  const statusLine = loading
    ? 'Carregando status…'
    : !serverReady
      ? 'Servidor sem META_APP_ID / META_APP_SECRET / META_OAUTH_REDIRECT_URI — peça ao administrador da plataforma.'
      : hasPages
        ? `${pageConnections.length} página(ns) disponível(is) para publicação. Escolha a página padrão quando tiver mais de uma.`
        : basicConnection
          ? 'Login Meta confirmado em modo mínimo. Conceda permissões de páginas/publicação no segundo botão quando o app Meta estiver aprovado.'
          : 'Comece pelo botão principal (só conta Meta — escopo público). Depois, use permissões estendidas para listar páginas e publicar.';

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
              title="Apenas login Meta com escopo mínimo (public_profile)."
            >
              {connectBasic.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              Conectar conta Meta
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
          <h2 className="text-lg font-bold text-primary-950">Meta (Facebook e Instagram)</h2>
          <p className="mt-1 text-sm text-gray-600">
            <strong className="font-semibold text-primary-900">Conectar conta Meta</strong>: login inicial com permissão{' '}
            mínima (validar OAuth).{' '}
            <strong className="font-semibold text-primary-900">Conceder permissões de páginas/publicação</strong>:
            segunda etapa, necessária para listar suas páginas e postar pelo ImobiFlow quando o produto Meta estiver
            configurado.
          </p>
        </div>
      </div>

      <div
        className={cn(
          'mb-4 rounded-lg border px-4 py-3 text-sm',
          !serverReady
            ? 'border-amber-200 bg-amber-50 text-amber-950'
            : hasPages
              ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
              : basicConnection
                ? 'border-sky-200 bg-sky-50/90 text-sky-950'
                : 'border-slate-200 bg-slate-50 text-slate-800',
        )}
      >
        <p className="font-semibold">Status da sua conta</p>
        <p className="mt-1 text-xs leading-relaxed sm:text-sm">{statusLine}</p>
        {metaStatus?.oauthScopeMode != null ? (
          <p className="mt-2 text-[11px] text-slate-500">
            META_OAUTH_SCOPE_MODE no servidor: <code className="rounded bg-white/70 px-1">{metaStatus.oauthScopeMode}</code>
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          type="button"
          variant="brand"
          className="gap-2"
          disabled={connectPending || loading || !serverReady}
          onClick={() => connectBasic.mutate()}
          title="Fluxo mínimo: valida primeiro o login OAuth (escopo público)."
        >
          {connectBasic.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          Conectar conta Meta
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={connectPending || loading || !serverReady}
          onClick={() => connectAdvanced.mutate()}
          title="Lista páginas, Instagram Business e permissões para publicação (app Meta deve ter os produtos aprovados)."
        >
          {connectAdvanced.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
          Conceder permissões de páginas/publicação
        </Button>
        {connectPending ? (
          <span className="text-xs text-gray-500">Redirecionando para a Meta na mesma aba…</span>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Use sempre uma aba normal do navegador (evite extensões que interceptem OAuth). O callback é o endereço configurado
        no servidor (<code className="rounded bg-slate-100 px-1">META_OAUTH_REDIRECT_URI</code>).
      </p>

      {(hasPages || basicConnection) && connections ? (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="mb-2 text-sm font-semibold text-primary-900">Conexões Meta na sua conta</p>
          <ul className="space-y-3">
            {basicConnection ? (
              <li className="rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="font-medium text-slate-900">
                      {basicConnection.facebookPageName ?? 'Login Meta (básico)'}
                    </span>
                    <p className="mt-1 text-xs text-slate-700">
                      Login OAuth concluído. Permissões de páginas ainda não foram concedidas — use o segundo botão
                      quando estiver pronto para publicar.
                    </p>
                    {basicConnection.lastError ? (
                      <p className="mt-2 text-xs text-amber-900">Observação: {basicConnection.lastError}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-slate-500">Estado: {basicConnection.status}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
                    disabled={disconnect.isPending}
                    onClick={() => {
                      if (
                        typeof window !== 'undefined' &&
                        !window.confirm(
                          'Remover o login Meta básico? Você pode reconectar o fluxo mínimo depois quando quiser.',
                        )
                      ) {
                        return;
                      }
                      disconnect.mutate(basicConnection.id);
                    }}
                  >
                    {disconnect.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                    Desconectar
                  </Button>
                </div>
              </li>
            ) : null}
            {pageConnections.map((c) => {
              const igOk = c.hasInstagramBusiness ?? !!c.instagramUsername;
              return (
                <li key={c.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{c.facebookPageName ?? 'Página'}</span>
                        {c.isDefault ? (
                          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-900">
                            Padrão
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {igOk ? (
                          <>
                            Instagram Business: <span className="font-medium">@{c.instagramUsername}</span>
                          </>
                        ) : (
                          <span className="text-amber-900">
                            Sem Instagram Business nesta página — publicação no feed do Facebook disponível; Instagram
                            bloqueado até vincular no Meta Business Suite.
                          </span>
                        )}
                      </p>
                      {c.lastError ? <p className="mt-1 text-xs text-red-800">Último aviso: {c.lastError}</p> : null}
                      <p className="mt-1 text-[11px] text-slate-500">Estado: {c.status}</p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col gap-1.5 sm:items-end">
                      {!c.isDefault ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          disabled={selectDefault.isPending}
                          onClick={() => selectDefault.mutate(c.id)}
                        >
                          {selectDefault.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          Usar como padrão
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
                        disabled={disconnect.isPending}
                        onClick={() => {
                          if (
                            typeof window !== 'undefined' &&
                            !window.confirm('Remover esta página do ImobiFlow? Você poderá conectar de novo depois.')
                          ) {
                            return;
                          }
                          disconnect.mutate(c.id);
                        }}
                      >
                        {disconnect.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                        Desconectar
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Depois das permissões completas e páginas listadas, a página marcada como padrão é usada ao publicar campanhas
            quando você não escolher outra no assistente.
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
