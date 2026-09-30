import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isConfigured } from "@/lib/mode";
import { createDemoClient } from "@/lib/demo/shim";

export const DEMO_COOKIE = "sc-demo";

/**
 * The server-side client.
 *
 * With no Supabase project configured it returns a store-backed stand-in with
 * the same shape, so every page and server action works unchanged and the app
 * can be cloned and run without credentials.
 */
// Untyped schema: rows come back as `any`, which is what every page here
// expects. Deriving this with ReturnType<> instead resolves the row generic
// to `never` and breaks inference at the call sites.
type Client = SupabaseClient<any, "public", any>;

export async function createClient(): Promise<Client> {
  const store = await cookies();

  // The shim mirrors the query surface this codebase uses, not all of
  // PostgREST, so it is asserted into the real client's type rather than
  // pretending to implement it.
  if (!isConfigured()) {
    return createDemoClient(store.get(DEMO_COOKIE)?.value ?? null) as unknown as Client;
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {}
        },
      },
    }
  ) as Client;
}
