/** Cores comerciais: preenchimento + borda para polígonos e ênfase de marcador. */
export function lotStatusMapStyle(status: string): { fill: string; stroke: string; strokeWeight: number } {
  switch (status) {
    case 'DISPONIVEL':
      return { fill: '#22c55e66', stroke: '#15803d', strokeWeight: 2 };
    case 'RESERVADO':
      return { fill: '#eab30855', stroke: '#ca8a04', strokeWeight: 2 };
    case 'VENDIDO':
      return { fill: '#ef444466', stroke: '#b91c1c', strokeWeight: 2 };
    default:
      return { fill: '#94a3b855', stroke: '#64748b', strokeWeight: 2 };
  }
}

export function championAccent(): { extraStroke: string; zIndex: number } {
  return { extraStroke: '#1e3a8a', zIndex: 900 };
}

export function stalledAccent(): { dash: boolean } {
  return { dash: true };
}

/** Link externo para rota (mapa interno continua MapLibre). */
export function externalGoogleDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function externalOsmDirectionsUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${lat}%2C${lng}`;
}

/** @deprecated use externalGoogleDirectionsUrl — mantido para imports legados */
export const googleDirectionsUrl = externalGoogleDirectionsUrl;
