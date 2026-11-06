"use client";

import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import type { StorePoint } from "@/lib/store-form-model";

const KENNEDY_CENTER: [number, number] = [4.625, -74.151];

type LeafletLocationMapProps = {
  point: StorePoint | null;
  onChange: (point: StorePoint) => void;
};

function MapClickHandler({
  onChange,
}: Pick<LeafletLocationMapProps, "onChange">) {
  useMapEvents({
    click(event) {
      onChange({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  return null;
}

export function LeafletLocationMap({
  point,
  onChange,
}: LeafletLocationMapProps) {
  const center: [number, number] = point
    ? [point.latitude, point.longitude]
    : KENNEDY_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom={false}
      className="h-72 w-full rounded-md border"
      aria-label="Mapa de Kennedy"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler onChange={onChange} />
      {point ? (
        <CircleMarker
          center={[point.latitude, point.longitude]}
          radius={9}
          pathOptions={{ color: "#166534", fillOpacity: 0.8 }}
        />
      ) : null}
    </MapContainer>
  );
}
