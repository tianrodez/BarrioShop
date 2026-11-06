import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderCheckout } from "@/components/order/order-checkout";
import { StoreCatalog } from "@/components/order/store-catalog";
import type { ProductRecord } from "@/lib/product-catalog-model";
import {
  computeCartTotal,
  resolveCartLines,
  buildOrderMessage,
} from "@/lib/order-model";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ from }),
}));

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

const catalog = [
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
  makeProduct({
    id: "product-4",
    name: "Pan de molde",
    price: 6000,
    status: "sold_out",
  }),
];

const store = {
  id: "store-1",
  name: "Panadería La Espiga",
  whatsapp: "573001112233",
  address: "Cra 72 #15-20",
  barrio: "Castilla",
};

function writeCart(quantities: Record<string, number>, storeId = store.id) {
  window.localStorage.setItem(
    `barrioshop:cart:${storeId}`,
    JSON.stringify(quantities),
  );
}

function writeRawCart(raw: string, storeId = store.id) {
  window.localStorage.setItem(`barrioshop:cart:${storeId}`, raw);
}

function renderCheckout(quantities: Record<string, number>) {
  writeCart(quantities);
  return render(
    <OrderCheckout
      prefill={{ address: "", name: "", paymentMethod: "" }}
      products={catalog}
      requesterId={null}
      store={store}
    />,
  );
}

async function fillClientData(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre"), "María Vecina");
  await user.type(screen.getByLabelText("Dirección"), "Calle 42 Sur # 77-10");
  await user.click(
    screen.getByRole("radio", { name: /Domicilio contra entrega/ }),
  );
}

describe("order verification probes", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    from.mockImplementation(() => ({
      insert: async () => ({ error: null }),
    }));
  });
  afterEach(() => window.localStorage.clear());

  it("sends exactly the deep link the order model describes (HU06 CA4)", async () => {
    const user = userEvent.setup();
    renderCheckout({ "product-1": 2, "product-2": 1 });
    await fillClientData(user);

    const quantities = { "product-1": 2, "product-2": 1 };
    const lines = resolveCartLines(catalog, quantities);
    const expected = buildWhatsAppUrl(
      store.whatsapp,
      buildOrderMessage({
        customer: {
          address: "Calle 42 Sur # 77-10",
          name: "María Vecina",
          paymentMethod: "domicilio",
        },
        lines,
        storeName: store.name,
        total: computeCartTotal(lines),
      }),
    );

    expect(
      screen.getByRole<HTMLAnchorElement>("link", { name: "Enviar pedido" })
        .href,
    ).toBe(expected);
  });

  it("reads a quantity stored as a string as the quantity it is", () => {
    writeRawCart('{"product-1":"2"}');
    render(
      <OrderCheckout
        prefill={{ address: "", name: "", paymentMethod: "" }}
        products={catalog}
        requesterId={null}
        store={store}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Resumen del pedido" }),
    ).toHaveTextContent("Total: $8.000");
    expect(
      screen.getByLabelText("Cantidad de Pan campesino 500 g"),
    ).toHaveValue(2);
  });

  it("counts every product that left the order (HU06 CA1)", () => {
    renderCheckout({ "product-1": 1, "product-3": 2, "product-4": 1 });

    const notices = screen.getAllByRole("status");
    expect(notices.map((node) => node.textContent)).toContain(
      "2 productos salieron del pedido porque ya no están disponibles.",
    );
    expect(
      screen.getByRole("region", { name: "Resumen del pedido" }),
    ).toHaveTextContent("Total: $4.000");
  });

  it("explains why the order is empty when every product left it", () => {
    renderCheckout({ "product-3": 2, "product-4": 1 });

    expect(screen.getByText(/vacío/i)).toBeVisible();
    expect(
      screen.getByText(
        "2 productos salieron del pedido porque ya no están disponibles.",
      ),
    ).toBeVisible();
  });

  it("renders a hostile browser cart without throwing", () => {
    const hostile = [
      "[1,2]",
      "null",
      '"str"',
      "5",
      "nope",
      '{"a":-3,"b":1.5,"c":"2"}',
    ];

    for (const raw of hostile) {
      writeRawCart(raw);

      let view = render(<StoreCatalog reporterId={null} products={catalog} storeId={store.id} />);
      expect(view.container).toBeVisible();
      view.unmount();

      view = render(
        <OrderCheckout
          prefill={{ address: "", name: "", paymentMethod: "" }}
          products={catalog}
          requesterId={null}
          store={store}
        />,
      );
      expect(view.container).toBeVisible();
      view.unmount();

      window.localStorage.clear();
    }
  });

  it("never shows a browser cart on the server (no hydration mismatch)", () => {
    writeCart({ "product-1": 2 });

    const html = renderToString(
      <StoreCatalog reporterId={null} products={catalog} storeId={store.id} />,
    );

    // The server snapshot is the empty cart: what is stored in this browser
    // arrives after hydration, so the two renders can never disagree.
    expect(html).toContain("Aún no has agregado productos.");
    expect(html).not.toContain("Continuar pedido");
    expect(html).toContain("Agregar Pan campesino 500 g al pedido");
  });

  it("empties this store and leaves the other one alone", async () => {
    const user = userEvent.setup();
    writeCart({ "product-1": 1 }, "store-2");
    renderCheckout({ "product-1": 2 });

    await user.click(screen.getByRole("button", { name: "Vaciar pedido" }));

    expect(window.localStorage.getItem(`barrioshop:cart:${store.id}`)).toBe(
      "{}",
    );
    expect(window.localStorage.getItem("barrioshop:cart:store-2")).toBe(
      '{"product-1":1}',
    );
  });

  it.each([
    ["1.5", "a fractional quantity"],
    ["-4", "a negative quantity"],
  ])("drops the line for %s", (value) => {
    renderCheckout({ "product-1": 2 });

    fireEvent.change(screen.getByLabelText("Cantidad de Pan campesino 500 g"), {
      target: { value },
    });

    expect(
      screen.getByText(
        "Tu pedido está vacío. Agrega productos desde la tienda para poder enviarlo.",
      ),
    ).toBeVisible();
    expect(window.localStorage.getItem(`barrioshop:cart:${store.id}`)).toBe(
      "{}",
    );
  });

  it("keeps the catalog summary and the order step agreeing on the total", () => {
    writeCart({ "product-1": 2, "product-2": 1 });

    const catalogView = render(
      <StoreCatalog reporterId={null} products={catalog} storeId={store.id} />,
    );
    expect(
      within(catalogView.getByRole("region", { name: "Tu pedido" })).getByText(
        "Total: $10.500",
      ),
    ).toBeVisible();
    catalogView.unmount();

    const orderView = render(
      <OrderCheckout
        prefill={{ address: "", name: "", paymentMethod: "" }}
        products={catalog}
        requesterId={null}
        store={store}
      />,
    );
    expect(
      orderView.getByRole("region", { name: "Resumen del pedido" }),
    ).toHaveTextContent("Total: $10.500");
    orderView.unmount();
  });
});
