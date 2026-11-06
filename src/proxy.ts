import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Session refresh before any route renders (Next 16 file convention: this
 * used to be `middleware.ts`, now `proxy.ts`, and it runs on Node runtime).
 *
 * Supabase access tokens expire; refreshing here rewrites the auth cookies
 * so Server Components and the browser keep a valid session without a
 * dedicated login round-trip.
 *
 * Env vars are read defensively: when they are missing (CI image builds)
 * the proxy becomes a no-op instead of crashing every request.
 */
/** Route prefixes that require a session (panels come in U3/U7). */
const PROTECTED_PREFIXES = ["/panel"];

/**
 * Presence check only: the auth cookie name is derived from the project ref
 * (`sb-<ref>-auth-token`, possibly chunked), so any `sb-*-auth-token` cookie
 * counts as a session. Validity is enforced by requireUser() downstream.
 */
function hasAuthSession(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      ({ name }) =>
        name === "barrioshop-auth-token" ||
        name.startsWith("barrioshop-auth-token."),
    );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Fast guard (HU09 CA4): protected areas never render for an anonymous
  // visitor. This is UX only — requireUser() in the panel is the security
  // boundary, because a missing cookie here is cheap to trust and easy to
  // revalidate server-side.
  const isProtected = PROTECTED_PREFIXES.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );
  if (isProtected && !hasAuthSession(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url, 307);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) return response;

  const supabase = createServerClient(url, publicKey, {
    cookieOptions: { name: "barrioshop-auth-token" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() validates with GoTrue and refreshes the token when it expired.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Everything except static assets and images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
