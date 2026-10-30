"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { roleIn, canManage, isRole } from "@/lib/social/groups";
import { redeemInvite } from "@/lib/social/invites";
import { sendToMember } from "@/lib/mail";

/**
 * Groups: a lab, a consortium, a journal club. Anyone can create one and
 * becomes its lead (role "owner"). Open groups can be joined by anyone;
 * closed groups through a request, an invitation or by being added. Roles
 * are owner, admin, member, guest and alumni (lib/social/groups.ts). Every
 * rule here is enforced again by the database (supabase/08, 10 and 11);
 * these checks give a sentence instead of an error.
 */

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

/** Owners and admins manage the group; the name is kept from when only owners did. */
async function ownerOf(supabase: any, groupId: string, userId: string) {
  return canManage(await roleIn(supabase, groupId, userId));
}
async function leadOf(supabase: any, groupId: string, userId: string) {
  return (await roleIn(supabase, groupId, userId)) === "owner";
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
  if (name.length < 2) redirect(`/groups/${groupId}?tab=members&error=name#settings`);
  await supabase.from("groups").update({
    name, description: text(form, "description", 1000), institution: text(form, "institution", 200),
    access: form.get("access") === "closed" ? "closed" : "open",
  }).eq("id", groupId);
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}?tab=members&saved=1#settings`);
}

export async function joinGroup(groupId: string) {
  const { supabase, user } = await requireUser();
  const { data: g } = await supabase.from("groups").select("access").eq("id", groupId).maybeSingle();
  if (!g) throw new Error("That group no longer exists.");
  if (g.access !== "open") redirect(`/groups/${groupId}?error=closed`);
  const role = await roleIn(supabase, groupId, user.id);
  if (role === "alumni") await supabase.from("group_members").update({ role: "member", joined_at: new Date().toISOString() }).eq("group_id", groupId).eq("user_id", user.id);
  else if (!role) await supabase.from("group_members").insert({ group_id: groupId, user_id: user.id, role: "member" });
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
}

/**
 * Leave a group. You become alumni: what you did for the group stays
 * credited to you, and you no longer see its discussions. The last lead
 * cannot leave; they hand over first or delete the group.
 */
export async function leaveGroup(groupId: string) {
  const { supabase, user } = await requireUser();
  const role = await roleIn(supabase, groupId, user.id);
  if (!role || role === "alumni") redirect(`/groups/${groupId}`);
  if (role === "owner") {
    const { data: owners } = await supabase.from("group_members").select("user_id").eq("group_id", groupId).eq("role", "owner");
    if ((owners ?? []).length <= 1) redirect(`/groups/${groupId}?error=lastowner`);
  }
  await supabase.from("group_members").update({ role: "alumni" }).eq("group_id", groupId).eq("user_id", user.id);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
  redirect(`/groups/${groupId}?left=1`);
}

/** Admins change someone's role: admin, member, guest or alumni; only a lead makes or unmakes leads. */
export async function setRole(groupId: string, personId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const next = String(form.get("role") ?? "");
  if (!isRole(next) || !isRowId(personId)) return;
  const mine = await roleIn(supabase, groupId, user.id);
  const theirs = await roleIn(supabase, groupId, personId);
  if (!canManage(mine) || !theirs) throw new Error("Only a lead or an admin can change roles.");
  if ((next === "owner" || theirs === "owner") && mine !== "owner") redirect(`/groups/${groupId}?tab=members&error=leadonly`);
  if (theirs === "owner" && next !== "owner") {
    const { data: owners } = await supabase.from("group_members").select("user_id").eq("group_id", groupId).eq("role", "owner");
    if ((owners ?? []).length <= 1) redirect(`/groups/${groupId}?tab=members&error=lastowner`);
  }
  await supabase.from("group_members").update({ role: next }).eq("group_id", groupId).eq("user_id", personId);
  revalidatePath(`/groups/${groupId}`);
}

/** Remove someone from the group entirely (not even alumni), or remove yourself. The last lead cannot go. */
export async function removeMember(groupId: string, userId: string) {
  const { supabase, user } = await requireUser();
  if (!isRowId(userId)) return;
  const self = userId === user.id;
  if (!self && !(await ownerOf(supabase, groupId, user.id))) throw new Error("Only a lead or an admin can remove members.");
  if (!self && (await roleIn(supabase, groupId, userId)) === "owner" && !(await leadOf(supabase, groupId, user.id))) redirect(`/groups/${groupId}?tab=members&error=leadonly`);
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
  if (!person) redirect(`/groups/${groupId}?tab=members&error=person`);
  const { data: already } = await supabase.from("group_members").select("user_id").eq("group_id", groupId).eq("user_id", personId).maybeSingle();
  const role = String(form.get("role") ?? "member");
  const asRole = role === "owner" && (await leadOf(supabase, groupId, user.id)) ? "owner" : ["admin", "member", "guest"].includes(role) ? role : "member";
  if (!already) await supabase.from("group_members").insert({ group_id: groupId, user_id: personId, role: asRole });
  else await supabase.from("group_members").update({ role: asRole }).eq("group_id", groupId).eq("user_id", personId);
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}?tab=members&added=1`);
}

/** A member links one of their own method cards to the group; current
 *  members can then read it, also when it is private or lab-only. */
export async function linkMethod(groupId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const cardId = String(form.get("card") ?? "");
  const [{ data: member }, { data: card }] = await Promise.all([
    supabase.from("group_members").select("user_id").eq("group_id", groupId).eq("user_id", user.id).neq("role", "alumni").maybeSingle(),
    isRowId(cardId) ? supabase.from("method_cards").select("id").eq("id", cardId).eq("author_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!member || !card) throw new Error("You can only link your own method cards to a group you are in.");
  const { data: already } = await supabase.from("group_methods").select("card_id").eq("group_id", groupId).eq("card_id", cardId).maybeSingle();
  if (!already) await supabase.from("group_methods").insert({ group_id: groupId, card_id: cardId, added_by: user.id });
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/methods/${cardId}`);
}

export async function unlinkMethod(groupId: string, cardId: string) {
  const { supabase, user } = await requireUser();
  const { data: row } = await supabase.from("group_methods").select("added_by").eq("group_id", groupId).eq("card_id", cardId).maybeSingle();
  if (!row) return;
  if (row.added_by !== user.id && !(await ownerOf(supabase, groupId, user.id))) throw new Error("Only whoever linked it, or an admin, can unlink it.");
  await supabase.from("group_methods").delete().eq("group_id", groupId).eq("card_id", cardId);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/methods/${cardId}`);
}

/** A member shares one of their own projects with the group. */
export async function addGroupProject(groupId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const projectId = String(form.get("project") ?? "");
  const [{ data: member }, { data: onProject }] = await Promise.all([
    supabase.from("group_members").select("user_id").eq("group_id", groupId).eq("user_id", user.id).neq("role", "alumni").maybeSingle(),
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
  if (!(await leadOf(supabase, groupId, user.id))) throw new Error("Only a lead can delete the group.");
  if (text(form, "confirm", 20).toUpperCase() !== "DELETE") redirect(`/groups/${groupId}?tab=members&error=confirm#settings`);
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
  const current = await roleIn(supabase, groupId, user.id);
  if (current && current !== "alumni") redirect(`/groups/${groupId}`);
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
    const role = await roleIn(supabase, groupId, personId);
    if (role === "alumni") await supabase.from("group_members").update({ role: "member" }).eq("group_id", groupId).eq("user_id", personId);
    else if (!role) await supabase.from("group_members").insert({ group_id: groupId, user_id: personId, role: "member" });
  }
  await supabase.from("group_requests").delete().eq("group_id", groupId).eq("user_id", personId);
  revalidatePath(`/groups/${groupId}`);
}

// ── invitations ──────────────────────────────────────────────────────────

/**
 * An invitation link, optionally e-mailed. Admins choose the role it grants,
 * how many people may use it and for how long. The link works for people
 * without an account too: they sign up and land back on it.
 */
export async function createInvite(groupId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  if (!(await ownerOf(supabase, groupId, user.id))) throw new Error("Only a lead or an admin can invite.");
  const role = ["admin", "member", "guest"].includes(String(form.get("role"))) ? String(form.get("role")) : "member";
  const email = text(form, "email", 200).toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect(`/groups/${groupId}?tab=members&error=email#invite`);
  const uses = email ? 1 : Math.min(500, Math.max(1, Number(form.get("uses")) || 25));
  const days = Math.min(90, Math.max(1, Number(form.get("days")) || 14));
  const token = randomBytes(18).toString("base64url");
  const { error } = await supabase.from("group_invites").insert({
    token, group_id: groupId, created_by: user.id, role, email: email || null, max_uses: uses,
    expires_at: new Date(Date.now() + days * 864e5).toISOString(), uses: 0, created_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  let mailed = "";
  if (email) {
    const [{ data: g }, { data: me }] = await Promise.all([
      supabase.from("groups").select("name").eq("id", groupId).maybeSingle(),
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    ]);
    const link = `${await siteOrigin()}/join/${token}`;
    const sent = await sendToMember({ email, name: email }, `${me?.display_name ?? "A colleague"} invites you to ${g?.name ?? "a group"} on SciCollab`,
      `Hello,\n\n${me?.display_name ?? "A colleague"} invites you to join ${g?.name ?? "their group"} on SciCollab, where researchers exchange ideas, discuss their work and share data and methods.\n\nJoin here (the link works once and for ${days} days):\n${link}\n\nIf you have no account yet, you can create one from that page.\n`);
    mailed = sent.ok ? "&mailed=1" : "&mailed=0";
  }
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}?tab=members&invite=${token}${mailed}#invite`);
}

export async function revokeInvite(groupId: string, token: string) {
  const { supabase, user } = await requireUser();
  if (!(await ownerOf(supabase, groupId, user.id))) throw new Error("Only a lead or an admin can revoke invitations.");
  await supabase.from("group_invites").delete().eq("group_id", groupId).eq("token", token);
  revalidatePath(`/groups/${groupId}`);
}

/** Accept an invitation (from /join/[token]). */
export async function acceptInvite(token: string) {
  const { user } = await requireUser();
  const groupId = await redeemInvite(token, user.id);
  if (!groupId) redirect(`/join/${encodeURIComponent(token)}?error=invalid`);
  revalidatePath("/groups");
  redirect(`/groups/${groupId}?welcome=1`);
}

async function siteOrigin() {
  const h = await headers();
  return process.env.SCICOLLAB_SITE_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}
