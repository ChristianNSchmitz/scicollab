import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/mode";
import { createDemoClient } from "@/lib/demo/shim";
import { ME } from "@/lib/demo/store";

/**
 * Service-role client. Server-side only — it bypasses row-level security.
 * Falls back to the demo store so invite-gated sign-up works without a backend.
 */
type Client = SupabaseClient<any, "public", any>;

export function createAdminClient(): Client {
  if (!isConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createDemoClient(ME) as unknown as Client;
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  ) as Client;
}
