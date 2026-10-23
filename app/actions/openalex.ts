"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncResearcher, MANUAL_COOLDOWN_MS, normaliseOrcid } from "@/lib/openalex/sync";
import { readAuthor } from "@/lib/openalex/store";

/** "Sync now" on the You page. Rate-limited: OpenAlex's allowance is shared. */
const RETURN_TO = ["/you", "/you/publications", "/home"];

/** `back` is where to return; forms that pass nothing hand over FormData. */
export async function syncNow(back?: unknown) {
  const to = typeof back === "string" && RETURN_TO.includes(back) ? back : "/you";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("orcid").eq("id", user.id).maybeSingle();

  const last = await readAuthor(user.id);
  if (last && last.orcid === normaliseOrcid(profile?.orcid) && Date.now() - +new Date(last.synced_at) < MANUAL_COOLDOWN_MS) {
    redirect(`${to}?sync=cooldown`);
  }
  const result = await syncResearcher(user.id, profile?.orcid, "manual");
  revalidatePath("/you");
  revalidatePath("/you/publications");
  revalidatePath("/home");
  redirect(`${to}?sync=${result.status}`);
}
