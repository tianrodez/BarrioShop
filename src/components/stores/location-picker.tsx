"use client";

import dynamic from "next/dynamic";
import type { StorePoint } from "@/lib/store-form-model";

const LeafletLocationMap = dynamic(
  () =>
    import("./leaflet-location-map").then(
      (module) => module.LeafletLocationMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        className="flex h-72 items-center justify-center rounded-md border text-sm text-muted-foreground"
      >
        Cargando mapa…
      </div>
    ),
  },
);

type LocationPickerProps = {
  point: StorePoint | null;
  onChange: (point: StorePoint) => void;
};

export function LocationPicker({ point, onChange }: LocationPickerProps) {
  return (
    <div aria-label="Mapa para marcar la ubicación de la tienda">
      <LeafletLocationMap point={point} onChange={onChange} />
      <p className="mt-2 text-sm text-muted-foreground">
        Toca el mapa para ubicar tu tienda. El punto se usa para mostrarla y
        calcular distancias; no es la ubicación del cliente.
      </p>
    </div>
  );
}
