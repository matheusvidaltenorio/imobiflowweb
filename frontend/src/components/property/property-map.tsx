'use client';

import { useMemo, useRef } from 'react';
import MapGL, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { getMapStyleUrl } from '@/lib/maps/config';

type PropertyMapProps = {
  latitude: number;
  longitude: number;
  title?: string;
};

export function PropertyMap({ latitude, longitude, title }: PropertyMapProps) {
  const mapRef = useRef<MapRef>(null);
  const mapStyle = useMemo(() => getMapStyleUrl(), []);

  const initialViewState = useMemo(
    () => ({
      longitude,
      latitude,
      zoom: 15,
    }),
    [latitude, longitude],
  );

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="h-[300px] w-full">
        <MapGL
          ref={mapRef}
          mapLib={maplibregl}
          initialViewState={initialViewState}
          style={{ width: '100%', height: '100%' }}
          mapStyle={mapStyle}
        >
          <NavigationControl position="top-right" showCompass={false} />
          <Marker longitude={longitude} latitude={latitude} anchor="bottom">
            <span
              className="block h-4 w-4 rounded-full border-2 border-white bg-accent-500 shadow-lg ring-2 ring-accent-600/30"
              title={title}
              role="img"
              aria-label={title || 'Localização do imóvel'}
            />
          </Marker>
        </MapGL>
      </div>
    </div>
  );
}
