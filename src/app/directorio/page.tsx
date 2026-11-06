import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { StoreDirectory } from "@/components/directory/store-directory";
import type { DirectoryStore } from "@/lib/store-directory-model";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Tiendas del barrio — BarrioShop",
  description:
    "Busca tiendas publicadas de Kennedy por categoría, barrio o cercanía.",
};

/**
 * HU04/HU05/HU10: the directory is public, so an anonymous visitor never has
 * to sign up to browse it (HU01 CA2).
 */
export default function DirectoryPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Tiendas del barrio
        </h1>
        <p className="text-muted-foreground">
          Solo mostramos las tiendas publicadas. Filtra por categoría o barrio,
          o pide las más cercanas a ti.
        </p>
      </div>
      <Suspense
        fallback={<p className="text-muted-foreground">Cargando tiendas…</p>}
      >
        <DirectoryBody />
      </Suspense>
    </main>
  );
}

async function DirectoryBody() {
  // Reading cookies is request-bound: Cache Components must defer it until an
  // incoming request exists.
  await connection();
  const supabase = await createSupabaseServerClient();

  // HU10 CA4: with neither a shared location nor a chosen barrio, the list
  // arrives alphabetical, which is exactly what search_stores returns with no
  // proximity arguments.
  const [stores, barrios] = await Promise.all([
    supabase.rpc("search_stores", {}),
    supabase
      .from("barrio_reference_points")
      .select("barrio")
      .order("barrio", { ascending: true }),
  ]);

  if (stores.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        No pudimos cargar el directorio. Intenta de nuevo.
      </p>
    );
  }

  // The row shape is pinned by the RLS suite (section 10): published stores
  // only, with the distance and the merchant point already flattened.
  const directoryStores = (stores.data ?? []) as unknown as DirectoryStore[];

  // A missing barrio list must not break browsing: the barrios actually open
  // for sale are still a usable fallback (HU10 CA3).
  const barrioValues =
    !barrios.error && barrios.data && barrios.data.length > 0
      ? barrios.data.map((row) => row.barrio)
      : [...new Set(directoryStores.map((store) => store.barrio))];

  return (
    <StoreDirectory barrios={barrioValues} initialStores={directoryStores} />
  );
}
