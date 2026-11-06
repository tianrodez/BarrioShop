import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StoreProfile } from "@/components/stores/store-profile";
import type { ProductRecord } from "@/lib/product-catalog-model";

// The map is Leaflet behind a dynamic import; here we only assert the marker
// the profile hands it (HU05 CA4).
vi.mock("@/components/stores/store-markers-map", () => ({
  StoreMarkersMap: ({
    stores,
  }: {
    stores: { id: string; latitude: number; longitude: number }[];
  }) => (
    <div
      data-testid="profile-map"
      data-count={stores.length}
      data-point={
        stores[0] ? `${stores[0].latitude},${stores[0].longitude}` : "none"
      }
    />
  ),
}));

const store = {
  id: "store-1",
  name: "Panadería La Espiga",
  store_type: "Panadería",
  description: "Pan de masa madre horneado cada mañana.",
  photo_url: "https://project.supabase.co/store.webp",
  address: "Cra 72 #15-20",
  barrio: "Castilla",
  upz: "Castilla - La Esmeralda",
  reference_place: "Frente al parque de Castilla",
  whatsapp: "573001112233",
  opening_hours: "Lun a Sáb 6:00-13:00",
  point: { latitude: 4.5996, longitude: -74.1377 },
};

function makeProduct(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: "product-1",
    store_id: "store-1",
    name: "Aguacate fuerte x unidad",
    description: "Listo para arepa",
    price: 2500,
    category: "Verduras",
    photo_url: "https://project.supabase.co/aguacate.webp",
    status: "available",
    price_updated_at: "2026-11-04T12:00:00.000Z",
    created_at: "2026-11-01T12:00:00.000Z",
    updated_at: "2026-11-04T12:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("StoreProfile", () => {
  it("shows where the store is, with the reference the merchant wrote (HU02 CA3)", () => {
    render(<StoreProfile reporterId={null} store={store} products={[]} />);

    expect(
      screen.getByRole("heading", { name: "Panadería La Espiga" }),
    ).toBeVisible();
    expect(screen.getByText("Panadería · Castilla")).toBeVisible();
    const location = screen.getByRole("region", { name: "Ubicación" });
    expect(location).toHaveTextContent("Cra 72 #15-20");
    expect(location).toHaveTextContent("Frente al parque de Castilla");
    expect(location).toHaveTextContent("Castilla - La Esmeralda");
  });

  it("shows the opening hours and the WhatsApp contact (HU02 CA3)", () => {
    render(<StoreProfile reporterId={null} store={store} products={[]} />);

    expect(screen.getByText("Lun a Sáb 6:00-13:00")).toBeVisible();
    const contact = screen.getByRole("link", { name: /WhatsApp/i });
    expect(contact).toHaveAttribute("href", "https://wa.me/573001112233");
    expect(contact).toHaveAttribute("target", "_blank");
  });

  it("renders the catalog with price, category and description (HU03 CA1)", () => {
    render(<StoreProfile reporterId={null} store={store} products={[makeProduct()]} />);

    const card = screen.getByRole("listitem");
    expect(within(card).getByText("Aguacate fuerte x unidad")).toBeVisible();
    expect(within(card).getByText("$2.500")).toBeVisible();
    expect(within(card).getByText("Verduras")).toBeVisible();
    expect(within(card).getByText("Listo para arepa")).toBeVisible();
  });

  it("keeps a sold-out product visible but marked as such (HU03 CA4)", () => {
    render(
      <StoreProfile
        reporterId={null}
        store={store}
        products={[makeProduct({ name: "Aguacate", status: "sold_out" })]}
      />,
    );

    const card = screen.getByRole("listitem");
    expect(within(card).getByText("Aguacate")).toBeVisible();
    expect(within(card).getByText("Agotado")).toBeVisible();
    // An agotado product cannot be added to an order: no add control here.
    expect(
      within(card).queryByRole("button", { name: /agregar|añadir/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the price-change notice of every product (HU03 CA5)", () => {
    render(<StoreProfile reporterId={null} store={store} products={[makeProduct()]} />);

    expect(screen.getByRole("listitem")).toHaveTextContent(
      /Última actualización de precio:/,
    );
  });

  it("draws one marker with the point the merchant marked (HU05 CA4)", () => {
    render(<StoreProfile reporterId={null} store={store} products={[]} />);

    const map = screen.getByTestId("profile-map");
    expect(map).toHaveAttribute("data-count", "1");
    expect(map).toHaveAttribute("data-point", "4.5996,-74.1377");
    expect(screen.getByRole("region", { name: "Ubicación" })).toHaveTextContent(
      "Cra 72 #15-20",
    );
  });

  it("says so when the store has no products yet", () => {
    render(<StoreProfile reporterId={null} store={store} products={[]} />);

    expect(screen.getByText(/todavía no tiene productos/i)).toBeVisible();
  });

  it("omits the reference and the UPZ when the merchant left them empty", () => {
    render(
      <StoreProfile
        reporterId={null}
        store={{ ...store, reference_place: null, upz: null }}
        products={[]}
      />,
    );

    // They are optional fields (HU02 CA1): they simply never appear.
    const location = screen.getByRole("region", { name: "Ubicación" });
    expect(location).toHaveTextContent("Cra 72 #15-20");
    expect(location).not.toHaveTextContent("Frente al parque");
    expect(location).not.toHaveTextContent("La Esmeralda");
  });

  it("still shows the profile when the merchant never marked a point", () => {
    render(
      <StoreProfile
        reporterId={null}
        store={{ ...store, point: null }}
        products={[makeProduct()]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Panadería La Espiga" }),
    ).toBeVisible();
    expect(screen.getByTestId("profile-map")).toHaveAttribute(
      "data-count",
      "0",
    );
  });

  it("offers the visible Reportar option for the store (HU11 CA1)", () => {
    render(
      <StoreProfile reporterId="user-1" store={store} products={[]} />,
    );

    expect(
      screen.getByRole("button", { name: "Reportar Panadería La Espiga" }),
    ).toBeVisible();
  });
});
