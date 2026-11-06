/**
 * Central place for Supabase connection settings.
 *
 * Security model (formulation doc, §29 + RNF-01/02):
 * - The publishable key (or legacy anon key for the local stack) is public by
 *   design; safety comes from Postgres RLS policies, not hiding the key.
 * - The SERVICE_ROLE key bypasses RLS. It must only ever live in server-side
 *   environment variables (Vercel env vars) and must never be imported by any
 *   file reachable from the browser bundle.
 */
export function readSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
        "(or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY). Create an environment " +
        "file from the README or set both variables in your hosting provider.",
    );
  }
  return { url, publicKey };
}
