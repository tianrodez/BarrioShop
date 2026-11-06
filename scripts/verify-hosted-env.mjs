const urlValue = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let url;
try {
  url = new URL(urlValue ?? "");
} catch {
  url = null;
}

if (
  !url ||
  url.protocol !== "https:" ||
  !url.hostname.endsWith(".supabase.co") ||
  !publicKey
) {
  console.error(
    "BarrioShop requires a hosted Supabase HTTPS URL and public key. Use .env.hosted.local; local Supabase endpoints are unsupported.",
  );
  process.exit(2);
}
