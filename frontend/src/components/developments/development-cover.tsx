'use client';

import { useState } from 'react';
import { ImageOff, MapPin } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';

type Props = {
  coverImage: string | null | undefined;
  coverImageAlt?: string | null;
  name: string;
  className?: string;
  imgClassName?: string;
};

export function DevelopmentCover({
  coverImage,
  coverImageAlt,
  name,
  className,
  imgClassName,
}: Props) {
  const [failed, setFailed] = useState(false);
  const src = resolveMediaUrl(coverImage ?? null);
  const alt = coverImageAlt?.trim() || `Imagem do loteamento ${name}`;

  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary-100/90 to-surface-muted text-primary-800/80',
          className,
        )}
      >
        <ImageOff className="h-8 w-8 opacity-60" strokeWidth={1.5} />
        <span className="flex items-center gap-1 px-2 text-center text-xs font-semibold">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          Sem imagem
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn('object-cover', imgClassName)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
