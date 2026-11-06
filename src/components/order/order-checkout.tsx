"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrderLines } from "@/components/order/order-lines";
import { useOrderCart } from "@/components/order/use-order-cart";
import { formatCOP } from "@/lib/currency";
import {
  buildOrderMessage,
  buildOrderPayload,
  PAYMENT_METHODS,
  validateCustomerDraft,
  type CustomerDraft,
} from "@/lib/order-model";
import type { ProductRecord } from "@/lib/product-catalog-model";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type CheckoutStore = {
  id: string;
  name: string;
  whatsapp: string;
  address: string;
  barrio: string;
};

type OrderCheckoutProps = {
  store: CheckoutStore;
  products: ProductRecord[];
  prefill: CustomerDraft;
  /** The signed-in client, or null for a neighbour browsing without an account. */
  requesterId: string | null;
};

/**
 * The last step before the order leaves the platform (HU06 CA2-CA4).
 *
 * "Enviar pedido" is a real `wa.me` link carrying the products, quantities,
 * total and client data, so the order survives a blocked script or a desktop
 * without WhatsApp. The `order_events` row is logged on the same click for the
 * "Ventas en línea" metric (formulación §18): it is a copy of what the client
 * just sent, never a prerequisite for sending it.
 */
export function OrderCheckout({
  store,
  products,
  prefill,
  requesterId,
}: OrderCheckoutProps) {
  const { lines, total, dropped, changeQuantity, clear } = useOrderCart(
    store.id,
    products,
  );
  const [draft, setDraft] = useState<CustomerDraft>(prefill);
  const [showErrors, setShowErrors] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const errors = validateCustomerDraft(draft);
  const dataComplete = Object.keys(errors).length === 0;
  const orderReady = lines.length > 0 && dataComplete;

  // A stored number that cannot become a wa.me link must be reported, not
  // crash the page the client is standing on.
  let sendHref: string | null = null;
  let phoneError: string | null = null;
  try {
    sendHref = buildWhatsAppUrl(
      store.whatsapp,
      buildOrderMessage({
        lines,
        storeName: store.name,
        total,
        customer: draft,
      }),
    );
  } catch {
    phoneError =
      "Esta tienda no tiene un número de WhatsApp válido todavía. Escríbele desde su perfil o busca otra tienda del barrio.";
  }

  function update<K extends keyof CustomerDraft>(
    key: K,
    value: CustomerDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    // The link only appears once the data are complete; this button is the
    // client telling us it wants to send, so the empty fields get named.
    event.preventDefault();
    setShowErrors(true);
  }

  async function logOrder() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("order_events").insert({
      store_id: store.id,
      requester_id: requesterId,
      payload: buildOrderPayload({ customer: draft, lines, total }),
    });

    if (error) {
      setLogError(
        "No pudimos registrar tu pedido en la tienda, pero WhatsApp se abrió igual.",
      );
    }
  }

  // HU06 CA1: a product that stopped being available leaves the order, and the
  // client is told how many left, because that changes what they are sending.
  const droppedNotice =
    dropped === 0
      ? null
      : dropped === 1
        ? "Un producto salió del pedido porque ya no está disponible."
        : `${dropped} productos salieron del pedido porque ya no están disponibles.`;

  return (
    <div className="flex flex-col gap-6">
      {lines.length === 0 ? (
        <>
          <p
            role="status"
            className="rounded-2xl border border-dashed bg-card p-6 text-sm"
          >
            Tu pedido está vacío. Agrega productos desde la tienda para poder
            enviarlo.
          </p>
          {droppedNotice ? (
            <p role="status" className="text-sm text-muted-foreground">
              {droppedNotice}
            </p>
          ) : null}
          <Link
            className={buttonVariants({
              variant: "outline",
              className: "h-10 w-fit rounded-full px-5",
            })}
            href={`/tienda/${store.id}`}
          >
            Volver a la tienda
          </Link>
        </>
      ) : (
        <section
          aria-label="Resumen del pedido"
          className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-soft"
        >
          <h2 className="text-lg font-bold">Resumen del pedido</h2>
          <OrderLines lines={lines} onQuantityChange={changeQuantity} />
          <p className="border-t pt-3 text-lg font-semibold tabular-nums">
            Total: {formatCOP(total)}
          </p>
          {droppedNotice ? (
            <p role="status" className="text-sm text-muted-foreground">
              {droppedNotice}
            </p>
          ) : null}
        </section>
      )}

      <form
        className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft"
        noValidate
        onSubmit={handleSubmit}
      >
        <h2 className="text-lg font-bold">Tus datos</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="order-name">Nombre</Label>
          <Input
            autoComplete="name"
            className="h-11 rounded-xl"
            id="order-name"
            onChange={(event) => {
              const name = event.currentTarget.value;
              update("name", name);
            }}
            value={draft.name}
          />
          {showErrors && errors.name ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="order-address">Dirección</Label>
          <Input
            autoComplete="street-address"
            className="h-11 rounded-xl"
            id="order-address"
            onChange={(event) => {
              const address = event.currentTarget.value;
              update("address", address);
            }}
            placeholder="Dónde te lo llevamos"
            value={draft.address}
          />
          {showErrors && errors.address ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.address}
            </p>
          ) : null}
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">Método de pago</legend>
          {PAYMENT_METHODS.map((method) => (
            <label className="flex items-start gap-2" key={method.id}>
              <input
                checked={draft.paymentMethod === method.id}
                name="payment-method"
                onChange={() => update("paymentMethod", method.id)}
                type="radio"
                value={method.id}
              />
              <span className="flex flex-col">
                <span>{method.label}</span>
                <span className="text-xs text-muted-foreground">
                  {method.hint}
                </span>
              </span>
            </label>
          ))}
          {showErrors && errors.paymentMethod ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.paymentMethod}
            </p>
          ) : null}
        </fieldset>

        {lines.length > 0 && phoneError ? (
          <p role="alert" className="text-sm text-destructive">
            {phoneError}
          </p>
        ) : null}

        {lines.length > 0 && !phoneError && orderReady ? (
          <a
            className={buttonVariants({})}
            href={sendHref ?? "#"}
            onClick={() => void logOrder()}
            rel="noreferrer"
            target="_blank"
          >
            Enviar pedido
          </a>
        ) : null}

        {lines.length > 0 && !phoneError && !orderReady ? (
          <Button className="w-fit" type="submit">
            Enviar pedido
          </Button>
        ) : null}

        {lines.length > 0 ? (
          <Button
            className="w-fit"
            onClick={clear}
            size="sm"
            type="button"
            variant="ghost"
          >
            Vaciar pedido
          </Button>
        ) : null}
      </form>

      {logError ? (
        <p role="alert" className="text-sm text-destructive">
          {logError}
        </p>
      ) : null}
    </div>
  );
}
