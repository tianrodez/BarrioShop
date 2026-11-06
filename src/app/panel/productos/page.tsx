import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductManager } from "@/components/products/product-manager";
import { requirePanelUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PRODUCT_COLUMNS,
  type ProductRecord,
} from "@/lib/product-catalog-model";

export const metadata: Metadata = {
  title: "Gestiona tu catálogo — BarrioShop",
};

export default function ProductCatalogPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Suspense
        fallback={<p className="text-muted-foreground">Cargando catálogo…</p>}
      >
        <ProductCatalogBody />
      </Suspense>
    </main>
  );
}

async function ProductCatalogBody() {
  const user = await requirePanelUser();
  if (user.role !== "comerciante") redirect("/panel");

  const supabase = await createSupabaseServerClient();
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (storeError) {
    return <p role="alert">No pudimos cargar tu tienda.</p>;
  }
  if (!store) redirect("/panel/tienda");

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("store_id", store.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<ProductRecord[]>();

  if (productsError) {
    return <p role="alert">No pudimos cargar los productos de tu tienda.</p>;
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Mi catálogo</h1>
          <p className="text-muted-foreground">
            Actualiza productos, precios y disponibilidad de tu tienda.
          </p>
        </div>
        <Link href="/panel" className="text-sm text-muted-foreground underline">
          Volver al panel
        </Link>
      </div>
      <ProductManager
        ownerId={user.id}
        storeId={store.id}
        products={products ?? []}
      />
    </section>
  );
}
