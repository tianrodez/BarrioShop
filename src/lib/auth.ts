import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { panelPathForRole, type StoreRole } from "@/lib/auth-roles";

export type { StoreRole };

export type CurrentUser = {
  id: string;
  email: string;
  role: StoreRole;
  fullName: string | null;
};

/**
 * Data Access Layer for the current session (Next 16 + Cache Components).
 *
 * It reads cookies, so it can only run inside a `<Suspense>` boundary —
 * never at the top level of a layout, and never inside the static shell.
 * Returns `null` for anonymous visitors (HU01 CA2: clients browse without
 * an account, so most of the site is anonymous by design).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Supabase Auth validates session expiry with Date.now(). Cache Components
  // must defer this request-bound operation until an incoming request exists.
  await connection();
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle<{ role: StoreRole; full_name: string | null }>();

  return {
    id: user.id,
    email: user.email ?? "",
    // A missing profile must never widen access: fall back to the lowest role.
    role: profile?.role ?? "cliente",
    fullName: profile?.full_name ?? null,
  };
}

/**
 * Guard for authenticated areas (HU09 CA4: the panel is only reachable with
 * valid credentials). Throws a redirect during streaming when there is no
 * session.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** A valid client account must not enter the merchant/admin panel. */
export async function requirePanelUser(): Promise<CurrentUser> {
  const user = await requireUser();
  const allowedPath = panelPathForRole(user.role);
  if (allowedPath !== "/panel") redirect(allowedPath);
  return user;
}
