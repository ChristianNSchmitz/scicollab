"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isRowId } from "@/lib/query";

/**
 * Groups: a lab, a consortium, a journal club. Anyone can create one and
 * becomes its owner. Open groups can be joined by anyone; closed groups by
 * being added by an owner. Every rule here is enforced again by the database
 * (supabase/08-social.sql); these checks give a sentence instead of an error.
 */

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

async function ownerOf(supabase: any, groupId: string, userId: string) {
  const { data } = await supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  return data?.role === "owner";
}

export async function createGroup(form: FormData) {
  const { supabase, user } = await requireUser();
  const name = text(form, "name", 120);
  if (name.length < 2) redirect("/groups?error=name#new");
  const { data, error } = await supabase.from("groups").insert({
    name, description: text(form, "description", 1000), institution: text(form, "institution", 200),
    access: form.get("access") === "closed" ? "closed" : "open", created_by: user.id,
  }).select("id").single();
  if (error) throw new Error(error.message);
  await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id, role: "owner" });
  revalidatePath("/groups");
  redirect(`/groups/${data.id}`);
}

export async function updateGroup(groupId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  if (!(await ownerOf(supabase, groupId, user.id))) throw new Error("Only an owner can change the group.");
  const name = text(form, "name", 120);
  if (name.length < 2) redirect(`/groups/${groupId}?error=name`);
  await supabase.from("groups").update({
    name, description: text(form, "description", 1000), institution: text(form, "institution", 200),
    access: form.get("access") === "closed" ? "closed" : "open",
  }).eq("id", groupId);
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}?saved=1`);
}

export async function joinGroup(groupId: string) {
  const { supabase, user } = await requireUser();
  const { data: g } = await supabase.from("groups").select("access").eq("id", groupId).maybeSingle();
  if (!g) throw new Error("That group no longer exists.");
  if (g.access !== "open") redirect(`/groups/${groupId}?error=closed`);
  const { data: already } = await supabase.from("group_members").select("user_id").eq("group_id", groupId).eq("user_id", user.id).maybeSingle();
  if (!already) await supabase.from("group_members").insert({ group_id: groupId, user_id: user.id, role: "member" });
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
}

/** Leave a group, or (as an owner) remove someone. The last owner cannot leave. */
export async function removeMember(groupId: string, userId: string) {
  const { supabase, user } = await requireUser();
  if (!isRowId(userId)) return;
  const self = userId === user.id;
  if (!self && !(await ownerOf(supabase, groupId, user.id))) throw new Error("Only an owner can remove members.");
  const { data: owners } = await supabase.from("group_members").select("user_id").eq("group_id", groupId).eq("role", "owner");
  if ((owners ?? []).length === 1 && owners![0].user_id === userId) redirect(`/groups/${groupId}?error=lastowner`);
  await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
  if (self) redirect("/groups");
}

/** An owner adds a member by picking their name. */
export async function addMember(groupId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  if (!(await ownerOf(supabase, groupId, user.id))) throw new Error("Only an owner can add members.");
  const personId = String(form.get("person") ?? "");
  const { data: person } = isRowId(personId) ? await supabase.from("profiles").select("id").eq("id", personId).maybeSingle() : { data: null };
  if (!person) redirect(`/groups/${groupId}?error=person#members`);
  const { data: already } = await supabase.from("group_members").select("user_id").eq("group_id", groupId).eq("user_id", personId).maybeSingle();
  if (!already) await supabase.from("group_members").insert({ group_id: groupId, user_id: personId, role: form.get("owner") === "on" ? "owner" : "member" });
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}?added=1#members`);
}

/** A member shares one of their own projects with the group. */
export async function addGroupProject(groupId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const projectId = String(form.get("project") ?? "");
  const [{ data: member }, { data: onProject }] = await Promise.all([
    supabase.from("group_members").select("user_id").eq("group_id", groupId).eq("user_id", user.id).maybeSingle(),
    isRowId(projectId) ? supabase.from("project_members").select("user_id").eq("project_id", projectId).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!member || !onProject) throw new Error("You can only add your own projects to a group you are in.");
  const { data: already } = await supabase.from("group_projects").select("project_id").eq("group_id", groupId).eq("project_id", projectId).maybeSingle();
  if (!already) await supabase.from("group_projects").insert({ group_id: groupId, project_id: projectId, added_by: user.id });
  revalidatePath(`/groups/${groupId}`);
}

export async function removeGroupProject(groupId: string, projectId: string) {
  const { supabase, user } = await requireUser();
  const { data: row } = await supabase.from("group_projects").select("added_by").eq("group_id", groupId).eq("project_id", projectId).maybeSingle();
  if (!row) return;
  if (row.added_by !== user.id && !(await ownerOf(supabase, groupId, user.id))) throw new Error("Only whoever added it, or an owner, can remove it.");
  await supabase.from("group_projects").delete().eq("group_id", groupId).eq("project_id", projectId);
  revalidatePath(`/groups/${groupId}`);
}

export async function deleteGroup(groupId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  if (!(await ownerOf(supabase, groupId, user.id))) throw new Error("Only an owner can delete the group.");
  if (text(form, "confirm", 20).toUpperCase() !== "DELETE") redirect(`/groups/${groupId}?error=confirm#settings`);
  // The group first, while you are still its owner. The database cascades
  // to members and projects; the demo store does not, hence the two after.
  await supabase.from("groups").delete().eq("id", groupId);
  await supabase.from("group_projects").delete().eq("group_id", groupId);
  await supabase.from("group_members").delete().eq("group_id", groupId);
  revalidatePath("/groups");
  redirect("/groups?deleted=1");
}

/** Ask to join a closed group; the owners see it on the group page and in their notifications. */
export async function requestToJoin(groupId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const { data: member } = await supabase.from("group_members").select("user_id").eq("group_id", groupId).eq("user_id", user.id).maybeSingle();
  if (member) redirect(`/groups/${groupId}`);
  const { data: already } = await supabase.from("group_requests").select("user_id").eq("group_id", groupId).eq("user_id", user.id).maybeSingle();
  if (!already) {
    await supabase.from("group_requests").insert({ group_id: groupId, user_id: user.id, message: text(form, "message", 500) });
  }
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}?requested=1`);
}

export async function withdrawRequest(groupId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("group_requests").delete().eq("group_id", groupId).eq("user_id", user.id);
  revalidatePath(`/groups/${groupId}`);
}

/** An owner lets someone in, or says no. Either way the request is gone. */
export async function answerRequest(groupId: string, personId: string, approve: boolean) {
  const { supabase, user } = await requireUser();
  if (!(await ownerOf(supabase, groupId, user.id))) throw new Error("Only an owner can answer requests.");
  if (approve) {
    const { data: already } = await supabase.from("group_members").select("user_id").eq("group_id", groupId).eq("user_id", personId).maybeSingle();
    if (!already) await supabase.from("group_members").insert({ group_id: groupId, user_id: personId, role: "member" });
  }
  await supabase.from("group_requests").delete().eq("group_id", groupId).eq("user_id", personId);
  revalidatePath(`/groups/${groupId}`);
}
