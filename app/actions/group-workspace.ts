"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { isConfigured } from "@/lib/mode";
import { roleIn, canManage, isCurrent } from "@/lib/social/groups";
import { FILE_BUCKET, MAX_FILE_BYTES, allowedFile } from "@/lib/social/group-files";

/**
 * The group as a workspace: chat, notice board, tasks, shared data and
 * files (supabase/13-group-workspace.sql). All of it is for the group's
 * current members; the database enforces the same rules, these checks give
 * a sentence instead of an error.
 */

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const tab = (groupId: string, name: string, extra = "") => `/groups/${groupId}?tab=${name}${extra}`;

async function memberOrThrow(supabase: any, groupId: string, userId: string) {
  const role = await roleIn(supabase, groupId, userId);
  if (!isCurrent(role)) throw new Error("Only members of the group can do this.");
  return role;
}

// ── chat ───────────────────────────────────────────────────────────────────

export async function sendGroupMessage(groupId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  await memberOrThrow(supabase, groupId, user.id);
  const body = text(form, "body", 4000);
  if (body) await supabase.from("group_messages").insert({ group_id: groupId, author_id: user.id, body });
  revalidatePath(`/groups/${groupId}`);
  redirect(tab(groupId, "chat", "#latest"));
}

export async function deleteGroupMessage(groupId: string, messageId: string) {
  const { supabase, user } = await requireUser();
  const { data: m } = await supabase.from("group_messages").select("author_id").eq("id", messageId).eq("group_id", groupId).maybeSingle();
  if (!m) return;
  if (m.author_id !== user.id && !canManage(await roleIn(supabase, groupId, user.id))) throw new Error("Only the author or an admin can delete a message.");
  await supabase.from("group_messages").delete().eq("id", messageId);
  revalidatePath(`/groups/${groupId}`);
}

// ── notice board ───────────────────────────────────────────────────────────

export async function addNote(groupId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const role = await memberOrThrow(supabase, groupId, user.id);
  const title = text(form, "title", 200);
  if (!title) redirect(tab(groupId, "board", "&error=note"));
  const pinned = form.get("pinned") === "on" && canManage(role);
  const now = new Date().toISOString();
  await supabase.from("group_notes").insert({ group_id: groupId, author_id: user.id, title, body: text(form, "body", 8000), pinned, created_at: now, updated_at: now });
  revalidatePath(`/groups/${groupId}`);
  redirect(tab(groupId, "board"));
}

export async function editNote(groupId: string, noteId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const role = await roleIn(supabase, groupId, user.id);
  const { data: n } = await supabase.from("group_notes").select("author_id").eq("id", noteId).eq("group_id", groupId).maybeSingle();
  if (!n) return;
  if (!((n.author_id === user.id && isCurrent(role)) || canManage(role))) throw new Error("Only the author or an admin can edit this note.");
  const title = text(form, "title", 200);
  if (!title) redirect(tab(groupId, "board", "&error=note"));
  await supabase.from("group_notes").update({ title, body: text(form, "body", 8000), updated_at: new Date().toISOString() }).eq("id", noteId);
  revalidatePath(`/groups/${groupId}`);
  redirect(tab(groupId, "board", `#note-${noteId}`));
}

export async function pinNote(groupId: string, noteId: string, pinned: boolean) {
  const { supabase, user } = await requireUser();
  if (!canManage(await roleIn(supabase, groupId, user.id))) throw new Error("Only the lead and admins pin notes.");
  await supabase.from("group_notes").update({ pinned }).eq("id", noteId).eq("group_id", groupId);
  revalidatePath(`/groups/${groupId}`);
}

export async function deleteNote(groupId: string, noteId: string) {
  const { supabase, user } = await requireUser();
  const { data: n } = await supabase.from("group_notes").select("author_id").eq("id", noteId).eq("group_id", groupId).maybeSingle();
  if (!n) return;
  if (n.author_id !== user.id && !canManage(await roleIn(supabase, groupId, user.id))) throw new Error("Only the author or an admin can delete this note.");
  await supabase.from("group_notes").delete().eq("id", noteId);
  revalidatePath(`/groups/${groupId}`);
}

// ── tasks ──────────────────────────────────────────────────────────────────

export async function addTask(groupId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  await memberOrThrow(supabase, groupId, user.id);
  const title = text(form, "title", 300);
  if (!title) redirect(tab(groupId, "tasks", "&error=task"));
  const assignee = text(form, "assignee", 64);
  const due = text(form, "due", 10);
  // Only a current member can be given a task.
  const assigneeOk = assignee && isCurrent(await roleIn(supabase, groupId, assignee));
  await supabase.from("group_tasks").insert({
    group_id: groupId, title, created_by: user.id,
    assignee_id: assigneeOk ? assignee : null,
    due_on: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
  });
  revalidatePath(`/groups/${groupId}`);
  redirect(tab(groupId, "tasks"));
}

export async function toggleTask(groupId: string, taskId: string, done: boolean) {
  const { supabase, user } = await requireUser();
  await memberOrThrow(supabase, groupId, user.id);
  await supabase.from("group_tasks")
    .update(done ? { done_at: new Date().toISOString(), done_by: user.id } : { done_at: null, done_by: null })
    .eq("id", taskId).eq("group_id", groupId);
  revalidatePath(`/groups/${groupId}`);
}

export async function takeTask(groupId: string, taskId: string) {
  const { supabase, user } = await requireUser();
  await memberOrThrow(supabase, groupId, user.id);
  await supabase.from("group_tasks").update({ assignee_id: user.id }).eq("id", taskId).eq("group_id", groupId);
  revalidatePath(`/groups/${groupId}`);
}

export async function deleteTask(groupId: string, taskId: string) {
  const { supabase, user } = await requireUser();
  const { data: t } = await supabase.from("group_tasks").select("created_by").eq("id", taskId).eq("group_id", groupId).maybeSingle();
  if (!t) return;
  if (t.created_by !== user.id && !canManage(await roleIn(supabase, groupId, user.id))) throw new Error("Only whoever added the task, or an admin, can delete it.");
  await supabase.from("group_tasks").delete().eq("id", taskId);
  revalidatePath(`/groups/${groupId}`);
}

// ── shared data ────────────────────────────────────────────────────────────

/** A member links one of their own datasets; members can then read it, also when it is private. */
export async function linkDataset(groupId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  await memberOrThrow(supabase, groupId, user.id);
  const datasetId = String(form.get("dataset") ?? "");
  const { data: ds } = isRowId(datasetId)
    ? await supabase.from("datasets").select("id").eq("id", datasetId).eq("owner_id", user.id).maybeSingle()
    : { data: null };
  if (!ds) throw new Error("You can only link your own datasets.");
  const { data: already } = await supabase.from("group_datasets").select("dataset_id").eq("group_id", groupId).eq("dataset_id", datasetId).maybeSingle();
  if (!already) await supabase.from("group_datasets").insert({ group_id: groupId, dataset_id: datasetId, added_by: user.id });
  revalidatePath(`/groups/${groupId}`);
}

export async function unlinkDataset(groupId: string, datasetId: string) {
  const { supabase, user } = await requireUser();
  const { data: row } = await supabase.from("group_datasets").select("added_by").eq("group_id", groupId).eq("dataset_id", datasetId).maybeSingle();
  if (!row) return;
  if (row.added_by !== user.id && !canManage(await roleIn(supabase, groupId, user.id))) throw new Error("Only whoever linked it, or an admin, can unlink it.");
  await supabase.from("group_datasets").delete().eq("group_id", groupId).eq("dataset_id", datasetId);
  revalidatePath(`/groups/${groupId}`);
}

// ── shared files ───────────────────────────────────────────────────────────

export async function uploadGroupFile(groupId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  await memberOrThrow(supabase, groupId, user.id);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(tab(groupId, "shared", "&error=nofile#files"));
  if (file.size > MAX_FILE_BYTES) redirect(tab(groupId, "shared", "&error=filesize#files"));
  const name = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 200) || "file";
  if (!allowedFile(name)) redirect(tab(groupId, "shared", "&error=filetype#files"));

  const id = randomUUID();
  const mime = file.type || "application/octet-stream";
  let path: string;
  if (isConfigured()) {
    path = `${groupId}/${id}/${name}`;
    const { error } = await supabase.storage.from(FILE_BUCKET).upload(path, file, { contentType: mime, upsert: false });
    if (error) redirect(tab(groupId, "shared", "&error=upload#files"));
  } else {
    // Demo mode has no storage: the file is kept inline.
    path = `data:${mime};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  }
  const { error } = await supabase.from("group_files").insert({
    id, group_id: groupId, uploaded_by: user.id, name, mime, size_bytes: file.size, path, note: text(form, "note", 500),
  });
  if (error) {
    if (isConfigured()) await supabase.storage.from(FILE_BUCKET).remove([path]);
    redirect(tab(groupId, "shared", "&error=upload#files"));
  }
  revalidatePath(`/groups/${groupId}`);
  redirect(tab(groupId, "shared", "&uploaded=1#files"));
}

export async function deleteGroupFile(groupId: string, fileId: string) {
  const { supabase, user } = await requireUser();
  const { data: f } = await supabase.from("group_files").select("uploaded_by, path").eq("id", fileId).eq("group_id", groupId).maybeSingle();
  if (!f) return;
  if (f.uploaded_by !== user.id && !canManage(await roleIn(supabase, groupId, user.id))) throw new Error("Only whoever uploaded it, or an admin, can delete it.");
  await supabase.from("group_files").delete().eq("id", fileId);
  if (isConfigured()) await supabase.storage.from(FILE_BUCKET).remove([f.path]);
  revalidatePath(`/groups/${groupId}`);
}
