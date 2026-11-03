"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { CV_KINDS, validMonth, type CvKind } from "@/lib/cv";

/** Your CV (supabase/21-researcher.sql): entries, a research profile, the papers chosen for it. */

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const back = (extra = "") => `/you/cv${extra}`;

function fields(form: FormData) {
  const kind = String(form.get("kind") ?? "") as CvKind;
  const title = text(form, "title", 300);
  const start_on = text(form, "start_on", 7), end_on = text(form, "end_on", 7);
  if (!CV_KINDS.includes(kind) || !title) return { error: "title" as const };
  if (!validMonth(start_on) || !validMonth(end_on) || (start_on && end_on && end_on < start_on)) return { error: "dates" as const };
  return { kind, title, org: text(form, "org", 300), place: text(form, "place", 120), start_on, end_on, detail: text(form, "detail", 2000) };
}

export async function addCvEntry(form: FormData) {
  const { supabase, user } = await requireUser();
  const f = fields(form);
  if ("error" in f) redirect(back(`?error=${f.error}#add`));
  await supabase.from("cv_entries").insert({ ...f, user_id: user.id, created_at: new Date().toISOString() });
  revalidatePath("/you/cv");
  redirect(back(`?saved=1#${f.kind}`));
}

export async function updateCvEntry(id: string, form: FormData) {
  const { supabase, user } = await requireUser();
  if (!isRowId(id)) return;
  const f = fields(form);
  if ("error" in f) redirect(back(`?error=${f.error}#e-${id}`));
  await supabase.from("cv_entries").update(f).eq("id", id).eq("user_id", user.id);
  revalidatePath("/you/cv");
  redirect(back(`?saved=1#${f.kind}`));
}

export async function deleteCvEntry(id: string) {
  const { supabase, user } = await requireUser();
  if (!isRowId(id)) return;
  await supabase.from("cv_entries").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/you/cv");
}

/** The research profile on top, and up to ten papers for the CV. */
export async function saveCvProfile(form: FormData) {
  const { supabase, user } = await requireUser();
  const papers = form.getAll("papers").map(String).filter((x) => /^W[\w-]{1,30}$/.test(x)).slice(0, 10);
  await supabase.from("profiles").update({ cv_summary: text(form, "summary", 3000), cv_papers: papers }).eq("id", user.id);
  revalidatePath("/you/cv");
  redirect(back("?saved=profile#profile"));
}
