"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { MAX_CHAT_PEOPLE } from "@/lib/social/chats";

/** Small chats for three to five people (supabase/15). The database enforces the same limits. */

const ids = (form: FormData, key: string, me: string) =>
  [...new Set(form.getAll(key).map(String).filter((id) => isRowId(id) && id !== me))];

async function memberOf(supabase: any, roomId: string, userId: string) {
  const { data } = await supabase.from("chat_room_members").select("user_id").eq("room_id", roomId).eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function createChat(form: FormData) {
  const { supabase, user } = await requireUser();
  const people = ids(form, "people", user.id);
  if (people.length < 2) redirect("/chats/new?error=few");
  if (people.length > MAX_CHAT_PEOPLE - 1) redirect("/chats/new?error=many");
  const { data: found } = await supabase.from("profiles").select("id").in("id", people);
  if ((found ?? []).length !== people.length) redirect("/chats/new?error=person");
  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  const { data: room, error } = await supabase.from("chat_rooms").insert({ title, created_by: user.id }).select("id").single();
  if (error || !room) throw new Error("The chat could not be created.");
  const now = new Date().toISOString();
  // The creator first: from then on the creator is a member and adds the others.
  await supabase.from("chat_room_members").insert({ room_id: room.id, user_id: user.id, added_by: user.id, joined_at: now, last_read_at: now });
  for (const p of people) await supabase.from("chat_room_members").insert({ room_id: room.id, user_id: p, added_by: user.id, joined_at: now, last_read_at: null });
  const first = String(form.get("first") ?? "").trim().slice(0, 4000);
  if (first) await supabase.from("chat_room_messages").insert({ room_id: room.id, author_id: user.id, body: first });
  revalidatePath("/messages");
  redirect(`/chats/${room.id}`);
}

export async function sendChatRoomMessage(roomId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  if (!(await memberOf(supabase, roomId, user.id))) throw new Error("You are not in this chat.");
  const body = String(form.get("body") ?? "").trim().slice(0, 4000);
  if (body) {
    await supabase.from("chat_room_messages").insert({ room_id: roomId, author_id: user.id, body });
    await supabase.from("chat_room_members").update({ last_read_at: new Date().toISOString() }).eq("room_id", roomId).eq("user_id", user.id);
  }
  revalidatePath(`/chats/${roomId}`);
  redirect(`/chats/${roomId}#latest`);
}

export async function addToChat(roomId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  if (!(await memberOf(supabase, roomId, user.id))) throw new Error("You are not in this chat.");
  const { data: members } = await supabase.from("chat_room_members").select("user_id").eq("room_id", roomId);
  const current = new Set((members ?? []).map((m: any) => m.user_id));
  const add = ids(form, "people", user.id).filter((p) => !current.has(p));
  if (current.size + add.length > MAX_CHAT_PEOPLE) redirect(`/chats/${roomId}?error=many`);
  for (const p of add) await supabase.from("chat_room_members").insert({ room_id: roomId, user_id: p, added_by: user.id, joined_at: new Date().toISOString(), last_read_at: null });
  revalidatePath(`/chats/${roomId}`);
  redirect(`/chats/${roomId}?added=1`);
}

export async function renameChat(roomId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  if (!(await memberOf(supabase, roomId, user.id))) throw new Error("You are not in this chat.");
  await supabase.from("chat_rooms").update({ title: String(form.get("title") ?? "").trim().slice(0, 120) }).eq("id", roomId);
  revalidatePath(`/chats/${roomId}`);
}

export async function leaveChat(roomId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("chat_room_members").delete().eq("room_id", roomId).eq("user_id", user.id);
  revalidatePath("/messages");
  redirect("/messages?left=1");
}
