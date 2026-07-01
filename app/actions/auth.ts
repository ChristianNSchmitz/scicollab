"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ─── Standing demo account ────────────────────────────────────────────────
// This user must always exist so the platform can be accessed for demos
// and reviews without registering.
const DEMO_EMAIL = "b00834203@essec.edu";
const DEMO_PASSWORD = "Admin@123";

export async function ensureDemoUser(): Promise<void> {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Admin path: creates the user pre-confirmed (no verification email)
      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      // "already registered" errors are expected on every run after the first
      if (data?.user) {
        await admin.from("profiles").upsert({
          id: data.user.id,
          full_name: "ESSEC Demo User",
          institution: "ESSEC Business School",
          orcid_id: null,
          role: "Researcher",
          research_domain: "Management Science",
          techniques: [],
        });
      } else if (error && !/already/i.test(error.message)) {
        console.error("ensureDemoUser:", error.message);
      }
    } else {
      // Anon fallback (local dev without service key)
      const supabase = await createClient();
      await supabase.auth.signUp({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    }
  } catch (e) {
    console.error("ensureDemoUser failed:", e);
  }
}

export async function saveProfileToDb(profile: {
  id: string;
  full_name: string;
  institution: string;
  orcid_id: string | null;
  role: string;
  research_domain: string;
  techniques: string[];
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").upsert(profile);
  if (error) throw new Error(error.message);
}
