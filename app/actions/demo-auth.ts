"use server";

import { cookies } from "next/headers";
import { authenticate, register, emailTaken } from "@/lib/demo/store";
import { DEMO_COOKIE, createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/mode";

/**
 * Sign-in and sign-up when no Supabase project is configured.
 *
 * The session is a plain cookie holding a store id. That is fine precisely
 * because there is nothing to protect: the store is seeded fixtures that
 * reset when the server restarts. These actions refuse to run when a real
 * project is configured, so this path can never shadow real authentication.
 */
type Res = { ok: true } | { ok: false; error: string };

function guard() {
  if (isConfigured()) throw new Error("demo auth is unavailable when Supabase is configured");
}

export async function demoSignIn(email: string, password: string): Promise<Res> {
  guard();
  const id = authenticate(email, password);
  if (!id) return {
    ok: false,
    error: "No demo account matches that email and password. The demo sign-ins are listed in the README (for example lena.hofbauer@scicollab.test / bouldering).",
  };
  (await cookies()).set(DEMO_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
  return { ok: true };
}

export async function demoSignUp(
  email: string, password: string, display_name: string, institution: string
): Promise<Res> {
  guard();
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (emailTaken(email)) return { ok: false, error: "That email already has a demo account. Sign in instead." };
  const id = register(email, password, display_name, institution);
  (await cookies()).set(DEMO_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
  return { ok: true };
}

export async function demoSignOut(): Promise<void> {
  (await cookies()).delete(DEMO_COOKIE);
}

/**
 * Sign out on the server, for either backend. Doing it here rather than
 * with the browser Supabase client keeps that library (about 67 KB
 * compressed) out of every signed-in page: the top bar was its only user.
 */
export async function signOut(): Promise<void> {
  if (!isConfigured()) { (await cookies()).delete(DEMO_COOKIE); return; }
  const supabase = await createClient();
  await supabase.auth.signOut();
}

/** Lets a client component decide which auth path to take. */
export async function backendConfigured(): Promise<boolean> {
  return isConfigured();
}
