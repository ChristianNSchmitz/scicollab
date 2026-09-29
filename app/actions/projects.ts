"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createProject(form: FormData) {
  const { supabase, user } = await me();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      title: String(form.get("title") ?? "").trim(),
      summary: String(form.get("summary") ?? "").trim(),
      tags: String(form.get("tags") ?? "").split(",").map(t => t.trim()).filter(Boolean),
      visibility: String(form.get("visibility") ?? "lab"),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("project_members").insert({ project_id: data.id, user_id: user.id, role: "owner" });
  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

/** Notebook entries are append-only — the board makes that visible rather than
 *  implying it, so there is no update path here on purpose. */
export async function addEntry(projectId: string, form: FormData) {
  const { supabase, user } = await me();
  const body = String(form.get("body") ?? "").trim();
  if (!body) return;
  const { error } = await supabase
    .from("eln_entries")
    .insert({ project_id: projectId, author_id: user.id, body, signed_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
}
