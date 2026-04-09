import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  Building2,
  Church,
  Coffee,
  Dumbbell,
  Fuel,
  GraduationCap,
  Landmark,
  MapPin,
  Pill,
  ShoppingCart,
  Stethoscope,
  UtensilsCrossed,
} from 'lucide-react';
import { Marker } from '@/components/maps/map-view';
import { nearbyCategoryColor } from '@/lib/maps/nearby-place-styles';

const CATEGORY_ICON: Record<string, LucideIcon> = {
  supermarket: ShoppingCart,
  pharmacy: Pill,
  fast_food: UtensilsCrossed,
  restaurant: UtensilsCrossed,
  school: GraduationCap,
  fuel: Fuel,
  hospital: Building2,
  clinic: Stethoscope,
  bank: Landmark,
  atm: Banknote,
  cafe: Coffee,
  gym: Dumbbell,
  church: Church,
};

export function NearbyPlaceMarker({
  latitude,
  longitude,
  category,
  onClick,
}: {
  latitude: number;
  longitude: number;
  category: string;
  onClick: () => void;
}) {
  const color = nearbyCategoryColor(category);
  const Icon = CATEGORY_ICON[category] ?? MapPin;

  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor="center"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick();
      }}
    >
      <div
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-[2.5px] border-white bg-white shadow-md ring-1 ring-black/10 transition hover:scale-105 hover:shadow-lg"
        style={{ borderColor: color }}
        title={category}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} style={{ color }} aria-hidden />
      </div>
    </Marker>
  );
}
