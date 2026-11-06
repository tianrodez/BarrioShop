import { describe, expect, it } from "vitest";
import {
  isInsideKennedy,
  KENNEDY_BOUNDARY,
  KENNEDY_BOUNDS,
  KENNEDY_MAX_BOUNDS,
  KENNEDY_MAX_ZOOM,
  KENNEDY_MIN_ZOOM,
} from "@/lib/kennedy-map";

// Real points inside the locality (OpenStreetMap, filtered by relation 4740229).
const BARRIOS = [
  { barrio: "Castilla", latitude: 4.64, longitude: -74.1433 },
  { barrio: "Bavaria", latitude: 4.6377, longitude: -74.1322 },
  { barrio: "Kennedy Central", latitude: 4.6232, longitude: -74.1547 },
  { barrio: "Patio Bonito", latitude: 4.6394, longitude: -74.1607 },
  { barrio: "Tierra Buena", latitude: 4.6516, longitude: -74.1732 },
  { barrio: "Timiza", latitude: 4.6164, longitude: -74.1519 },
  { barrio: "Tintal", latitude: 4.6509, longitude: -74.154 },
] as const;

// The localities that used to leak into the map when the box was invented.
const OTHER_LOCALITIES = [
  { name: "Tunjuelito", latitude: 4.576, longitude: -74.13 },
  { name: "Bosa", latitude: 4.55, longitude: -74.19 },
  { name: "Puente Aranda", latitude: 4.615, longitude: -74.11 },
  { name: "Suba", latitude: 4.75, longitude: -74.08 },
  { name: "La Candelaria", latitude: 4.598, longitude: -74.076 },
] as const;

describe("Kennedy map bounds", () => {
  it("orders the corners south-west to north-east", () => {
    expect(KENNEDY_BOUNDS.south).toBeLessThan(KENNEDY_BOUNDS.north);
    expect(KENNEDY_BOUNDS.west).toBeLessThan(KENNEDY_BOUNDS.east);
    // A small margin so Leaflet can pan a popup into view; the mask still
    // hides everything outside the locality.
    expect(KENNEDY_MAX_BOUNDS[0][0]).toBeLessThan(KENNEDY_BOUNDS.south);
    expect(KENNEDY_MAX_BOUNDS[0][1]).toBeLessThan(KENNEDY_BOUNDS.west);
    expect(KENNEDY_MAX_BOUNDS[1][0]).toBeGreaterThan(KENNEDY_BOUNDS.north);
    expect(KENNEDY_MAX_BOUNDS[1][1]).toBeGreaterThan(KENNEDY_BOUNDS.east);
  });

  it("describes the locality with a real, closed outline", () => {
    expect(KENNEDY_BOUNDARY.length).toBeGreaterThan(40);
    expect(KENNEDY_BOUNDARY[0]).toEqual(
      KENNEDY_BOUNDARY[KENNEDY_BOUNDARY.length - 1],
    );
  });

  it("keeps every barrio the directory ships with inside", () => {
    for (const point of BARRIOS) {
      expect(isInsideKennedy(point), point.barrio).toBe(true);
    }
  });

  it("rejects the neighbouring localities the map must never show", () => {
    for (const point of OTHER_LOCALITIES) {
      expect(isInsideKennedy(point), point.name).toBe(false);
    }
  });

  it("keeps the zoom floor high enough not to show the whole city", () => {
    expect(KENNEDY_MIN_ZOOM).toBeGreaterThanOrEqual(13);
    expect(KENNEDY_MAX_ZOOM).toBeGreaterThan(KENNEDY_MIN_ZOOM);
  });
});
