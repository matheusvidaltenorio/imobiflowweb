'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  imageUrl: string | null;
  alt?: string;
  className?: string;
  /** Conteúdo posicionado em % sobre a imagem (mesmo zoom/pan). */
  overlay?: React.ReactNode;
  /** Clique na imagem em coordenadas normalizadas 0–1 (relativas ao retângulo exibido da imagem). */
  onImageNormalizedClick?: (nx: number, ny: number, refWidth: number, refHeight: number) => void;
  /** Quando true, arrastar não faz pan — só zoom com rolagem. Clique dispara mapeamento. */
  mapMode?: boolean;
};

export function AssistedImageViewer({
  imageUrl,
  alt = 'Planta / disponibilidade',
  className,
  overlay,
  onImageNormalizedClick,
  mapMode = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ active: boolean; lastX: number; lastY: number } | null>(null);

  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const fitWidth = useCallback(() => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img?.naturalWidth) return;
    const w = wrap.clientWidth;
    const s = w / img.naturalWidth;
    setScale(Math.min(3, Math.max(0.2, s)));
    setPan({ x: 0, y: 0 });
  }, []);

  /** Escala para ver a imagem inteira na área do visualizador (útil em plantas altas). */
  const fitScreen = useCallback(() => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img?.naturalWidth) return;
    const pw = wrap.clientWidth;
    const ph = wrap.clientHeight || wrap.clientWidth;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const s = Math.min(pw / iw, ph / ih, 5);
    setScale(Math.max(0.2, s));
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    resetView();
  }, [imageUrl, resetView]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setScale((s) => Math.min(5, Math.max(0.2, s + delta)));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (mapMode) return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      drag.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    },
    [mapMode],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current?.active) return;
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    drag.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const onImgClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!onImageNormalizedClick || !imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
      onImageNormalizedClick(
        nx,
        ny,
        imgRef.current.naturalWidth || Math.round(rect.width),
        imgRef.current.naturalHeight || Math.round(rect.height),
      );
    },
    [onImageNormalizedClick],
  );

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  }, []);

  if (!imageUrl) {
    return (
      <div
        className={cn(
          'flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-600',
          className,
        )}
      >
        Envie a imagem do dia para usar o modo assistido.
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setScale((s) => Math.min(5, s + 0.15))}>
          <Plus className="h-4 w-4" />
          Zoom
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setScale((s) => Math.max(0.2, s - 0.15))}>
          <Minus className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={fitWidth}>
          Encaixar largura
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={fitScreen}>
          Encaixar na tela
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={resetView}>
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={toggleFullscreen}>
          <Maximize2 className="h-4 w-4" />
          Tela ampla
        </Button>
        {mapMode ? (
          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">Clique na imagem para posicionar o lote</span>
        ) : (
          <span className="text-xs text-slate-500">Arraste para mover · role para ampliar</span>
        )}
      </div>

      <div
        ref={wrapRef}
        className="relative max-h-[min(70vh,720px)] min-h-[320px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950/5"
        onWheel={onWheel}
      >
        <div
          className={cn('h-full w-full overflow-auto', mapMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <div
            className="inline-block origin-top-left will-change-transform"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            }}
          >
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={imageUrl}
                alt={alt}
                className="block max-h-none max-w-none select-none"
                draggable={false}
                onClick={onImgClick}
              />
              {overlay}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
