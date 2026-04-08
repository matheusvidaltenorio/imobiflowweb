import { BadRequestException } from '@nestjs/common';
import { LotGeoStatus, Prisma } from '@prisma/client';

export function parseLatLngPair(lat?: unknown, lng?: unknown): { lat: number; lng: number } | undefined {
  if (lat === undefined && lng === undefined) return undefined;
  if (lat == null || lng == null) {
    throw new BadRequestException('Informe latitude e longitude juntos, ou deixe ambos vazios.');
  }
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) {
    throw new BadRequestException('Latitude e longitude devem ser números válidos.');
  }
  if (la < -90 || la > 90 || lo < -180 || lo > 180) {
    throw new BadRequestException('Coordenadas fora dos limites válidos (lat: -90 a 90, lng: -180 a 180).');
  }
  return { lat: la, lng: lo };
}

/** undefined = não alterar; null = limpar; array = gravar */
export function normalizePolygonCoordinates(
  raw: unknown,
): 'omit' | 'null' | Prisma.InputJsonValue {
  if (raw === undefined) return 'omit';
  if (raw === null) return 'null';
  if (!Array.isArray(raw)) {
    throw new BadRequestException('polygon_coordinates deve ser um array de objetos { lat, lng }.');
  }
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    if (!p || typeof p !== 'object') {
      throw new BadRequestException(`Vértice ${i + 1} inválido no polígono.`);
    }
    const o = p as Record<string, unknown>;
    const la = Number(o.lat);
    const lo = Number(o.lng);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) {
      throw new BadRequestException(`Vértice ${i + 1}: lat e lng numéricos obrigatórios.`);
    }
  }
  return raw as Prisma.InputJsonValue;
}

export function inferLotGeoStatus(
  polygon: unknown,
  lat: number | null | undefined,
  lng: number | null | undefined,
): LotGeoStatus {
  const polyOk = Array.isArray(polygon) && polygon.length >= 3;
  if (polyOk) return LotGeoStatus.EXATO;
  if (lat != null && lng != null) return LotGeoStatus.APROXIMADO;
  return LotGeoStatus.SEM_LOCALIZACAO;
}
