import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isDemo } from "@/lib/mode";
import { demo, ME } from "@/lib/demo/store";

export const DEMO_COOKIE = "sc-demo";

export type SessionUser = { id: string; email: string; display_name: string };

/** The signed-in user, from Supabase or from the demo cookie. */
export async function currentUser(): Promise<SessionUser | null> {
  if (isDemo()) {
    const jar = await cookies();
    if (jar.get(DEMO_COOKIE)?.value !== "1") return null;
    const me = demo.me();
    return { id: ME, email: "demo@scicollab.test", display_name: me.display_name };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles").select("display_name").eq("id", user.id).maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    display_name: profile?.display_name || user.email || "Researcher",
  };
}
