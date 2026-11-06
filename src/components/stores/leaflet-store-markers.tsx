"use client";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import {
  isInsideKennedy,
  KENNEDY_BOUNDARY,
  KENNEDY_CENTER,
  KENNEDY_MASK_COLOR,
  KENNEDY_MASK_OUTER,
  KENNEDY_MAX_BOUNDS,
  KENNEDY_MAX_ZOOM,
  KENNEDY_MIN_ZOOM,
  type LatLngTuple,
} from "@/lib/kennedy-map";

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

function initialCenter(stores: readonly StoreMarker[]): LatLngTuple {
  const firstInside = stores.find(isInsideKennedy);
  return firstInside
    ? [firstInside.latitude, firstInside.longitude]
    : KENNEDY_CENTER;
}

function popupContent(store: StoreMarker, showProfileLink: boolean) {
  const root = document.createElement("div");

  if (showProfileLink) {
    const link = document.createElement("a");
    link.href = `/tienda/${store.id}`;
    link.textContent = store.name;
    link.className = "font-medium text-primary underline";
    root.appendChild(link);
  } else {
    const name = document.createElement("p");
    name.textContent = store.name;
    name.className = "font-medium";
    root.appendChild(name);
  }

  if (store.address) {
    const detail = document.createElement("p");
    detail.className = "text-xs text-muted-foreground";
    detail.textContent = store.reference_place
      ? `${store.address} · ${store.reference_place}`
      : store.address;
    root.appendChild(detail);
  }

  return root;
}

/**
 * HU05: one marker per store, at the exact point the merchant marked (HU02
 * CA2). Panning and zooming stay on because the directory is read from a phone
 * (HU05 CA3); the wheel is left to the page so scrolling is not trapped.
 *
 * The map is Kennedy and nothing else: `maxBounds` with full viscosity stops
 * the view from drifting into another locality, and a mask painted over
 * everything outside the official boundary hides the neighbouring localities
 * (Tunjuelito, Bosa, Puente Aranda) instead of letting the tile layer reveal
 * them.
 *
 * Leaflet is driven imperatively instead of through `react-leaflet`'s
 * `MapContainer`: the App Router reuses that container across a client
 * navigation, Leaflet finds its stale `_leaflet_id` and the page dies with
 * "Map container is being reused by another instance" plus `appendChild` of
 * undefined. Owning the node here means every mount gets a brand-new element
 * and `map.remove()` runs on unmount.
 *
 * Points are drawn as circles, like the merchant picker: no Leaflet icon asset
 * has to be bundled, which is what broke map rendering in the first prototypes.
 */
export function LeafletStoreMarkers({
  stores,
  showProfileLink = true,
  label = "Mapa de tiendas del barrio",
}: LeafletStoreMarkersProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const [center] = useState<LatLngTuple>(() => initialCenter(stores));
  // The initial view is the locality, not one random store: at mount the map
  // fits every store the directory already sent, so the neighbour sees the
  // whole of Kennedy and then narrows it down with the filters.
  const [initialStores] = useState(() => stores);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const node = document.createElement("div");
    node.className = "h-full w-full";
    host.appendChild(node);

    const map = L.map(node, {
      center,
      zoom: KENNEDY_MIN_ZOOM + 1,
      minZoom: KENNEDY_MIN_ZOOM,
      maxZoom: KENNEDY_MAX_ZOOM,
      maxBounds: KENNEDY_MAX_BOUNDS,
      maxBoundsViscosity: 1,
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Everything outside the locality, painted over the tiles.
    L.polygon([KENNEDY_MASK_OUTER, KENNEDY_BOUNDARY], {
      stroke: false,
      fillColor: KENNEDY_MASK_COLOR,
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);

    L.polygon(KENNEDY_BOUNDARY, {
      color: "#b8411c",
      weight: 2,
      fill: false,
      opacity: 0.9,
      interactive: false,
    }).addTo(map);

    if (initialStores.length > 1) {
      map.fitBounds(
        L.latLngBounds(
          initialStores.map(
            (store) => [store.latitude, store.longitude] as LatLngTuple,
          ),
        ).pad(0.35),
        // No animation: a pending zoom transition fires after `map.remove()`
        // when the router unmounts the page and reads `_leaflet_pos` of a pane
        // that no longer exists.
        { animate: false, maxZoom: KENNEDY_MIN_ZOOM + 2 },
      );
    }

    const layer = L.layerGroup().addTo(map);
    layersRef.current = layer;

    // The page tree can be hidden and shown again; Leaflet needs to be told the
    // size changed or it keeps a stale viewport.
    // A queued observer callback (or a pending animation frame) can land after
    // `map.remove()` and read `_leaflet_pos` of a pane that no longer exists.
    // Both the flag and `stop()` close that race while the page navigates away.
    let destroyed = false;
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (!destroyed) map.invalidateSize();
          });
    observer?.observe(node);

    return () => {
      destroyed = true;
      observer?.disconnect();
      map.stop();
      map.remove();
      node.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, [center, initialStores]);

  useEffect(() => {
    const layer = layersRef.current;
    if (!layer) return;

    layer.clearLayers();
    for (const store of stores) {
      L.circleMarker([store.latitude, store.longitude], {
        radius: 9,
        color: "#166534",
        fillOpacity: 0.8,
      })
        .bindPopup(popupContent(store, showProfileLink))
        .addTo(layer);
    }
  }, [stores, showProfileLink]);

  return (
    <div className="relative">
      <div
        ref={hostRef}
        className="h-72 w-full overflow-hidden rounded-md border"
        role="region"
        aria-label={label}
      />
      {stores.length === 0 ? (
        <p
          role="status"
          className="absolute inset-0 flex items-center justify-center rounded-md bg-card/90 p-6 text-center text-sm text-muted-foreground"
        >
          Sin tiendas en el mapa por ahora.
        </p>
      ) : null}
    </div>
  );
}
