/**
 * Public runtime config. Both values are shipped to the browser by design —
 * the anon key is only useful in combination with the RLS policies in
 * `supabase/migrations`. The service role key is never read here; it belongs
 * to the import script only.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env.local for local dev, and set them in wrangler.jsonc `vars` for Cloudflare.",
  );
}

export const SUPABASE_URL: string = url;
export const SUPABASE_ANON_KEY: string = anonKey;
