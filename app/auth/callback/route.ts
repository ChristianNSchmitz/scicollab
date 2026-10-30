import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE } from "@/lib/recovery";

/**
 * Where links from Supabase e-mails land (password reset, confirmation).
 * The one-time code becomes a session; a password-reset link also marks the
 * session as a recovery for ten minutes (app/actions/password.ts). Only a
 * path on this site is followed afterwards.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const raw = url.searchParams.get("next") ?? "/home";
  const next = raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/home";
  if (!code) return NextResponse.redirect(new URL("/login", url.origin));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/forgot-password?error=link", url.origin));

  if (next.startsWith("/settings?reset=1")) {
    (await cookies()).set(RECOVERY_COOKIE, data.user.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: url.protocol === "https:" });
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
