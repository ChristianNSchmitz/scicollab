import { createBrowserClient } from "@supabase/ssr";

/**
 * True when real Supabase credentials are present. Local dev ships with a
 * placeholder URL, in which case auth can't hit a real backend and callers
 * should fall back to the local mock-db.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return !!url && !url.includes("placeholder");
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
