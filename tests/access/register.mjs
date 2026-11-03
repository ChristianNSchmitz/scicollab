import { register } from "node:module";
register("./hooks.mjs", import.meta.url);
// Demo store, never a real backend, whatever the machine's environment says.
process.env.SCICOLLAB_DEMO = "1";
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) delete process.env[k];
