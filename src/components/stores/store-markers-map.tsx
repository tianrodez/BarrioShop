"use client";

import dynamic from "next/dynamic";
import type { StoreMarker } from "./leaflet-store-markers";

// Leaflet touches window on import, so the map only ever loads in the browser
// (same boundary the merchant location picker uses).
const LeafletStoreMarkers = dynamic(
  () =>
    import("./leaflet-store-markers").then(
      (module) => module.LeafletStoreMarkers,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        className="flex h-96 items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground"
      >
        Cargando mapa…
      </div>
    ),
  },
);

type StoreMarkersMapProps = {
  stores: readonly StoreMarker[];
  showProfileLink?: boolean;
  label?: string;
};

/**
 * The directory map (HU05 CA1-CA3) and a single store profile map (HU05 CA4)
 * are the same view over one or many stores.
 */
export function StoreMarkersMap({
  stores,
  showProfileLink,
  label,
}: StoreMarkersMapProps) {
  return (
    <div aria-label="Mapa de tiendas">
      <LeafletStoreMarkers
        stores={stores}
        showProfileLink={showProfileLink}
        label={label}
      />
    </div>
  );
}
