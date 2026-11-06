import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  OrderCheckout,
  type CheckoutStore,
} from "@/components/order/order-checkout";
import { getCurrentUser } from "@/lib/auth";
import {
  PRODUCT_COLUMNS,
  type ProductRecord,
} from "@/lib/product-catalog-model";
import { customerPrefill } from "@/lib/order-model";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Finaliza tu pedido — BarrioShop",
  description:
    "Revisa las cantidades, escribe tus datos y envía el pedido por WhatsApp.",
};

type StoreRow = Pick<
  CheckoutStore,
  "id" | "name" | "whatsapp" | "address" | "barrio"
>;

/**
 * HU06: the order step. It is public because ordering is what a client does
 * without an account (HU01 CA2); the session, when there is one, only prefills
 * the name and attributes the logged event.
 */
export default function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Finaliza tu pedido
        </h1>
        <p className="text-muted-foreground">
          Revisa las cantidades, dinos dónde entregarte y escríbele a la tienda
          por WhatsApp.
        </p>
      </div>
      <Suspense
        fallback={<p className="text-muted-foreground">Cargando pedido…</p>}
      >
        <OrderBody params={params} />
      </Suspense>
    </main>
  );
}

async function OrderBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Reading cookies is request-bound: Cache Components must defer it until an
  // incoming request exists.
  await connection();
  const supabase = await createSupabaseServerClient();

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, name, whatsapp, address, barrio")
    .eq("id", id)
    // A store that is not published cannot take orders (HU04 CA1, HU02 CA5).
    .eq("status", "published")
    .maybeSingle<StoreRow>();

  if (storeError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        No pudimos cargar esta tienda. Intenta de nuevo.
      </p>
    );
  }
  if (!store) notFound();

  // Prices are read now, per request, so the order total is the price the
  // merchant has today and never one remembered from the browser.
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("store_id", store.id)
    .is("deleted_at", null)
    .order("category", { ascending: true })
    .order("name", { ascending: true })
    .returns<ProductRecord[]>();

  if (productsError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        No pudimos cargar el catálogo de esta tienda.
      </p>
    );
  }

  const user = await getCurrentUser();

  return (
    <OrderCheckout
      prefill={customerPrefill(user)}
      products={products ?? []}
      requesterId={user?.id ?? null}
      store={store}
    />
  );
}
