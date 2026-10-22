"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAuthor, searchAuthors, OpenAlexError, type OAAuthor } from "@/lib/openalex/client";
import { syncResearcher, DEMO_ORCID } from "@/lib/openalex/sync";
import { clearSync } from "@/lib/openalex/store";
import { normaliseOrcid, orcidProblem } from "@/lib/orcid";
import { isConfigured } from "@/lib/mode";

/**
 * Linking an ORCID is one step: check the iD, look it up in OpenAlex so the
 * researcher can see whose record it is, save it, and start the first sync
 * straight away rather than waiting for the next scheduled pass.
 */

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export type OrcidPreview = {
  orcid: string; name: string; institution: string;
  works: number; citations: number; hIndex: number; openalexId: string;
};
export type LookupResult =
  | { ok: true; preview: OrcidPreview }
  | { ok: false; error: string; orcid?: string };

const preview = (a: OAAuthor, orcid: string): OrcidPreview => ({
  orcid, name: a.display_name, institution: a.institution,
  works: a.works_count, citations: a.cited_by_count, hIndex: a.h_index, openalexId: a.id,
});

function explain(e: unknown): string {
  if (e instanceof OpenAlexError) {
    if (e.kind === "not-found") return "OpenAlex has no author for this ORCID yet. You can still link it; publications appear once OpenAlex lists them.";
    if (e.kind === "rate-limited") return "OpenAlex is rate limiting right now. You can link the iD anyway; the sync retries later.";
    return "OpenAlex could not be reached. You can link the iD anyway; the sync retries later.";
  }
  return "The lookup failed.";
}

/** "Check" — whose record is this? Nothing is saved. */
export async function lookupOrcid(raw: string): Promise<LookupResult> {
  await me();
  const problem = orcidProblem(raw);
  const orcid = normaliseOrcid(raw);
  if (!orcid) return { ok: false, error: problem ?? "Enter an ORCID iD." };
  // Demo mode only: the demo persona carries ORCID's test record and example numbers.
  if (!isConfigured() && orcid === DEMO_ORCID) {
    return { ok: true, preview: { orcid, name: "Josiah Carberry (ORCID's public test record)", institution: "Brown University", works: 34, citations: 412, hIndex: 11, openalexId: "" } };
  }
  try {
    return { ok: true, preview: preview(await fetchAuthor(orcid), orcid) };
  } catch (e) {
    return { ok: false, error: explain(e), orcid };
  }
}

/** "Find my ORCID" — authors with an ORCID whose name matches. */
export async function findOrcid(name: string): Promise<{ ok: true; results: OrcidPreview[] } | { ok: false; error: string }> {
  await me();
  const q = name.trim();
  if (q.length < 3) return { ok: false, error: "Type at least three letters of your name." };
  try {
    const found = await searchAuthors(q);
    return { ok: true, results: found.filter((a) => a.orcid).map((a) => preview(a, a.orcid!)) };
  } catch (e) {
    return { ok: false, error: explain(e) };
  }
}

export async function linkOrcid(form: FormData) {
  const { supabase, user } = await me();
  const orcid = normaliseOrcid(String(form.get("orcid") ?? ""));
  if (!orcid) redirect("/settings?orcid=invalid#orcid");

  const { data: current } = await supabase.from("profiles").select("orcid").eq("id", user.id).maybeSingle();
  const { error } = await supabase.from("profiles").update({ orcid }).eq("id", user.id);
  if (error) throw new Error(error.message);

  // First sync right away. It runs after the response so the redirect is not
  // held up by OpenAlex; the You page shows "fetching" until it lands.
  if (normaliseOrcid(current?.orcid) !== orcid) {
    after(() => syncResearcher(user.id, orcid, "manual"));
  }
  revalidatePath("/", "layout");
  redirect("/settings?orcid=linked#orcid");
}

export async function unlinkOrcid() {
  const { supabase, user } = await me();
  const { error } = await supabase.from("profiles").update({ orcid: null }).eq("id", user.id);
  if (error) throw new Error(error.message);
  await clearSync(user.id);
  revalidatePath("/", "layout");
  redirect("/settings?orcid=unlinked#orcid");
}
