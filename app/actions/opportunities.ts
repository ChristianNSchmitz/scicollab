"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { overLimit } from "@/lib/ratelimit";
import { ROOMS } from "@/lib/taxonomy";

/** Jobs and funding calls (supabase/21-researcher.sql, opportunities). */

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const list = (s: string, max: number) => [...new Set(s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean))].slice(0, max).map((x) => x.slice(0, 60));

export async function postOpportunity(form: FormData) {
  const { supabase, user } = await requireUser();
  const kind = form.get("kind") === "funding" ? "funding" : "job";
  const back = `/jobs?kind=${kind}`;
  const title = text(form, "title", 200);
  const url = text(form, "url", 500);
  const deadline = text(form, "deadline", 10);
  if (title.length < 3) redirect(`${back}&error=title#post`);
  if (url && !/^https?:\/\/[^\s]+$/.test(url)) redirect(`${back}&error=url#post`);
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) redirect(`${back}&error=deadline#post`);
  if (await overLimit(supabase, "opportunity", user.id)) redirect(`${back}&error=limit#post`);
  const topics = form.getAll("topics").map(String).filter((t) => ROOMS.some((r) => r.id === t)).slice(0, 6);
  const { data, error } = await supabase.from("opportunities").insert({
    kind, title, org: text(form, "org", 200), place: text(form, "place", 120), level: text(form, "level", 60), url,
    deadline: deadline || null, topics, techniques: list(text(form, "techniques", 600), 10), body: text(form, "body", 6000),
    posted_by: user.id, status: "open", created_at: new Date().toISOString(),
  }).select("id").single();
  if (error || !data) redirect(`${back}&error=save#post`);
  revalidatePath("/jobs");
  redirect(`${back}&posted=1#o-${data.id}`);
}

async function own(supabase: any, id: string, userId: string) {
  if (!isRowId(id)) return false;
  const { data } = await supabase.from("opportunities").select("posted_by").eq("id", id).maybeSingle();
  return data?.posted_by === userId;
}

export async function setOpportunityStatus(id: string, status: "open" | "closed") {
  const { supabase, user } = await requireUser();
  if (!(await own(supabase, id, user.id))) throw new Error("Only whoever posted it can change it.");
  await supabase.from("opportunities").update({ status }).eq("id", id);
  revalidatePath("/jobs");
}

export async function deleteOpportunity(id: string) {
  const { supabase, user } = await requireUser();
  if (!(await own(supabase, id, user.id))) throw new Error("Only whoever posted it can delete it.");
  await supabase.from("opportunity_saves").delete().eq("opportunity_id", id);
  await supabase.from("opportunities").delete().eq("id", id);
  revalidatePath("/jobs");
}

export async function saveOpportunity(id: string, on: boolean) {
  const { supabase, user } = await requireUser();
  if (!isRowId(id)) return;
  const { data: o } = await supabase.from("opportunities").select("id").eq("id", id).maybeSingle();
  if (!o) return;
  await supabase.from("opportunity_saves").delete().eq("opportunity_id", id).eq("user_id", user.id);
  if (on) await supabase.from("opportunity_saves").insert({ opportunity_id: id, user_id: user.id, created_at: new Date().toISOString() });
  revalidatePath("/jobs");
}
