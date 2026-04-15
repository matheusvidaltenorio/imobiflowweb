import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GRAPH = 'https://graph.facebook.com';

type GraphErr = { error?: { message?: string; code?: number } };

/**
 * Chamadas à Meta Graph API (Instagram + Facebook Page).
 * Documentação: https://developers.facebook.com/docs/graph-api
 */
@Injectable()
export class MetaGraphService {
  private readonly log = new Logger(MetaGraphService.name);
  private readonly version: string;

  constructor(private readonly config: ConfigService) {
    this.version = this.config.get<string>('META_GRAPH_VERSION')?.trim() || 'v18.0';
  }

  private url(path: string, params: Record<string, string>): string {
    const u = new URL(`${GRAPH}/${this.version}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') u.searchParams.set(k, v);
    }
    return u.toString();
  }

  async getJson<T>(path: string, params: Record<string, string>): Promise<T> {
    const res = await fetch(this.url(path, params));
    const json = (await res.json()) as T & GraphErr;
    if (!res.ok || (json as GraphErr).error) {
      const msg = (json as GraphErr).error?.message ?? res.statusText;
      throw new Error(`Graph API: ${msg}`);
    }
    return json;
  }

  async postForm(path: string, body: Record<string, string>): Promise<unknown> {
    const res = await fetch(`${GRAPH}/${this.version}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    });
    const json = await res.json();
    if (!res.ok || (json as GraphErr).error) {
      const msg = (json as GraphErr).error?.message ?? res.statusText;
      throw new Error(`Graph API: ${msg}`);
    }
    return json;
  }

  /** Instagram: cria container de mídia (imagem deve ser URL pública HTTPS). */
  async createInstagramMedia(params: {
    igUserId: string;
    pageAccessToken: string;
    imageUrl: string;
    caption: string;
  }): Promise<{ id: string }> {
    const json = await this.postForm(`/${params.igUserId}/media`, {
      image_url: params.imageUrl,
      caption: params.caption.slice(0, 2200),
      access_token: params.pageAccessToken,
    });
    return json as { id: string };
  }

  /** Instagram: publica container criado. */
  async publishInstagramMedia(params: {
    igUserId: string;
    pageAccessToken: string;
    creationId: string;
  }): Promise<{ id: string }> {
    const json = await this.postForm(`/${params.igUserId}/media_publish`, {
      creation_id: params.creationId,
      access_token: params.pageAccessToken,
    });
    return json as { id: string };
  }

  /** Facebook Page: post com foto (URL pública). */
  async postPagePhoto(params: {
    pageId: string;
    pageAccessToken: string;
    imageUrl: string;
    message: string;
  }): Promise<{ id: string; post_id?: string }> {
    const json = await this.postForm(`/${params.pageId}/photos`, {
      url: params.imageUrl,
      message: params.message.slice(0, 8000),
      access_token: params.pageAccessToken,
    });
    return json as { id: string; post_id?: string };
  }

  /** Facebook Page: post só texto (sem imagem). */
  async postPageFeed(params: {
    pageId: string;
    pageAccessToken: string;
    message: string;
  }): Promise<{ id: string }> {
    const json = await this.postForm(`/${params.pageId}/feed`, {
      message: params.message.slice(0, 8000),
      access_token: params.pageAccessToken,
    });
    return json as { id: string };
  }
}
