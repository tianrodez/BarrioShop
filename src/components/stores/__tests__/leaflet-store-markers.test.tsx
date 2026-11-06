import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeafletStoreMarkers } from "@/components/stores/leaflet-store-markers";
import type { DirectoryStore } from "@/lib/store-directory-model";

type MarkerMock = {
  bindPopup: ReturnType<typeof vi.fn>;
  addTo: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

const leaflet = vi.hoisted(() => {
  const captured: {
    options?: Record<string, unknown>;
    markers: {
      bindPopup: { mock: { calls: unknown[][] } };
      addTo: unknown;
      remove: unknown;
    }[];
  } = { markers: [] };

  const layerGroup = { addTo: vi.fn(), clearLayers: vi.fn() };
  layerGroup.addTo.mockReturnValue(layerGroup);

  const createMap = vi.fn<
    (
      node: unknown,
      options?: Record<string, unknown>,
    ) => {
      remove: () => void;
      invalidateSize: () => void;
      on: () => void;
      stop: () => void;
      fitBounds: (bounds: unknown, options?: unknown) => void;
    }
  >();
  createMap.mockImplementation((_node, options) => {
    captured.options = options;
    return {
      remove: vi.fn(),
      invalidateSize: vi.fn(),
      on: vi.fn(),
      stop: vi.fn(),
      fitBounds: vi.fn(),
    };
  });

  const circleMarker =
    vi.fn<
      (
        center: [number, number],
        options?: Record<string, unknown>,
      ) => MarkerMock
    >();
  circleMarker.mockImplementation(() => {
    const marker: MarkerMock = {
      bindPopup: vi.fn(),
      addTo: vi.fn(),
      remove: vi.fn(),
    };
    marker.bindPopup.mockReturnValue(marker);
    marker.addTo.mockReturnValue(marker);
    captured.markers.push(marker as never);
    return marker;
  });

  return {
    captured,
    layerGroup,
    createMap,
    circleMarker,
    tileLayer: vi.fn<
      (
        url: string,
        options?: Record<string, unknown>,
      ) => {
        addTo: () => void;
      }
    >(() => ({ addTo: vi.fn() })),
    polygon: vi.fn<
      (
        positions: unknown,
        options?: Record<string, unknown>,
      ) => {
        addTo: () => void;
      }
    >(() => ({ addTo: vi.fn() })),
  };
});

vi.mock("leaflet", () => ({
  default: {
    map: leaflet.createMap,
    tileLayer: leaflet.tileLayer,
    polygon: leaflet.polygon,
    circleMarker: leaflet.circleMarker,
    layerGroup: () => leaflet.layerGroup,
    latLngBounds: () => ({ pad: () => ({ padded: true }) }),
  },
}));

function makeStore(overrides: Partial<DirectoryStore> = {}): DirectoryStore {
  return {
    id: "store-1",
    name: "Panadería La Espiga",
    store_type: "Panadería",
    barrio: "Castilla",
    address: "Cra 72 #15-20",
    reference_place: null,
    opening_hours: "Lun a Sáb 6:00-13:00",
    photo_url: null,
    is_featured: false,
    distance_m: null,
    latitude: 4.6394,
    longitude: -74.1438,
    ...overrides,
  };
}

describe("LeafletStoreMarkers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leaflet.captured.markers = [];
    leaflet.captured.options = undefined;
  });

  it("creates a map locked to Kennedy (HU05)", () => {
    render(<LeafletStoreMarkers stores={[makeStore()]} />);

    expect(leaflet.createMap).toHaveBeenCalledTimes(1);
    expect(leaflet.captured.options).toMatchObject({
      maxBounds: [
        [4.59501, -74.18576],
        [4.66419, -74.11829],
      ],
      maxBoundsViscosity: 1,
      minZoom: 13,
      maxZoom: 18,
      scrollWheelZoom: false,
    });
  });

  it("paints everything outside the locality instead of showing it", () => {
    render(<LeafletStoreMarkers stores={[makeStore()]} />);

    const mask = leaflet.polygon.mock.calls[0] as unknown[];
    // [outer ring, Kennedy as the hole] — the shape that hides Tunjuelito.
    expect(mask[0]).toHaveLength(2);
    expect((mask[1] as Record<string, unknown>).fillOpacity).toBe(1);
    expect((mask[1] as Record<string, unknown>).interactive).toBe(false);
  });

  it("frames every store the directory sent instead of one random shop", () => {
    render(
      <LeafletStoreMarkers
        stores={[
          makeStore(),
          makeStore({
            id: "store-2",
            name: "Fruver El Campo",
            latitude: 4.6229,
            longitude: -74.1552,
          }),
        ]}
      />,
    );

    expect(leaflet.createMap).toHaveBeenCalledTimes(1);
    const map = leaflet.createMap.mock.results[0]?.value as {
      fitBounds: { mock: { calls: unknown[][] } };
    };
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.fitBounds.mock.calls[0][1]).toMatchObject({ maxZoom: 15 });
  });

  it("puts one marker per store at the point the merchant marked (HU05 CA1)", () => {
    render(
      <LeafletStoreMarkers
        stores={[
          makeStore(),
          makeStore({
            id: "store-2",
            name: "Fruver El Campo",
            latitude: 4.6229,
            longitude: -74.1552,
          }),
        ]}
      />,
    );

    expect(leaflet.circleMarker).toHaveBeenCalledTimes(2);
    expect(leaflet.circleMarker.mock.calls[0][0]).toEqual([4.6394, -74.1438]);
    expect(leaflet.circleMarker.mock.calls[1][0]).toEqual([4.6229, -74.1552]);
  });

  it("shows the store name and a link to its profile in the popup (HU05 CA2)", () => {
    render(<LeafletStoreMarkers stores={[makeStore()]} />);

    const popup = leaflet.captured.markers[0].bindPopup.mock
      .calls[0][0] as HTMLElement;
    expect(popup.textContent).toContain("Panadería La Espiga");
    expect(popup.querySelector("a")).toHaveAttribute("href", "/tienda/store-1");
  });

  it("omits the profile link on a map that already is that profile (HU05 CA4)", () => {
    render(
      <LeafletStoreMarkers stores={[makeStore()]} showProfileLink={false} />,
    );

    const popup = leaflet.captured.markers[0].bindPopup.mock
      .calls[0][0] as HTMLElement;
    expect(popup.textContent).toContain("Panadería La Espiga");
    expect(popup.querySelector("a")).toBeNull();
  });

  it("centres on the first store inside Kennedy, never on one outside", () => {
    render(<LeafletStoreMarkers stores={[makeStore()]} />);
    expect(leaflet.captured.options).toMatchObject({
      center: [4.6394, -74.1438],
    });

    leaflet.createMap.mockClear();
    render(
      <LeafletStoreMarkers
        stores={[makeStore({ latitude: 4.576, longitude: -74.13 })]}
      />,
    );
    // Tunjuelito: the view stays on the locality.
    expect(leaflet.captured.options).toMatchObject({
      center: [4.6287, -74.1617],
    });
  });

  it("says so when there is nothing to show", () => {
    render(<LeafletStoreMarkers stores={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      /sin tiendas en el mapa/i,
    );
    expect(leaflet.circleMarker).not.toHaveBeenCalled();
  });
});
