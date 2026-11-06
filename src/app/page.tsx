import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { StoreShowcase } from "@/components/home/store-showcase";
import type { DirectoryStore } from "@/lib/store-directory-model";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* eslint-disable @next/next/no-img-element -- the hero art is a local asset; swapping the placeholder does not need the optimizer. */

export const metadata: Metadata = {
  title: "BarrioShop — las tiendas de tu barrio",
  description:
    "Mira productos y precios del día, arma tu pedido y envíalo por WhatsApp. Sin comisiones, pagas contra entrega.",
};

/**
 * HU07 CA1-CA3: the home page is where a neighbour discovers the stores of
 * Kennedy. The featured ones come first and carry the badge, so the section is
 * the directory preview the mockup draws, not a separate strip.
 */
export default function Home() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 pb-12">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col gap-6">
            <h1 className="font-heading text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Las tiendas de tu barrio,{" "}
              <span className="text-primary">a un mensaje.</span>
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              Mira productos y precios del día, arma tu pedido y envíalo por
              WhatsApp. Sin comisiones, pagas contra entrega.
            </p>
          </div>

          <div className="relative aspect-[5/4] overflow-hidden rounded-3xl border shadow-lift">
            <img
              alt="Tienda de barrio en Kennedy al atardecer"
              className="h-full w-full object-cover"
              height={898}
              src="/hero-tienda.jpg"
              width={1600}
            />
          </div>
        </div>
      </section>

      <section className="border-y bg-surface/70">
        <div className="mx-auto w-full max-w-6xl px-4 py-10">
          <Suspense
            fallback={
              <p className="text-muted-foreground">Cargando tiendas…</p>
            }
          >
            <ShowcaseSection />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

async function ShowcaseSection() {
  // Reading cookies is request-bound: Cache Components must defer it until an
  // incoming request exists.
  await connection();
  const supabase = await createSupabaseServerClient();

  // HU10 CA4: with neither a shared location nor a chosen barrio the list
  // arrives alphabetical, which is exactly what search_stores returns with no
  // proximity arguments. The client filters it in place with HU04's model.
  const { data, error } = await supabase.rpc("search_stores", {});

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        No pudimos cargar las tiendas. Intenta de nuevo.
      </p>
    );
  }

  return <StoreShowcase stores={(data ?? []) as unknown as DirectoryStore[]} />;
}
