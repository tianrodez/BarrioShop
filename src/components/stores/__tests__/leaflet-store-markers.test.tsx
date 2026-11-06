import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LeafletStoreMarkers } from "@/components/stores/leaflet-store-markers";
import type { DirectoryStore } from "@/lib/store-directory-model";

const mapContainerProps = vi.hoisted(() => ({ current: undefined as unknown }));

// The project draws store points with CircleMarker (as the merchant picker
// does) so no Leaflet icon asset path has to be bundled.
vi.mock("react-leaflet", () => ({
  MapContainer: (props: { children?: ReactNode }) => {
    mapContainerProps.current = props;
    return <div data-testid="map-container">{props.children}</div>;
  },
  TileLayer: () => <div data-testid="tile-layer" />,
  CircleMarker: (props: { center: [number, number]; children?: ReactNode }) => (
    <div
      data-testid="marker"
      data-position={`${props.center[0]},${props.center[1]}`}
    >
      {props.children}
    </div>
  ),
  Popup: (props: { children?: ReactNode }) => (
    <div data-testid="popup">{props.children}</div>
  ),
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
    latitude: 4.5996,
    longitude: -74.1377,
    ...overrides,
  };
}

describe("LeafletStoreMarkers", () => {
  it("puts one marker per store at the point the merchant marked (HU05 CA1)", () => {
    render(
      <LeafletStoreMarkers
        stores={[
          makeStore(),
          makeStore({ id: "store-2", latitude: 4.56, longitude: -74.18 }),
        ]}
      />,
    );

    const markers = screen.getAllByTestId("marker");
    expect(markers).toHaveLength(2);
    expect(markers[0]).toHaveAttribute("data-position", "4.5996,-74.1377");
    expect(markers[1]).toHaveAttribute("data-position", "4.56,-74.18");
  });

  it("shows the store name and a link to its profile in the popup (HU05 CA2)", () => {
    render(<LeafletStoreMarkers stores={[makeStore()]} />);

    const popup = screen.getByTestId("popup");
    expect(popup).toHaveTextContent("Panadería La Espiga");
    expect(
      within(popup).getByRole("link", { name: /Panadería La Espiga/ }),
    ).toHaveAttribute("href", "/tienda/store-1");
  });

  it("omits the profile link on a map that already is that profile (HU05 CA4)", () => {
    render(
      <LeafletStoreMarkers stores={[makeStore()]} showProfileLink={false} />,
    );

    expect(screen.getByTestId("popup")).toHaveTextContent(
      "Panadería La Espiga",
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("stays pannable and zoomable for a phone user (HU05 CA3)", () => {
    render(<LeafletStoreMarkers stores={[makeStore()]} />);

    const props = mapContainerProps.current as Record<string, unknown>;
    expect(props.dragging).not.toBe(false);
    expect(props.touchZoom).not.toBe(false);
    expect(props.zoomControl).not.toBe(false);
    expect(props.scrollWheelZoom).toBe(false);
  });

  it("centers on the first marker and says so when there is nothing to show", () => {
    const { rerender } = render(<LeafletStoreMarkers stores={[makeStore()]} />);
    expect(
      mapContainerProps.current as { center?: [number, number] },
    ).toMatchObject({ center: [4.5996, -74.1377] });

    rerender(<LeafletStoreMarkers stores={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      /sin tiendas en el mapa/i,
    );
    expect(screen.queryByTestId("marker")).not.toBeInTheDocument();
  });
});
