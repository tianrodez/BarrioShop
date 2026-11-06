"use client";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { storeTypeIcon } from "@/lib/store-type-icon";
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
  /** Shown inside the popup, the way the directory card shows it. */
  photo_url?: string | null;
  store_type?: string;
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

const HOME_ICON =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9h13v-9"/></svg>';

function popupContent(store: StoreMarker, showProfileLink: boolean) {
  const root = document.createElement("article");
  root.className = "store-popup";

  if (store.photo_url) {
    const photo = document.createElement("img");
    photo.src = store.photo_url;
    photo.alt = `Foto de ${store.name}`;
    photo.className = "store-popup__photo";
    photo.loading = "lazy";
    photo.width = 232;
    photo.height = 120;
    root.appendChild(photo);
  } else {
    // Same language as the directory card: a merchant who has not uploaded a
    // photo yet still gets a recognisable shopfront, not an empty box.
    const fallback = document.createElement("div");
    fallback.className = "store-popup__photo store-popup__photo--empty";
    fallback.setAttribute("aria-hidden", "true");
    const icon = document.createElement("span");
    icon.textContent = store.store_type
      ? storeTypeIcon(store.store_type)
      : "🏪";
    fallback.appendChild(icon);
    root.appendChild(fallback);
  }

  const body = document.createElement("div");
  body.className = "store-popup__body";

  if (showProfileLink) {
    const link = document.createElement("a");
    link.href = `/tienda/${store.id}`;
    link.textContent = store.name;
    link.className = "store-popup__link";
    body.appendChild(link);
  } else {
    const name = document.createElement("p");
    name.textContent = store.name;
    name.className = "store-popup__name";
    body.appendChild(name);
  }

  if (store.address) {
    const detail = document.createElement("p");
    detail.className = "store-popup__meta";
    detail.textContent = store.reference_place
      ? `${store.address} · ${store.reference_place}`
      : store.address;
    body.appendChild(detail);
  }

  root.appendChild(body);
  return root;
}

/** Frame every store, or the whole locality when there is none to frame. */
function frameStores(map: L.Map, stores: readonly StoreMarker[]) {
  if (stores.length > 1) {
    map.fitBounds(
      L.latLngBounds(
        stores.map((store) => [store.latitude, store.longitude] as LatLngTuple),
      ).pad(0.35),
      { animate: true, maxZoom: KENNEDY_MIN_ZOOM + 2 },
    );
    return;
  }

  if (stores.length === 1) {
    map.setView(
      [stores[0].latitude, stores[0].longitude],
      KENNEDY_MIN_ZOOM + 2,
      { animate: true },
    );
    return;
  }

  map.fitBounds(L.latLngBounds(KENNEDY_BOUNDARY), {
    animate: true,
    maxZoom: KENNEDY_MIN_ZOOM + 1,
  });
}

/**
 * A "back to the locality" control. The map already refuses to leave Kennedy,
 * but after zooming into one shop the neighbour needs one click to see the
 * whole barrio again without hunting for the right zoom level.
 */
function addLocalityControl(map: L.Map, stores: readonly StoreMarker[]) {
  const LocalityHome = L.Control.extend({
    options: { position: "topleft" as L.ControlPosition },
    onAdd() {
      const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      const button = L.DomUtil.create(
        "button",
        "leaflet-control-home",
        container,
      );
      button.type = "button";
      button.title = "Ver toda la localidad de Kennedy";
      button.setAttribute("aria-label", "Ver toda la localidad de Kennedy");
      button.innerHTML = HOME_ICON;

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(button, "click", (event: Event) => {
        L.DomEvent.stop(event);
        frameStores(map, stores);
      });

      return container;
    },
  });

  new LocalityHome().addTo(map);
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
      // The wheel is the control a neighbour already knows: it zooms the map
      // while the pointer is over it and leaves the page scroll untouched
      // everywhere else.
      scrollWheelZoom: true,
      wheelPxPerZoomLevel: 80,
      zoomControl: false,
    });
    mapRef.current = map;

    L.control
      .zoom({
        position: "topright",
        zoomInTitle: "Acercar",
        zoomOutTitle: "Alejar",
      })
      .addTo(map);

    L.control
      .scale({ position: "bottomleft", imperial: false, maxWidth: 110 })
      .addTo(map);

    addLocalityControl(map, initialStores);

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
        .bindPopup(popupContent(store, showProfileLink), {
          className: "store-popup-wrapper",
          maxWidth: 260,
          minWidth: 232,
          autoPanPadding: [16, 16],
        })
        .addTo(layer);
    }
  }, [stores, showProfileLink]);

  return (
    <div className="relative">
      <div
        ref={hostRef}
        className="h-96 w-full overflow-hidden rounded-xl border"
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
