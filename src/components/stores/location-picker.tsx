"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
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
        className="flex h-80 items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground"
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
  const [outside, setOutside] = useState(false);

  return (
    <div aria-label="Mapa para marcar la ubicación de la tienda">
      <LeafletLocationMap
        point={point}
        onChange={(next) => {
          setOutside(false);
          onChange(next);
        }}
        onOutside={() => setOutside(true)}
      />
      {outside ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Ese punto queda fuera de Kennedy. Marca la tienda dentro de la
          localidad.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Toca el mapa para ubicar tu tienda. Solo se puede marcar dentro de
          Kennedy; el punto se usa para mostrarla y calcular distancias, no es
          la ubicación del cliente.
        </p>
      )}
    </div>
  );
}
