import { formatCOP } from "@/lib/currency";
import type { ProductRecord } from "@/lib/product-catalog-model";

/**
 * Order model (HU06).
 *
 * The cart stores quantities only. Names and prices are always resolved
 * against the catalog the server just read, so a neighbour can never send — or
 * be charged for — a price that the merchant already changed, and a product
 * that went agotado or was removed while it sat in the cart simply stops being
 * part of the order (HU03 CA4, HU06 CA1).
 *
 * Orders leave the platform through WhatsApp (formulación §5); the logged
 * `order_events` payload is what feeds the "Ventas en línea" metric (§18) and
 * the merchant's dashboard, so its shape is the documented one.
 */

export type PaymentMethodId = "domicilio" | "recogida";

export const PAYMENT_METHODS: readonly {
  id: PaymentMethodId;
  label: string;
  hint: string;
}[] = [
  {
    id: "domicilio",
    label: "Domicilio contra entrega",
    hint: "Te lo llevamos y pagas al recibir.",
  },
  {
    id: "recogida",
    label: "Recogida en el local",
    hint: "Pasa por la tienda en su horario.",
  },
];

export function paymentMethodLabel(id: PaymentMethodId | ""): string {
  const method = PAYMENT_METHODS.find((candidate) => candidate.id === id);
  return method ? method.label : String(id);
}

/** productId → units wanted. */
export type CartQuantities = Record<string, number>;

export type CartLine = {
  product: ProductRecord;
  quantity: number;
  lineTotal: number;
};

export type CustomerDraft = {
  name: string;
  address: string;
  paymentMethod: PaymentMethodId | "";
};

export type OrderEventPayload = {
  items: {
    product_id: string | null;
    name: string;
    quantity: number;
    price: number;
  }[];
  total: number;
  customer: {
    name: string;
    address: string;
    payment_method: PaymentMethodId | "";
  };
};

function isUsableQuantity(quantity: unknown): quantity is number {
  return (
    typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0
  );
}

/**
 * HU06 CA1: the order contains what the client asked for *and* what the store
 * still sells. A sold-out product is never part of an order, even if it was in
 * the cart before the merchant marked it agotado.
 */
export function resolveCartLines(
  products: readonly ProductRecord[],
  quantities: CartQuantities,
): CartLine[] {
  return products
    .filter(
      (product) =>
        product.status === "available" &&
        isUsableQuantity(quantities[product.id]),
    )
    .map((product) => {
      const quantity = quantities[product.id];

      return {
        product,
        quantity,
        lineTotal: product.price * quantity,
      };
    });
}

export function addToCart(
  quantities: CartQuantities,
  product: Pick<ProductRecord, "id" | "status">,
): CartQuantities {
  // HU06 CA1: "los productos agotados no se pueden agregar".
  if (product.status !== "available") return quantities;

  return { ...quantities, [product.id]: (quantities[product.id] ?? 0) + 1 };
}

export function setCartQuantity(
  quantities: CartQuantities,
  productId: string,
  quantity: number,
): CartQuantities {
  return writeQuantity(quantities, productId, quantity);
}

export function removeProductFromCart(
  quantities: CartQuantities,
  productId: string,
): CartQuantities {
  return withoutProduct(quantities, productId);
}

function withoutProduct(
  quantities: CartQuantities,
  productId: string,
): CartQuantities {
  return Object.fromEntries(
    Object.entries(quantities).filter(([key]) => key !== productId),
  );
}

function writeQuantity(
  quantities: CartQuantities,
  productId: string,
  quantity: number,
): CartQuantities {
  const rest = withoutProduct(quantities, productId);
  if (!isUsableQuantity(quantity)) return rest;

  return { ...rest, [productId]: quantity };
}

export function computeCartTotal(lines: readonly CartLine[]): number {
  return lines.reduce((total, line) => total + line.lineTotal, 0);
}

export function countCartUnits(quantities: CartQuantities): number {
  return Object.values(quantities)
    .filter(isUsableQuantity)
    .reduce((units, quantity) => units + quantity, 0);
}

/**
 * HU06 CA3: the story names three fields the client must fill before sending,
 * and all three are required.
 */
export function validateCustomerDraft(
  draft: CustomerDraft,
): Partial<Record<keyof CustomerDraft, string>> {
  const errors: Partial<Record<keyof CustomerDraft, string>> = {};

  if (!draft.name.trim()) errors.name = "Escribe tu nombre.";
  if (!draft.address.trim())
    errors.address = "Escribe la dirección de entrega.";
  if (!draft.paymentMethod) errors.paymentMethod = "Elige cómo vas a pagar.";

  return errors;
}

/**
 * HU06 CA3: a signed-in client does not type its name again. The store keeps
 * no delivery address for anyone, so that field and the payment choice are
 * always the client's own, order by order.
 */
export function customerPrefill(
  user: { fullName: string | null } | null,
): CustomerDraft {
  return {
    name: user?.fullName ?? "",
    address: "",
    paymentMethod: "",
  };
}

/** HU06 CA4: everything WhatsApp must already show, written out. */
export function buildOrderMessage(args: {
  storeName: string;
  lines: readonly CartLine[];
  total: number;
  customer: CustomerDraft;
}): string {
  const items = args.lines.map(
    (line) =>
      `• ${line.quantity} × ${line.product.name} — ${formatCOP(line.lineTotal)}`,
  );

  return [
    `Hola ${args.storeName}, quiero hacer este pedido:`,
    "",
    ...items,
    "",
    `Total: ${formatCOP(args.total)}`,
    "",
    `Nombre: ${args.customer.name.trim()}`,
    `Dirección: ${args.customer.address.trim()}`,
    `Pago: ${paymentMethodLabel(args.customer.paymentMethod)}`,
  ].join("\n");
}

/** The `order_events.payload` shape documented in the schema and used by the seed. */
export function buildOrderPayload(args: {
  lines: readonly CartLine[];
  total: number;
  customer: CustomerDraft;
}): OrderEventPayload {
  return {
    items: args.lines.map((line) => ({
      product_id: line.product.id,
      name: line.product.name,
      quantity: line.quantity,
      price: line.product.price,
    })),
    total: args.total,
    customer: {
      name: args.customer.name.trim(),
      address: args.customer.address.trim(),
      payment_method: args.customer.paymentMethod,
    },
  };
}

export function cartStorageKey(storeId: string): string {
  return `barrioshop:cart:${storeId}`;
}

export function serializeCartQuantities(quantities: CartQuantities): string {
  return JSON.stringify(quantities);
}

/** A hostile or half-written localStorage value must never break the order. */
export function parseCartQuantities(raw: string | null): CartQuantities {
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  // Arrays are objects too: only a plain map of quantities is usable.
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const quantities: CartQuantities = {};
  for (const [productId, value] of Object.entries(parsed)) {
    const quantity = typeof value === "string" ? Number(value) : value;
    if (isUsableQuantity(quantity)) quantities[productId] = quantity;
  }

  return quantities;
}
