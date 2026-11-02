"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { isConfigured } from "@/lib/mode";
import { roleIn, isCurrent, canManage } from "@/lib/social/groups";
import { parseRepoUrl, fetchRepo } from "@/lib/repos";

/** Linking GitHub and GitLab repositories to a project or a group (supabase/17). */

type Scope = "project" | "group";
const back = (scope: Scope, id: string, extra = "") =>
  scope === "project" ? `/projects/${id}?tab=code${extra}#repos` : `/groups/${id}?tab=shared${extra}#repos`;

async function mayUse(supabase: any, scope: Scope, id: string, userId: string) {
  if (scope === "group") return isCurrent(await roleIn(supabase, id, userId));
  const [{ data: p }, { data: m }] = await Promise.all([
    supabase.from("projects").select("owner_id").eq("id", id).maybeSingle(),
    supabase.from("project_members").select("user_id").eq("project_id", id).eq("user_id", userId).maybeSingle(),
  ]);
  return p?.owner_id === userId || !!m;
}

export async function linkRepo(scope: Scope, id: string, form: FormData) {
  const { supabase, user } = await requireUser();
  if (!isRowId(id) || !(await mayUse(supabase, scope, id, user.id))) throw new Error("Only members can link repositories.");
  const ref = parseRepoUrl(String(form.get("url") ?? ""));
  if (!ref) redirect(back(scope, id, "&repo=bad"));
  const col = scope === "project" ? "project_id" : "group_id";
  const { data: had } = await supabase.from("repo_links").select("id").eq(col, id).eq("host", ref.host).eq("path", ref.path).maybeSingle();
  if (had) redirect(back(scope, id, "&repo=had"));
  let cache = null, cached_at = null;
  if (isConfigured()) {
    try { cache = await fetchRepo(ref); cached_at = new Date().toISOString(); }
    catch (e) { redirect(back(scope, id, `&repo=${e instanceof Error && e.message.includes("not found") ? "missing" : "unreachable"}`)); }
  } else {
    // Demo: no outside calls; the card shows what the link says.
    cache = { name: ref.path, description: "", stars: 0, forks: 0, language: null, defaultBranch: "main", updatedAt: null, webUrl: ref.url, commits: [] };
    cached_at = new Date().toISOString();
  }
  await supabase.from("repo_links").insert({
    [col]: id, provider: ref.provider, host: ref.host, path: ref.path, url: ref.url, added_by: user.id, added_at: new Date().toISOString(), cache, cached_at,
  });
  revalidatePath(scope === "project" ? `/projects/${id}` : `/groups/${id}`);
  redirect(back(scope, id, "&repo=linked"));
}

export async function unlinkRepo(scope: Scope, id: string, linkId: string) {
  const { supabase, user } = await requireUser();
  const { data: l } = await supabase.from("repo_links").select("added_by").eq("id", linkId).maybeSingle();
  if (!l) return;
  let owner = false;
  if (scope === "group") owner = canManage(await roleIn(supabase, id, user.id));
  else owner = (await supabase.from("projects").select("owner_id").eq("id", id).maybeSingle()).data?.owner_id === user.id;
  if (l.added_by !== user.id && !owner) throw new Error("Only whoever linked it, or the owner, can remove it.");
  await supabase.from("repo_links").delete().eq("id", linkId);
  revalidatePath(scope === "project" ? `/projects/${id}` : `/groups/${id}`);
}

export async function refreshRepo(scope: Scope, id: string, linkId: string) {
  const { supabase, user } = await requireUser();
  if (!(await mayUse(supabase, scope, id, user.id)) || !isConfigured()) return;
  const { data: l } = await supabase.from("repo_links").select("*").eq("id", linkId).maybeSingle();
  if (!l) return;
  try {
    const cache = await fetchRepo(l);
    await supabase.from("repo_links").update({ cache, cached_at: new Date().toISOString() }).eq("id", linkId);
  } catch { /* keep the last snapshot */ }
  revalidatePath(scope === "project" ? `/projects/${id}` : `/groups/${id}`);
}
