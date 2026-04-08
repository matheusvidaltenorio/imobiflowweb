'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DevelopmentLotsMap, type GeoMapDevelopment, type GeoMapLot } from '@/components/maps/development-lots-map';

export function LotMapDialog({
  open,
  onOpenChange,
  development,
  lots,
  highlightLotId,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  development: GeoMapDevelopment | null;
  lots: GeoMapLot[];
  highlightLotId?: string | null;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-5xl overflow-y-auto border-primary-100 bg-[#F5F6F8]">
        <DialogHeader>
          <DialogTitle className="text-primary-950">Mapa do loteamento</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="py-12 text-center text-sm text-gray-600">Carregando dados do mapa…</p>
        ) : development ? (
          <DevelopmentLotsMap
            development={development}
            lots={lots}
            highlightLotId={highlightLotId}
            initialPresentation
            className="border-0 shadow-none"
          />
        ) : (
          <p className="text-sm text-gray-600">Não foi possível carregar o mapa.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
