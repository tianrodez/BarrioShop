import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StoreForm } from "@/components/stores/store-form";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Registra tu tienda — BarrioShop",
};

export default function StoreSetupPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <Suspense
        fallback={
          <p role="status" className="text-muted-foreground">
            Cargando formulario…
          </p>
        }
      >
        <StoreSetupBody />
      </Suspense>
    </main>
  );
}

async function StoreSetupBody() {
  const user = await requireUser();
  if (user.role === "administrador") redirect("/panel");

  const supabase = await createSupabaseServerClient();
  const { data: existingStore, error } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    return (
      <p role="alert">
        No pudimos comprobar si ya tienes una tienda registrada.
      </p>
    );
  }
  if (existingStore) redirect("/panel");

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Registra tu tienda
        </h1>
        <p className="text-muted-foreground">
          Al guardar, quedará En revisión. Solo aparecerá en el directorio
          después de que el equipo verifique la información.
        </p>
      </div>
      <StoreForm ownerId={user.id} />
    </section>
  );
}
