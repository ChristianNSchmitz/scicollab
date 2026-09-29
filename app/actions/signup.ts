"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Invite-gated account creation.
 *
 * The browser cannot be trusted with this. If the page called
 * supabase.auth.signUp() directly, anyone holding the anon key — which ships
 * in the bundle by design — could create an account straight against the auth
 * endpoint and skip whatever the form checked. So the code is verified here
 * and the user is created with the service role.
 *
 * Closing the app-level path is only half of it: public sign-up must also be
 * turned off in the Supabase dashboard, or the REST endpoint stays open.
 */
export type SignupResult = { ok: true } | { ok: false; error: string };

export async function createAccount(form: FormData): Promise<SignupResult> {
  const required = process.env.SCICOLLAB_INVITE_CODE ?? "";
  const offered = String(form.get("invite") ?? "").trim();

  if (required && offered !== required) {
    return { ok: false, error: "That invite code is not valid. This build is invite-only." };
  }

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const display_name = String(form.get("display_name") ?? "").trim();
  const institution = String(form.get("institution") ?? "").trim();

  if (!email || !password) return { ok: false, error: "Email and password are required." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { display_name, institution },
  });

  if (error) {
    return {
      ok: false,
      error: /already|registered|exists/i.test(error.message)
        ? "That email already has an account. Sign in instead."
        : error.message,
    };
  }

  // The trigger creates the profile row; fill in what the form collected.
  if (data.user) {
    await admin.from("profiles").update({ display_name, institution }).eq("id", data.user.id);
  }
  return { ok: true };
}
