/** True when a real Supabase project is configured. Everything that depends
 *  on a backend checks this first, so a missing or misconfigured environment
 *  degrades instead of throwing. */
export function isConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return Boolean(url) && !url.includes("placeholder") && Boolean(key);
}

/** Demo mode runs off seeded data with no backend. */
export function isDemo(): boolean {
  if (process.env.SCICOLLAB_DEMO === "1") return true;
  return !isConfigured();
}
