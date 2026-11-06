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
import type { StorePoint } from "@/lib/store-form-model";

type LeafletLocationMapProps = {
  point: StorePoint | null;
  onChange: (point: StorePoint) => void;
  /** Called when the merchant clicks outside the locality, so the form can say why. */
  onOutside?: () => void;
};

/**
 * The merchant's map. It shares the locality mask with the public map so the
 * pin can only land where the store can actually be found, and it owns its
 * Leaflet instance for the same reason the public map does: the App Router
 * reuses DOM nodes across navigations and `react-leaflet` chokes on the reused
 * container.
 */
export function LeafletLocationMap({
  point,
  onChange,
  onOutside,
}: LeafletLocationMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const changeRef = useRef(onChange);
  const outsideRef = useRef(onOutside);
  // Captured once: the map is recreated only when the field remounts, never
  // while the merchant is panning or clicking a new point.
  const [initialView] = useState<{ center: LatLngTuple; zoom: number }>(() => {
    if (point && isInsideKennedy(point)) {
      return {
        center: [point.latitude, point.longitude],
        zoom: KENNEDY_MIN_ZOOM + 2,
      };
    }
    return { center: KENNEDY_CENTER, zoom: KENNEDY_MIN_ZOOM };
  });

  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    outsideRef.current = onOutside;
  }, [onOutside]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const node = document.createElement("div");
    node.className = "h-full w-full";
    host.appendChild(node);

    const map = L.map(node, {
      center: initialView.center,
      zoom: initialView.zoom,
      minZoom: KENNEDY_MIN_ZOOM,
      maxZoom: KENNEDY_MAX_ZOOM,
      maxBounds: KENNEDY_MAX_BOUNDS,
      maxBoundsViscosity: 1,
      // Same controls as the directory: wheel, buttons, keyboard and pinch.
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

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

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

    map.on("click", (event: L.LeafletMouseEvent) => {
      const next = {
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      };
      // HU02 CA2 is a shop in Kennedy: a click outside the locality is not a
      // typo to fix later, it is a pin that would never appear on the map.
      if (!isInsideKennedy(next)) {
        outsideRef.current?.();
        return;
      }
      changeRef.current(next);
    });

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
      markerRef.current = null;
    };
  }, [initialView]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markerRef.current?.remove();
    markerRef.current = null;

    if (point && isInsideKennedy(point)) {
      markerRef.current = L.circleMarker([point.latitude, point.longitude], {
        radius: 9,
        color: "#166534",
        fillOpacity: 0.8,
      }).addTo(map);
    }
  }, [point]);

  return (
    <div
      ref={hostRef}
      className="h-80 w-full overflow-hidden rounded-xl border"
      role="region"
      aria-label="Mapa de Kennedy"
    />
  );
}
