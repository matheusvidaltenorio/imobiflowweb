/**
 * Alias de MapLibre para manter o nome “MapView” na arquitetura (PARTE 8).
 */
import MapGL, {
  Layer,
  Marker,
  NavigationControl,
  FullscreenControl,
  Popup,
  Source,
  type MapRef,
} from 'react-map-gl/maplibre';

export const MapView = MapGL;
export type { MapRef as MapViewRef };
export { Layer, Marker, NavigationControl, FullscreenControl, Popup, Source };
export type { MapRef };
