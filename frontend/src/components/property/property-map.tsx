'use client';

import { useMemo } from 'react';
import { useJsApiLoader, GoogleMap, Marker } from '@react-google-maps/api';

const defaultCenter = { lat: -23.5505, lng: -46.6333 };
const mapContainerStyle = { width: '100%', height: '300px', borderRadius: '8px' };

type PropertyMapProps = {
  latitude: number;
  longitude: number;
  title?: string;
};

export function PropertyMap({ latitude, longitude, title }: PropertyMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
  });

  const center = useMemo(() => ({ lat: latitude, lng: longitude }), [latitude, longitude]);

  if (!apiKey) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border bg-gray-100 text-sm text-gray-500">
        Mapa desabilitado. Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border bg-gray-100 text-sm text-red-500">
        Erro ao carregar o mapa.
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="h-[300px] animate-pulse rounded-lg bg-gray-200" />;
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={15}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          zoomControl: true,
        }}
      >
        <Marker position={center} title={title} />
      </GoogleMap>
    </div>
  );
}
