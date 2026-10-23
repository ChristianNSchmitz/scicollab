/**
 * True when the app should run against a real Supabase project: the URL and
 * anon key are set, and SCICOLLAB_DEMO=1 is not forcing the seeded in-memory
 * store. Everything that depends on a backend checks this first, so a missing
 * or misconfigured environment degrades to demo mode instead of throwing.
 */
export function isConfigured(): boolean {
  if (process.env.SCICOLLAB_DEMO === "1") return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return Boolean(url) && !url.includes("placeholder") && Boolean(key);
}
