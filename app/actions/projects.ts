"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";


export async function createProject(form: FormData) {
  const { supabase, user } = await requireUser();
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
  const { supabase, user } = await requireUser();
  const body = String(form.get("body") ?? "").trim();
  if (!body) return;
  // The notebook belongs to the project's people; supabase/06 makes the
  // policy say the same, this gives the clear message.
  const { data: member } = await supabase
    .from("project_members").select("user_id")
    .eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
  if (!member) throw new Error("Only project members can write in this notebook.");
  const { error } = await supabase
    .from("eln_entries")
    .insert({ project_id: projectId, author_id: user.id, body, signed_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
}

/** Registers a dataset inside a project. It records what the data is and
 *  where it lives (a DOI or repository); files themselves are not uploaded. */
export async function depositDataset(projectId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(form.get("title") ?? "").trim();
  if (!title) return;
  // Only people on the project may add to it.
  const { data: member } = await supabase
    .from("project_members").select("user_id")
    .eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
  if (!member) throw new Error("Only project members can deposit data here.");
  const visibility = String(form.get("visibility") ?? "private");
  const { error } = await supabase.from("datasets").insert({
    owner_id: user.id,
    project_id: projectId,
    title,
    summary: String(form.get("summary") ?? "").trim(),
    doi: String(form.get("doi") ?? "").trim() || null,
    licence: String(form.get("licence") ?? "").trim() || "CC BY 4.0",
    visibility: ["private", "lab", "public"].includes(visibility) ? visibility : "private",
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/post");
  redirect(`/projects/${projectId}?tab=data`);
}

/**
 * Join a project that someone shared with one of your groups. The database
 * checks the same thing (supabase/09-feed-and-group-projects.sql); this
 * gives a sentence instead of an error.
 */
export async function joinProject(projectId: string) {
  const { supabase, user } = await requireUser();
  const { data: shares } = await supabase.from("group_projects").select("group_id").eq("project_id", projectId);
  const groupIds = (shares ?? []).map((s: { group_id: string }) => s.group_id);
  const { data: mine } = groupIds.length
    ? await supabase.from("group_members").select("group_id").eq("user_id", user.id).in("group_id", groupIds)
    : { data: [] };
  if (!mine?.length) throw new Error("You can join a project once it is shared with a group you are in.");
  const { data: already } = await supabase.from("project_members").select("user_id").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
  if (!already) {
    const { error } = await supabase.from("project_members").insert({ project_id: projectId, user_id: user.id, role: "contributor" });
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/groups", "layout");
}

/** Leave a project you joined. The owner stays: a project always has one. */
export async function leaveProject(projectId: string) {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from("projects").select("owner_id").eq("id", projectId).maybeSingle();
  if (p?.owner_id === user.id) throw new Error("The owner cannot leave their own project.");
  await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", user.id);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect("/projects");
}
