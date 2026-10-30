"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isConfigured } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/session";
import { changeDemoPassword } from "@/lib/demo/store";
import { RECOVERY_COOKIE } from "@/lib/recovery";

/**
 * Forgotten and changed passwords.
 *
 * The reset request always answers the same way, whether or not the address
 * has an account, so the form cannot be used to find out who is a member.
 * The e-mail link comes back through /auth/callback, which marks the session
 * as a recovery for ten minutes: during that window Settings lets you set a
 * new password without the old one.
 */

async function origin() {
  const h = await headers();
  return process.env.SCICOLLAB_SITE_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

export async function requestPasswordReset(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/forgot-password?error=email");
  if (!isConfigured()) redirect("/forgot-password?sent=demo");
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent("/settings?reset=1#password")}`,
  });
  redirect("/forgot-password?sent=1");
}

export async function changePassword(form: FormData) {
  const { supabase, user } = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  const again = String(form.get("confirm") ?? "");
  const jar = await cookies();
  const recovering = jar.get(RECOVERY_COOKIE)?.value === user.id;

  if (next.length < 8) redirect("/settings?error=pwshort#password");
  if (next !== again) redirect("/settings?error=pwmatch#password");

  if (!isConfigured()) {
    if (!changeDemoPassword(user.id, current, next)) redirect("/settings?error=pwcurrent#password");
    redirect("/settings?saved=password#password");
  }

  // Outside a reset link, the current password has to be right.
  if (!recovering) {
    const { error } = await supabase.auth.signInWithPassword({ email: user.email!, password: current });
    if (error) redirect("/settings?error=pwcurrent#password");
  }
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) redirect("/settings?error=pwfail#password");
  jar.delete(RECOVERY_COOKIE);
  redirect("/settings?saved=password#password");
}
