import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { readSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components and Route Handlers.
 * Reads the user's SSR cookie. @supabase/ssr cookies are browser-readable so
 * its browser client can refresh the session; authorization is enforced by
 * GoTrue and database RLS, never by trusting client-provided role data.
 */
export async function createSupabaseServerClient() {
  const { url, publicKey } = readSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publicKey, {
    cookieOptions: { name: "barrioshop-auth-token" },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component: cookie writing is handled by the
          // proxy (session refresh), so this is safe to ignore here.
        }
      },
    },
  });
}
