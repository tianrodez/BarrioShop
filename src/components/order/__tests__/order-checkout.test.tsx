import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderCheckout } from "@/components/order/order-checkout";
import type { ProductRecord } from "@/lib/product-catalog-model";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ from }),
}));

const inserts: { table: string; values: unknown }[] = [];

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

const store = {
  id: "store-1",
  name: "Panadería La Espiga",
  whatsapp: "573001112233",
  address: "Cra 72 #15-20",
  barrio: "Castilla",
};

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

function renderCheckout({
  cart = { "product-1": 2, "product-2": 1 },
  products: catalog = products,
  requesterId = null,
  name = "",
}: {
  cart?: Record<string, number>;
  products?: ProductRecord[];
  requesterId?: string | null;
  name?: string;
} = {}) {
  window.localStorage.setItem("barrioshop:cart:store-1", JSON.stringify(cart));

  return render(
    <OrderCheckout
      prefill={{ address: "", name, paymentMethod: "" }}
      products={catalog}
      requesterId={requesterId}
      store={store}
    />,
  );
}

/**
 * jsdom refuses real navigation; cancelling the anchor's default at the
 * document level still runs React's handler, which is what is under test.
 */
function withoutNavigation(run: () => void) {
  const block = (event: Event) => event.preventDefault();
  document.addEventListener("click", block, true);
  try {
    run();
  } finally {
    document.removeEventListener("click", block, true);
  }
}

async function fillClientData(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre"), "María Vecina");
  await user.type(screen.getByLabelText("Dirección"), "Calle 42 Sur # 77-10");
  await user.click(
    screen.getByRole("radio", { name: /Domicilio contra entrega/ }),
  );
}

describe("OrderCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inserts.length = 0;
    from.mockImplementation((table: string) => ({
      insert: async (values: unknown) => {
        inserts.push({ table, values });
        return { error: null };
      },
    }));
  });
  afterEach(() => window.localStorage.clear());

  it("asks for the three fields the story requires (HU06 CA3)", () => {
    renderCheckout();

    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Dirección")).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Domicilio contra entrega/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Recogida en el local/ }),
    ).toBeInTheDocument();
  });

  it("shows the order the client is about to send", () => {
    renderCheckout();

    const order = screen.getByRole("region", { name: "Resumen del pedido" });
    expect(within(order).getByText("Pan campesino 500 g")).toBeVisible();
    expect(within(order).getByText("Café americano")).toBeVisible();
    // HU06 CA2: 2 × 4.000 + 1 × 2.500
    expect(within(order).getByText("Total: $10.500")).toBeVisible();
  });

  it("does not offer to send while the client data are missing", async () => {
    const user = userEvent.setup();
    renderCheckout();

    await user.click(screen.getByRole("button", { name: "Enviar pedido" }));

    const errors = screen.getAllByRole("alert");
    expect(errors.map((error) => error.textContent).join(" ")).toContain(
      "Escribe tu nombre.",
    );
    expect(
      screen.queryByRole("link", { name: "Enviar pedido" }),
    ).not.toBeInTheDocument();
    expect(inserts).toHaveLength(0);
  });

  it("keeps an agotado product out of the order it sends (HU06 CA1, HU03 CA4)", async () => {
    const user = userEvent.setup();
    renderCheckout({ cart: { "product-1": 1, "product-3": 2 } });

    expect(
      screen.getByText(/salió del pedido porque ya no está disponible/i),
    ).toBeVisible();
    const order = screen.getByRole("region", { name: "Resumen del pedido" });
    expect(within(order).queryByText("Agua de panela")).not.toBeInTheDocument();
    expect(within(order).getByText("Total: $4.000")).toBeVisible();

    await fillClientData(user);
    const link = screen.getByRole<HTMLAnchorElement>("link", {
      name: "Enviar pedido",
    });
    expect(link.href).toContain("wa.me/573001112233");
    expect(decodeURIComponent(link.href)).not.toContain("Agua de panela");
  });

  it("opens WhatsApp with the products, total and client data written (HU06 CA4)", async () => {
    const user = userEvent.setup();
    renderCheckout();
    await fillClientData(user);

    const link = screen.getByRole<HTMLAnchorElement>("link", {
      name: "Enviar pedido",
    });
    expect(link).toHaveAttribute("target", "_blank");
    const message = decodeURIComponent(link.href.split("text=")[1]);

    expect(message).toContain("Hola Panadería La Espiga");
    expect(message).toContain("• 2 × Pan campesino 500 g — $8.000");
    expect(message).toContain("• 1 × Café americano — $2.500");
    expect(message).toContain("Total: $10.500");
    expect(message).toContain("Nombre: María Vecina");
    expect(message).toContain("Dirección: Calle 42 Sur # 77-10");
    expect(message).toContain("Pago: Domicilio contra entrega");
  });

  it("logs the sent order for an anonymous client with the documented payload", async () => {
    const user = userEvent.setup();
    renderCheckout();
    await fillClientData(user);

    withoutNavigation(() =>
      fireEvent.click(screen.getByRole("link", { name: "Enviar pedido" })),
    );

    await waitFor(() => expect(inserts).toHaveLength(1));
    expect(inserts[0].table).toBe("order_events");
    expect(inserts[0].values).toEqual({
      store_id: "store-1",
      requester_id: null,
      payload: {
        items: [
          {
            product_id: "product-1",
            name: "Pan campesino 500 g",
            quantity: 2,
            price: 4000,
          },
          {
            product_id: "product-2",
            name: "Café americano",
            quantity: 1,
            price: 2500,
          },
        ],
        total: 10500,
        customer: {
          name: "María Vecina",
          address: "Calle 42 Sur # 77-10",
          payment_method: "domicilio",
        },
      },
    });
  });

  it("attributes the logged order to the signed-in client, never to someone else", async () => {
    const user = userEvent.setup();
    renderCheckout({ requesterId: "user-1" });
    await fillClientData(user);

    withoutNavigation(() =>
      fireEvent.click(screen.getByRole("link", { name: "Enviar pedido" })),
    );

    await waitFor(() => expect(inserts).toHaveLength(1));
    expect(
      (inserts[0].values as { requester_id: string | null }).requester_id,
    ).toBe("user-1");
  });

  it("prefills the name of a client with a session (HU06 CA3)", () => {
    renderCheckout({ name: "María Vecina" });

    expect(screen.getByLabelText("Nombre")).toHaveValue("María Vecina");
    // Nothing else is stored about a client, so the rest is typed per order.
    expect(screen.getByLabelText("Dirección")).toHaveValue("");
  });

  it("sends the collected data instead of the prefilled name when the client edits it", async () => {
    const user = userEvent.setup();
    renderCheckout({ name: "María Vecina" });

    await user.clear(screen.getByLabelText("Nombre"));
    await user.type(screen.getByLabelText("Nombre"), "Ana Ñoño");
    await user.type(screen.getByLabelText("Dirección"), "Calle 1 # 2-3");
    await user.click(
      screen.getByRole("radio", { name: /Recogida en el local/ }),
    );

    const message = decodeURIComponent(
      screen
        .getByRole<HTMLAnchorElement>("link", { name: "Enviar pedido" })
        .href.split("text=")[1],
    );
    expect(message).toContain("Nombre: Ana Ñoño");
    expect(message).toContain("Pago: Recogida en el local");
  });

  it("says so when the order is empty and sends nothing", () => {
    renderCheckout({ cart: {} });

    expect(screen.getByRole("status")).toHaveTextContent(/vacío/i);
    expect(
      screen.getByRole("link", { name: /volver a la tienda/i }),
    ).toHaveAttribute("href", "/tienda/store-1");
    expect(
      screen.queryByRole("link", { name: "Enviar pedido" }),
    ).not.toBeInTheDocument();
    expect(inserts).toHaveLength(0);
  });

  it("lets the client change quantities here too before sending", () => {
    renderCheckout();

    fireEvent.change(screen.getByLabelText("Cantidad de Pan campesino 500 g"), {
      target: { value: "5" },
    });

    expect(
      screen.getByRole("region", { name: "Resumen del pedido" }),
    ).toHaveTextContent("Total: $22.500");
  });

  it("says so when the store has no usable number instead of faking a link", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("barrioshop:cart:store-1", '{"product-1":1}');
    render(
      <OrderCheckout
        prefill={{ address: "", name: "", paymentMethod: "" }}
        products={products}
        requesterId={null}
        store={{ ...store, whatsapp: "12345" }}
      />,
    );

    await fillClientData(user);

    // HU06 CA4 needs a real wa.me target; an invalid number must not produce one.
    expect(
      screen.queryByRole("link", { name: "Enviar pedido" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /número de WhatsApp válido/,
    );
  });

  it("can empty the order without losing the data already typed", async () => {
    const user = userEvent.setup();
    renderCheckout();
    await fillClientData(user);

    await user.click(screen.getByRole("button", { name: "Vaciar pedido" }));

    expect(screen.getByRole("status")).toHaveTextContent(/vacío/i);
    expect(window.localStorage.getItem("barrioshop:cart:store-1")).toBe("{}");
    expect(screen.getByLabelText("Nombre")).toHaveValue("María Vecina");
  });

  it("still opens WhatsApp when the log fails, and tells the client", async () => {
    from.mockImplementation(() => ({
      insert: async () => ({ error: new Error("row-level security") }),
    }));
    const user = userEvent.setup();
    renderCheckout();
    await fillClientData(user);

    // The link itself is the deep link, so the client is never stuck.
    expect(
      screen.getByRole("link", { name: "Enviar pedido" }).getAttribute("href"),
    ).toMatch(/wa\.me\/573001112233/);

    withoutNavigation(() =>
      fireEvent.click(screen.getByRole("link", { name: "Enviar pedido" })),
    );

    const warning = await screen.findByRole("alert");
    expect(warning).toHaveTextContent(/no pudimos registrar/i);
  });
});
