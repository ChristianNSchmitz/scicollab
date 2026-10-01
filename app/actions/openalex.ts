"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncResearcher, MANUAL_COOLDOWN_MS } from "@/lib/openalex/sync";
import { readAuthor } from "@/lib/openalex/store";

/** "Sync now" on the You page. Rate-limited: OpenAlex's allowance is shared. */
export async function syncNow() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("orcid").eq("id", user.id).maybeSingle();

  const last = await readAuthor(user.id);
  if (last && last.orcid === profile?.orcid && Date.now() - +new Date(last.synced_at) < MANUAL_COOLDOWN_MS) {
    redirect("/you?sync=cooldown");
  }
  const result = await syncResearcher(user.id, profile?.orcid, "manual");
  revalidatePath("/you");
  redirect(`/you?sync=${result.status}`);
}
