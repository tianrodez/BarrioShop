import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  StoreProfile,
  type PublicStoreProfile,
} from "@/components/stores/store-profile";
import {
  PRODUCT_COLUMNS,
  type ProductRecord,
} from "@/lib/product-catalog-model";
import { getCurrentUser } from "@/lib/auth";
import { parseStorePoint } from "@/lib/store-form-model";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StoreRow = Omit<PublicStoreProfile, "point"> & { location: unknown };

export const metadata: Metadata = {
  title: "Tienda del barrio — BarrioShop",
};

/**
 * HU02 CA3 / HU05 CA4: the public page of one store. It is reachable without
 * an account (HU01 CA2) and shows what the merchant published.
 */
export default function StoreProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Suspense
        fallback={<p className="text-muted-foreground">Cargando tienda…</p>}
      >
        <StoreProfileBody params={params} />
      </Suspense>
    </main>
  );
}

async function StoreProfileBody({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Reading cookies is request-bound: Cache Components must defer it until an
  // incoming request exists.
  await connection();
  const supabase = await createSupabaseServerClient();

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select(
      "id, name, store_type, description, photo_url, address, barrio, upz, reference_place, whatsapp, opening_hours, location",
    )
    .eq("id", id)
    // Published only: hiding a store (HU02 CA5) or never approving it (HU09)
    // takes the whole page away, not only the directory card.
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

  // The catalog excludes removed products (their rows stay only to preserve
  // report context), and every change the merchant saved is already here
  // because this page reads it per request.
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
    <StoreProfile
      store={{ ...store, point: parseStorePoint(store.location) }}
      products={products ?? []}
      // HU11 CA1: the report option is visible to everyone; only a signed-in
      // visitor can actually file one.
      reporterId={user?.id ?? null}
    />
  );
}
