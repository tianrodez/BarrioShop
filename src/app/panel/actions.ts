"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  nextStoreVisibilityStatus,
  type StoreStatus,
} from "@/lib/store-form-model";

/**
 * Merchant visibility lives in a Server Action, not in the browser client,
 * because the update has to invalidate the pages that already cached the old
 * status. `revalidatePath` only runs on the server; from a Server Action it
 * also clears the client router cache, so going back to /directorio without a
 * full reload shows the store as hidden or published.
 */
export type StoreVisibilityResult =
  { ok: true; status: "published" | "hidden" } | { ok: false; error: string };

export async function setStoreVisibility(
  storeId: string,
  currentStatus: StoreStatus,
): Promise<StoreVisibilityResult> {
  const nextStatus = nextStoreVisibilityStatus(currentStatus);
  if (!nextStatus) {
    return {
      ok: false,
      error: "Esta tienda no se puede ocultar ni publicar desde aquí.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Inicia sesión para cambiar la visibilidad." };
  }

  const { data, error } = await supabase
    .from("stores")
    .update({ status: nextStatus })
    .eq("id", storeId)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) {
    return {
      ok: false,
      error:
        error?.message ?? "No pudimos actualizar la visibilidad de la tienda.",
    };
  }

  await revalidateStoreViews();
  return { ok: true, status: nextStatus };
}

/**
 * Called after any admin action that changes what the public sees (approve,
 * retire, remove a product or toggle a feature). One call covers the home,
 * the directory, the panel and every store profile.
 */
export async function revalidateStoreViews() {
  revalidatePath("/");
  revalidatePath("/directorio");
  revalidatePath("/panel");
  revalidatePath("/tienda/[id]", "page");
}
