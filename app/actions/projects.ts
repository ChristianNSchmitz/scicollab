"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { PROJECT_STATUSES, PROJECT_ROLES } from "@/lib/projects";
import { planLinks, canEditLinks } from "@/lib/data-links";


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
    ? await supabase.from("group_members").select("group_id").eq("user_id", user.id).neq("role", "alumni").in("group_id", groupIds)
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

/** The owner adds a person to the project. */
export async function addProjectMember(projectId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from("projects").select("owner_id").eq("id", projectId).maybeSingle();
  if (p?.owner_id !== user.id) throw new Error("Only the owner can add people.");
  const personId = String(form.get("person") ?? "");
  const { data: person } = await supabase.from("profiles").select("id").eq("id", personId).maybeSingle();
  if (!person) redirect(`/projects/${projectId}?error=person`);
  const { data: already } = await supabase.from("project_members").select("user_id").eq("project_id", projectId).eq("user_id", personId).maybeSingle();
  if (!already) await supabase.from("project_members").insert({ project_id: projectId, user_id: personId, role: "contributor" });
  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectMember(projectId: string, personId: string) {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from("projects").select("owner_id").eq("id", projectId).maybeSingle();
  if (p?.owner_id !== user.id || personId === user.id) throw new Error("Only the owner can remove people, and not themselves.");
  await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", personId);
  revalidatePath(`/projects/${projectId}`);
}

// ── project workspace (supabase/16) ──────────────────────────────────────


async function projectRole(supabase: any, projectId: string, userId: string) {
  const [{ data: p }, { data: m }] = await Promise.all([
    supabase.from("projects").select("owner_id").eq("id", projectId).maybeSingle(),
    supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
  ]);
  return { owner: p?.owner_id === userId, member: p?.owner_id === userId || !!m };
}

/** The owner edits the title, summary, aims, status and who can see the project. */
export async function updateProject(projectId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const { owner } = await projectRole(supabase, projectId, user.id);
  if (!owner) throw new Error("Only the owner can change the project.");
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  if (!title) redirect(`/projects/${projectId}?tab=overview&error=title#settings`);
  const status = String(form.get("status") ?? "active");
  const visibility = String(form.get("visibility") ?? "lab");
  await supabase.from("projects").update({
    title,
    summary: String(form.get("summary") ?? "").trim().slice(0, 1000),
    aims: String(form.get("aims") ?? "").trim().slice(0, 3000),
    status: PROJECT_STATUSES.includes(status) ? status : "active",
    visibility: ["private", "lab", "public"].includes(visibility) ? visibility : "lab",
    tags: String(form.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12),
    updated_at: new Date().toISOString(),
  }).eq("id", projectId).eq("owner_id", user.id);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect(`/projects/${projectId}?tab=overview&saved=1`);
}

export async function setProjectRole(projectId: string, personId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const { owner } = await projectRole(supabase, projectId, user.id);
  if (!owner || personId === user.id) throw new Error("Only the owner changes roles, and not their own.");
  const role = String(form.get("role") ?? "");
  if (!PROJECT_ROLES.includes(role)) return;
  await supabase.from("project_members").update({ role }).eq("project_id", projectId).eq("user_id", personId);
  revalidatePath(`/projects/${projectId}`);
}

/** A member links one of their own method cards; everyone on the project can then read it. */
export async function linkProjectMethod(projectId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const { member } = await projectRole(supabase, projectId, user.id);
  const cardId = String(form.get("card") ?? "");
  const { data: card } = isRowId(cardId) ? await supabase.from("method_cards").select("id").eq("id", cardId).eq("author_id", user.id).maybeSingle() : { data: null };
  if (!member || !card) throw new Error("Only members link their own method cards.");
  const { data: had } = await supabase.from("project_methods").select("card_id").eq("project_id", projectId).eq("card_id", cardId).maybeSingle();
  if (!had) await supabase.from("project_methods").insert({ project_id: projectId, card_id: cardId, added_by: user.id, added_at: new Date().toISOString() });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/methods/${cardId}`);
}

export async function unlinkProjectMethod(projectId: string, cardId: string) {
  const { supabase, user } = await requireUser();
  const { owner } = await projectRole(supabase, projectId, user.id);
  const { data: row } = await supabase.from("project_methods").select("added_by").eq("project_id", projectId).eq("card_id", cardId).maybeSingle();
  if (!row) return;
  if (row.added_by !== user.id && !owner) throw new Error("Only whoever linked it, or the owner, can unlink it.");
  await supabase.from("project_methods").delete().eq("project_id", projectId).eq("card_id", cardId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/methods/${cardId}`);
}

export async function addMilestone(projectId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const { member } = await projectRole(supabase, projectId, user.id);
  if (!member) throw new Error("Only members add milestones.");
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  if (!title) return;
  const due = String(form.get("due") ?? "");
  await supabase.from("project_milestones").insert({
    project_id: projectId, title, created_by: user.id, due_on: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null, done_at: null, done_by: null,
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function toggleMilestone(projectId: string, milestoneId: string, done: boolean) {
  const { supabase, user } = await requireUser();
  const { member } = await projectRole(supabase, projectId, user.id);
  if (!member) throw new Error("Only members tick off milestones.");
  await supabase.from("project_milestones").update(done ? { done_at: new Date().toISOString(), done_by: user.id } : { done_at: null, done_by: null })
    .eq("id", milestoneId).eq("project_id", projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteMilestone(projectId: string, milestoneId: string) {
  const { supabase, user } = await requireUser();
  const { owner } = await projectRole(supabase, projectId, user.id);
  const { data: m } = await supabase.from("project_milestones").select("created_by").eq("id", milestoneId).eq("project_id", projectId).maybeSingle();
  if (!m) return;
  if (m.created_by !== user.id && !owner) throw new Error("Only whoever added it, or the owner, can delete it.");
  await supabase.from("project_milestones").delete().eq("id", milestoneId);
  revalidatePath(`/projects/${projectId}`);
}

/**
 * Which code files and notebook entries a dataset is linked to (supabase/22).
 * Optional, and replaced as a whole from the form: what is ticked is linked,
 * what is not ticked is not. Only the dataset's owner or the project's owner
 * may do it, and only for things in this same project. The database policy
 * says the same; this gives the clear message, and holds in the demo store,
 * which has no policies.
 */
export async function setDatasetLinks(projectId: string, datasetId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  if (!isRowId(projectId) || !isRowId(datasetId)) throw new Error("That dataset was not found.");

  const [{ data: project }, { data: dataset }, { data: member }] = await Promise.all([
    supabase.from("projects").select("id, owner_id").eq("id", projectId).maybeSingle(),
    supabase.from("datasets").select("id, owner_id, project_id").eq("id", datasetId).maybeSingle(),
    supabase.from("project_members").select("user_id").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!project || !dataset || dataset.project_id !== projectId) throw new Error("That dataset is not in this project.");
  const onProject = !!member || project.owner_id === user.id;
  if (!onProject) throw new Error("Only people on this project can link its data.");
  if (!canEditLinks({ userId: user.id, projectOwnerId: project.owner_id, datasetOwnerId: dataset.owner_id, onProject })) {
    throw new Error("Only the dataset's owner or the project's owner can change its links.");
  }

  const [{ data: files }, { data: entries }, { data: current }] = await Promise.all([
    supabase.from("code_files").select("id").eq("project_id", projectId),
    supabase.from("eln_entries").select("id").eq("project_id", projectId),
    supabase.from("dataset_links").select("code_file_id, entry_id").eq("dataset_id", datasetId),
  ]);
  const ids = (rows: any[] | null, col: string) => new Set((rows ?? []).map((r) => r[col]).filter(Boolean) as string[]);
  const ticked = (name: string) => new Set(form.getAll(name).map(String).filter(isRowId));

  const code = planLinks(ids(current, "code_file_id"), ticked("code"), ids(files, "id"));
  const notes = planLinks(ids(current, "entry_id"), ticked("entry"), ids(entries, "id"));

  const add = [
    ...code.add.map((id) => ({ project_id: projectId, dataset_id: datasetId, code_file_id: id, created_by: user.id })),
    ...notes.add.map((id) => ({ project_id: projectId, dataset_id: datasetId, entry_id: id, created_by: user.id })),
  ];
  if (add.length) {
    const { error } = await supabase.from("dataset_links").insert(add);
    if (error) throw new Error(error.message);
  }
  if (code.remove.length) await supabase.from("dataset_links").delete().eq("dataset_id", datasetId).in("code_file_id", code.remove);
  if (notes.remove.length) await supabase.from("dataset_links").delete().eq("dataset_id", datasetId).in("entry_id", notes.remove);

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?tab=data&linked=1#data-${datasetId}`);
}
