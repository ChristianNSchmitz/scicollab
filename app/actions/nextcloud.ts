"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { roleIn, isCurrent, canManage } from "@/lib/social/groups";
import { parseShareUrl, hostAllowed, listShare } from "@/lib/nextcloud";

/** Linking Nextcloud folders to a group or a method card (supabase/19-nextcloud.sql). */

type Scope = "group" | "method";
const page = (scope: Scope, id: string) => (scope === "group" ? `/groups/${id}` : `/methods/${id}`);
const back = (scope: Scope, id: string, flash: string) =>
  scope === "group" ? `/groups/${id}?tab=shared&nc=${flash}#nextcloud` : `/methods/${id}?nc=${flash}#nextcloud`;
const col = (scope: Scope) => (scope === "group" ? "group_id" : "method_id");

async function mayUse(supabase: any, scope: Scope, id: string, userId: string) {
  if (scope === "group") return isCurrent(await roleIn(supabase, id, userId));
  const { data: c } = await supabase.from("method_cards").select("author_id").eq("id", id).maybeSingle();
  return c?.author_id === userId;
}

export async function linkNextcloud(scope: Scope, id: string, form: FormData) {
  const { supabase, user } = await requireUser();
  if (!isRowId(id) || !(await mayUse(supabase, scope, id, user.id))) throw new Error(scope === "group" ? "Only members can link folders." : "Only the card's author can link folders.");
  const ref = parseShareUrl(String(form.get("url") ?? ""));
  if (!ref) redirect(back(scope, id, "bad"));
  if (!hostAllowed(ref.host)) redirect(back(scope, id, "host"));
  const password = String(form.get("password") ?? "").slice(0, 200);
  const label = String(form.get("label") ?? "").trim().slice(0, 120);
  const { data: had } = await supabase.from("nextcloud_links").select("id").eq(col(scope), id).eq("origin", ref.origin).eq("token", ref.token).maybeSingle();
  if (had) redirect(back(scope, id, "had"));

  // Read it once now: a wrong link or password is said right away, not later.
  let cache = null, cached_at = null;
  try { cache = await listShare(ref, password || null); cached_at = new Date().toISOString(); }
  catch (e) {
    const m = e instanceof Error ? e.message : "";
    redirect(back(scope, id, m.includes("password") ? (password ? "password" : "needs-password") : m.includes("not found") ? "missing" : m.includes("not allowed") ? "host" : "unreachable"));
  }
  const { data: link, error } = await supabase.from("nextcloud_links").insert({
    [col(scope)]: id, origin: ref.origin, host: ref.host, token: ref.token, url: ref.url, label,
    has_password: !!password, added_by: user.id, added_at: new Date().toISOString(), cache, cached_at,
  }).select("id").single();
  if (error || !link) redirect(back(scope, id, "unreachable"));
  if (password) await supabase.from("nextcloud_secrets").insert({ link_id: link.id, password });
  revalidatePath(page(scope, id));
  redirect(back(scope, id, "linked"));
}

export async function unlinkNextcloud(scope: Scope, id: string, linkId: string) {
  const { supabase, user } = await requireUser();
  const { data: l } = await supabase.from("nextcloud_links").select("added_by").eq("id", linkId).eq(col(scope), id).maybeSingle();
  if (!l) return;
  const owner = scope === "group" ? canManage(await roleIn(supabase, id, user.id)) : await mayUse(supabase, scope, id, user.id);
  if (l.added_by !== user.id && !owner) throw new Error("Only whoever linked it, or the owner, can remove it.");
  await supabase.from("nextcloud_secrets").delete().eq("link_id", linkId);
  await supabase.from("nextcloud_links").delete().eq("id", linkId);
  revalidatePath(page(scope, id));
}

export async function refreshNextcloud(scope: Scope, id: string, linkId: string) {
  const { supabase, user } = await requireUser();
  if (!(await mayUse(supabase, scope, id, user.id))) return;
  const { data: l } = await supabase.from("nextcloud_links").select("id, origin, host, token, url, has_password").eq("id", linkId).eq(col(scope), id).maybeSingle();
  if (!l) return;
  const { data: s } = l.has_password ? await supabase.from("nextcloud_secrets").select("password").eq("link_id", linkId).maybeSingle() : { data: null };
  try {
    const cache = await listShare(l, s?.password ?? null);
    await supabase.from("nextcloud_links").update({ cache, cached_at: new Date().toISOString() }).eq("id", linkId);
  } catch {
    redirect(back(scope, id, "unreachable"));
  }
  revalidatePath(page(scope, id));
}
