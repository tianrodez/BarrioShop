import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreCatalog } from "@/components/order/store-catalog";
import type { ProductRecord } from "@/lib/product-catalog-model";

function makeProduct(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: "product-1",
    store_id: "store-1",
    name: "Pan campesino 500 g",
    description: "Recién horneado",
    price: 4000,
    category: "Panadería",
    photo_url: null,
    status: "available",
    price_updated_at: "2026-11-04T12:00:00.000Z",
    created_at: "2026-11-01T12:00:00.000Z",
    updated_at: "2026-11-04T12:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

const products = [
  makeProduct(),
  makeProduct({
    id: "product-2",
    name: "Café americano",
    price: 2500,
    category: "Café",
  }),
  makeProduct({
    id: "product-3",
    name: "Agua de panela",
    price: 3000,
    status: "sold_out",
  }),
];

function renderCatalog(rows: ProductRecord[] = products) {
  return render(<StoreCatalog reporterId={null} storeId="store-1" products={rows} />);
}

function addButton(name: string) {
  return screen.getByRole("button", { name: `Agregar ${name} al pedido` });
}

function summary() {
  return screen.getByRole("region", { name: "Tu pedido" });
}

const EMPTY_MESSAGE = "Aún no has agregado productos.";

describe("StoreCatalog", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("offers the add control only for products the store still sells", () => {
    renderCatalog();

    expect(addButton("Pan campesino 500 g")).toBeVisible();
    expect(addButton("Café americano")).toBeVisible();

    const soldOut = screen.getByRole("group", { name: "Agua de panela" });
    expect(within(soldOut).getByText("Agotado")).toBeVisible();
    // HU06 CA1: "los productos agotados no se pueden agregar".
    expect(
      within(soldOut).queryByRole("button", { name: /agregar/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps the catalog data HU03 requires on every card", () => {
    renderCatalog();

    const card = screen.getByRole("group", { name: "Pan campesino 500 g" });
    expect(within(card).getByText("$4.000")).toBeVisible();
    expect(within(card).getByText("Panadería")).toBeVisible();
    expect(within(card).getByText("Recién horneado")).toBeVisible();
    expect(card).toHaveTextContent(/Última actualización de precio:/);
  });

  it("starts with an empty order and no way to continue it", () => {
    renderCatalog();

    expect(screen.getByText(EMPTY_MESSAGE)).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /continuar pedido/i }),
    ).not.toBeInTheDocument();
  });

  it("adds a product and shows it in the order summary", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.click(addButton("Pan campesino 500 g"));

    expect(summary()).toBeInTheDocument();
    expect(within(summary()).getByText("Pan campesino 500 g")).toBeVisible();
    expect(within(summary()).getByText("$4.000")).toBeVisible();
    expect(within(summary()).getByText("Total: $4.000")).toBeVisible();
  });

  it("lets the client change quantities before sending (HU06 CA1-CA2)", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.click(addButton("Pan campesino 500 g"));
    await user.click(addButton("Pan campesino 500 g"));

    expect(
      within(summary()).getByLabelText("Cantidad de Pan campesino 500 g"),
    ).toHaveValue(2);
    expect(within(summary()).getByText("$8.000")).toBeVisible();

    await user.click(
      within(summary()).getByRole("button", {
        name: "Aumentar cantidad de Pan campesino 500 g",
      }),
    );
    expect(within(summary()).getByText("Total: $12.000")).toBeVisible();
  });

  it("drops a line when its quantity goes back to zero", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.click(addButton("Pan campesino 500 g"));
    await user.click(
      within(summary()).getByRole("button", {
        name: "Disminuir cantidad de Pan campesino 500 g",
      }),
    );

    expect(within(summary()).getByText(EMPTY_MESSAGE)).toBeVisible();
    expect(
      within(summary()).queryByRole("link", { name: /continuar pedido/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps one order per store, so a shop never inherits another's cart", async () => {
    const user = userEvent.setup();
    const first = renderCatalog();
    await user.click(addButton("Pan campesino 500 g"));
    first.unmount();

    const other = render(
      <StoreCatalog reporterId={null} storeId="store-2" products={products} />,
    );
    expect(other.getByText(EMPTY_MESSAGE)).toBeVisible();
    other.unmount();

    // And the first order is still there when the client comes back.
    renderCatalog();
    expect(summary()).toBeInTheDocument();
  });

  it("keeps a product that went agotado out of the pending order (HU03 CA4)", () => {
    window.localStorage.setItem(
      "barrioshop:cart:store-1",
      JSON.stringify({ "product-3": 2 }),
    );

    renderCatalog();

    expect(screen.getByText(EMPTY_MESSAGE)).toBeVisible();
  });

  it("prices the pending order with the catalog the store shows now", () => {
    window.localStorage.setItem(
      "barrioshop:cart:store-1",
      JSON.stringify({ "product-1": 2 }),
    );

    render(
      <StoreCatalog
        reporterId={null}
        products={[makeProduct({ price: 4600 })]}
        storeId="store-1"
      />,
    );

    expect(summary()).toHaveTextContent("Total: $9.200");
  });

  it("links the client to the order step for this store", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(addButton("Pan campesino 500 g"));

    expect(
      within(summary()).getByRole("link", { name: /continuar pedido/i }),
    ).toHaveAttribute("href", "/pedido/store-1");
  });

  it("offers the visible Reportar option on every product (HU11 CA1)", () => {
    renderCatalog();

    expect(
      screen.getByRole("button", { name: "Reportar Pan campesino 500 g" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Reportar Agua de panela" }),
    ).toBeVisible();
  });
});
