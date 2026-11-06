"use client";

import Link from "next/link";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

/**
 * What a marker needs. The directory passes whole stores; the public profile
 * passes the one store it is showing, so the map must not depend on the
 * catalogue row.
 */
export type StoreMarker = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  reference_place?: string | null;
};

type LeafletStoreMarkersProps = {
  stores: readonly StoreMarker[];
  /** False on the profile itself: a link to the page you are reading is noise. */
  showProfileLink?: boolean;
  label?: string;
};

/**
 * HU05: one marker per store, at the exact point the merchant marked (HU02
 * CA2). Panning and zooming stay on because the directory is read from a phone
 * (HU05 CA3); the wheel is left to the page so scrolling is not trapped.
 *
 * Points are drawn as circles, like the merchant picker: no Leaflet icon asset
 * has to be bundled, which is what broke map rendering in the first prototypes.
 */
export function LeafletStoreMarkers({
  stores,
  showProfileLink = true,
  label = "Mapa de tiendas del barrio",
}: LeafletStoreMarkersProps) {
  if (stores.length === 0) {
    return (
      <p
        role="status"
        className="rounded-md border border-dashed p-6 text-sm text-muted-foreground"
      >
        Sin tiendas en el mapa por ahora.
      </p>
    );
  }

  const first = stores[0];
  const center: [number, number] = [first.latitude, first.longitude];

  return (
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom={false}
      className="h-72 w-full rounded-md border"
      aria-label={label}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {stores.map((store) => (
        <CircleMarker
          key={store.id}
          center={[store.latitude, store.longitude]}
          radius={9}
          pathOptions={{ color: "#166534", fillOpacity: 0.8 }}
        >
          <Popup>
            {showProfileLink ? (
              <Link
                href={`/tienda/${store.id}`}
                className="font-medium text-primary underline"
              >
                {store.name}
              </Link>
            ) : (
              <p className="font-medium">{store.name}</p>
            )}
            {store.address ? (
              <p className="text-xs text-muted-foreground">
                {store.address}
                {store.reference_place ? ` · ${store.reference_place}` : ""}
              </p>
            ) : null}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
