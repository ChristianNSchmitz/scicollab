import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user and a client acting as them, for server actions and
 * route handlers. Works the same with Supabase or the demo store.
 *
 * `requireUser` sends anyone signed out to /login; `sessionUser` returns
 * `user: null` instead, for callers such as the chat dock's polling that
 * should answer quietly rather than redirect.
 */
export async function sessionUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function requireUser() {
  const { supabase, user } = await sessionUser();
  if (!user) redirect("/login");
  return { supabase, user };
}
