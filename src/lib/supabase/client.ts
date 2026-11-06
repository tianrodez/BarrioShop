import { createBrowserClient } from "@supabase/ssr";
import { readSupabaseEnv } from "./env";

/**
 * Supabase client for Client Components.
 * Only ever built with the public anon key; all data isolation is enforced
 * by Postgres RLS policies (HU02 CA4, RNF-02).
 */
export function createSupabaseBrowserClient() {
  const { url, publicKey } = readSupabaseEnv();
  return createBrowserClient(url, publicKey, {
    // Must match the server cookie name even when Docker uses an internal
    // Supabase hostname that differs from the browser-visible URL.
    cookieOptions: { name: "barrioshop-auth-token" },
  });
}
