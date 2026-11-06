import { describe, expect, it } from "vitest";
import type { ProductRecord } from "@/lib/product-catalog-model";
import {
  addToCart,
  buildOrderMessage,
  buildOrderPayload,
  cartStorageKey,
  computeCartTotal,
  countCartUnits,
  customerPrefill,
  parseCartQuantities,
  PAYMENT_METHODS,
  paymentMethodLabel,
  removeProductFromCart,
  resolveCartLines,
  serializeCartQuantities,
  setCartQuantity,
  validateCustomerDraft,
  type CustomerDraft,
} from "@/lib/order-model";

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
];

const draft: CustomerDraft = {
  name: "María Vecina",
  address: "Calle 42 Sur # 77-10",
  paymentMethod: "domicilio",
};

describe("resolveCartLines (HU06 CA1)", () => {
  it("keeps only the products the catalog still sells, in catalog order", () => {
    const lines = resolveCartLines(catalog, { "product-2": 1, "product-1": 2 });

    expect(
      lines.map((line) => [line.product.id, line.quantity, line.lineTotal]),
    ).toEqual([
      ["product-1", 2, 8000],
      ["product-2", 1, 2500],
    ]);
  });

  it("never carries a sold-out product into an order", () => {
    const lines = resolveCartLines(catalog, { "product-3": 2 });

    expect(lines).toEqual([]);
  });

  it("drops products that are no longer in the catalog", () => {
    expect(resolveCartLines(catalog, { "product-9": 1 })).toEqual([]);
  });

  it("ignores quantities that are not a positive whole number", () => {
    expect(
      resolveCartLines(catalog, { "product-1": 0, "product-2": 1.5 }).length,
    ).toBe(0);
  });

  it("prices every line from the live catalog, not from the stored cart", () => {
    const repriced = [makeProduct({ id: "product-1", price: 4600 })];

    const [line] = resolveCartLines(repriced, { "product-1": 2 });
    expect(line.lineTotal).toBe(9200);
  });
});

describe("addToCart (HU06 CA1)", () => {
  it("adds one unit of an available product", () => {
    expect(addToCart({}, catalog[0])).toEqual({ "product-1": 1 });
  });

  it("increases the quantity when the product is already in the cart", () => {
    expect(addToCart({ "product-1": 2 }, catalog[0])).toEqual({
      "product-1": 3,
    });
  });

  it("refuses a sold-out product and leaves the cart untouched", () => {
    const before = { "product-1": 1 };

    expect(addToCart(before, catalog[2])).toEqual(before);
  });
});

describe("setCartQuantity and removeProductFromCart (HU06 CA1)", () => {
  it("changes the quantity before sending", () => {
    expect(setCartQuantity({ "product-1": 1 }, "product-1", 5)).toEqual({
      "product-1": 5,
    });
  });

  it("removes the product when the quantity drops to zero or below", () => {
    expect(
      setCartQuantity({ "product-1": 1, "product-2": 2 }, "product-1", 0),
    ).toEqual({ "product-2": 2 });
    expect(removeProductFromCart({ "product-1": 1 }, "product-1")).toEqual({});
  });

  it("never stores a fractional or nonsense quantity", () => {
    expect(setCartQuantity({ "product-1": 1 }, "product-1", 2.7)).toEqual({});
    expect(
      setCartQuantity({ "product-1": 1 }, "product-1", Number.NaN),
    ).toEqual({});
  });
});

describe("computeCartTotal and countCartUnits (HU06 CA2)", () => {
  it("adds the line totals", () => {
    expect(
      computeCartTotal(
        resolveCartLines(catalog, { "product-1": 2, "product-2": 1 }),
      ),
    ).toBe(10500);
  });

  it("is zero for an empty cart", () => {
    expect(computeCartTotal([])).toBe(0);
    expect(countCartUnits({ "product-1": 3, "product-2": 2 })).toBe(5);
    expect(countCartUnits({})).toBe(0);
  });
});

describe("payment methods (HU06 CA3)", () => {
  it("offers exactly the two ways the story names", () => {
    expect(PAYMENT_METHODS.map((method) => method.id)).toEqual([
      "domicilio",
      "recogida",
    ]);
    expect(paymentMethodLabel("domicilio")).toBe("Domicilio contra entrega");
    expect(paymentMethodLabel("recogida")).toBe("Recogida en el local");
  });

  it("has no label for a method that does not exist", () => {
    expect(paymentMethodLabel("nope" as never)).toBe("nope");
  });
});

describe("validateCustomerDraft (HU06 CA3)", () => {
  it("accepts a complete draft", () => {
    expect(validateCustomerDraft(draft)).toEqual({});
  });

  it("asks for the three fields the story requires", () => {
    expect(
      validateCustomerDraft({
        name: "",
        address: "",
        paymentMethod: "" as never,
      }),
    ).toEqual({
      name: "Escribe tu nombre.",
      address: "Escribe la dirección de entrega.",
      paymentMethod: "Elige cómo vas a pagar.",
    });
  });

  it("does not accept a name made only of spaces", () => {
    expect(validateCustomerDraft({ ...draft, name: "   " }).name).toBe(
      "Escribe tu nombre.",
    );
  });
});

describe("customerPrefill (HU06 CA3)", () => {
  it("prefills the name a signed-in client already has", () => {
    expect(customerPrefill({ fullName: "María Vecina" })).toEqual({
      name: "María Vecina",
      address: "",
      paymentMethod: "",
    });
  });

  it("leaves the draft empty for an anonymous client", () => {
    expect(customerPrefill(null)).toEqual({
      name: "",
      address: "",
      paymentMethod: "",
    });
    expect(customerPrefill({ fullName: "" }).name).toBe("");
  });
});

describe("buildOrderMessage (HU06 CA4)", () => {
  it("writes products, quantities, total and client data", () => {
    const lines = resolveCartLines(catalog, { "product-1": 2, "product-2": 1 });

    expect(
      buildOrderMessage({
        storeName: "Panadería La Espiga",
        lines,
        total: computeCartTotal(lines),
        customer: draft,
      }),
    ).toBe(
      [
        "Hola Panadería La Espiga, quiero hacer este pedido:",
        "",
        "• 2 × Pan campesino 500 g — $8.000",
        "• 1 × Café americano — $2.500",
        "",
        "Total: $10.500",
        "",
        "Nombre: María Vecina",
        "Dirección: Calle 42 Sur # 77-10",
        "Pago: Domicilio contra entrega",
      ].join("\n"),
    );
  });

  it("names the store once and never repeats the header", () => {
    const message = buildOrderMessage({
      storeName: "Fruver El Campo",
      lines: resolveCartLines(catalog, { "product-2": 1 }),
      total: 2500,
      customer: { ...draft, paymentMethod: "recogida" },
    });

    expect(message.match(/Hola Fruver El Campo/g)).toHaveLength(1);
    expect(message).toContain("Pago: Recogida en el local");
  });
});

describe("buildOrderPayload (formulación §18, order_events)", () => {
  it("uses the documented payload shape", () => {
    const lines = resolveCartLines(catalog, { "product-1": 2, "product-2": 1 });

    expect(
      buildOrderPayload({
        lines,
        total: computeCartTotal(lines),
        customer: draft,
      }),
    ).toEqual({
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
    });
  });

  it("trims what the client typed before storing it", () => {
    const payload = buildOrderPayload({
      lines: [],
      total: 0,
      customer: { ...draft, name: "  Ana  ", address: " Calle 1 " },
    });

    expect(payload.customer).toEqual({
      name: "Ana",
      address: "Calle 1",
      payment_method: "domicilio",
    });
  });
});

describe("cart storage", () => {
  it("keys the cart per store so two shops never mix", () => {
    expect(cartStorageKey("store-1")).not.toBe(cartStorageKey("store-2"));
    expect(cartStorageKey("store-1")).toContain("store-1");
  });

  it("round-trips quantities", () => {
    expect(
      parseCartQuantities(serializeCartQuantities({ "product-1": 2 })),
    ).toEqual({ "product-1": 2 });
  });

  it("survives a corrupted or hostile stored value", () => {
    expect(parseCartQuantities(null)).toEqual({});
    expect(parseCartQuantities("not json")).toEqual({});
    expect(parseCartQuantities("[]")).toEqual({});
    expect(parseCartQuantities('{"product-1":"2"}')).toEqual({
      "product-1": 2,
    });
    expect(parseCartQuantities('{"product-1":-3}')).toEqual({});
    expect(parseCartQuantities('{"product-1":null,"product-2":1}')).toEqual({
      "product-2": 1,
    });
  });
});
