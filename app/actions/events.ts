"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { overLimit } from "@/lib/ratelimit";
import { roleIn, isCurrent, canManage } from "@/lib/social/groups";
import { EVENT_KINDS, localToUtc, type EventKind } from "@/lib/events";
import { notifyNow, nameOf, quote } from "@/lib/notify";

/** Events in a group (members) or open to everyone (supabase/21-researcher.sql). */

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const where = (groupId: string | null) => (groupId ? `/groups/${groupId}?tab=events` : "/events");

export async function createEvent(groupId: string | null, form: FormData) {
  const { supabase, user } = await requireUser();
  const back = where(groupId);
  const sep = back.includes("?") ? "&" : "?";
  if (groupId && (!isRowId(groupId) || !isCurrent(await roleIn(supabase, groupId, user.id)))) throw new Error("Only members can add events to the group.");
  const title = text(form, "title", 200);
  const tz = text(form, "tz", 64) || "UTC";
  const starts_at = localToUtc(text(form, "starts", 16), tz);
  const endsRaw = text(form, "ends", 16);
  const ends_at = endsRaw ? localToUtc(endsRaw, tz) : null;
  const online_url = text(form, "online_url", 500);
  const kind = (EVENT_KINDS as readonly string[]).includes(String(form.get("kind"))) ? (String(form.get("kind")) as EventKind) : "talk";
  if (title.length < 2) redirect(`${back}${sep}error=title#new-event`);
  if (!starts_at) redirect(`${back}${sep}error=when#new-event`);
  if (endsRaw && (!ends_at || ends_at < starts_at)) redirect(`${back}${sep}error=end#new-event`);
  if (online_url && !/^https:\/\/[^\s]+$/.test(online_url)) redirect(`${back}${sep}error=url#new-event`);
  if (await overLimit(supabase, "event", user.id)) redirect(`${back}${sep}error=limit#new-event`);
  const { data, error } = await supabase.from("events").insert({
    group_id: groupId, kind, title, starts_at, ends_at, location: text(form, "location", 200), online_url, body: text(form, "body", 4000),
    created_by: user.id, created_at: new Date().toISOString(),
  }).select("id").single();
  if (error || !data) redirect(`${back}${sep}error=save#new-event`);
  // Whoever adds it is going; the group hears about it right away.
  await supabase.from("event_attendees").insert({ event_id: data.id, user_id: user.id, status: "going", created_at: new Date().toISOString() });
  if (groupId) {
    const { data: members } = await supabase.from("group_members").select("user_id, role").eq("group_id", groupId);
    const { data: g } = await supabase.from("groups").select("name").eq("id", groupId).maybeSingle();
    await notifyNow((members ?? []).filter((m: any) => isCurrent(m.role)).map((m: any) => m.user_id),
      { kind: "event", title: `${await nameOf(supabase, user.id)} added ${quote(title)} in ${g?.name ?? "your group"}`, body: new Date(starts_at).toUTCString(), href: `${back}#ev-${data.id}` }, user.id);
  }
  revalidatePath(back.split("?")[0]);
  revalidatePath("/events");
  redirect(`${back}${sep}added=1#ev-${data.id}`);
}

export async function deleteEvent(eventId: string) {
  const { supabase, user } = await requireUser();
  if (!isRowId(eventId)) return;
  const { data: e } = await supabase.from("events").select("created_by, group_id").eq("id", eventId).maybeSingle();
  if (!e) return;
  const owner = e.group_id ? canManage(await roleIn(supabase, e.group_id, user.id)) : false;
  if (e.created_by !== user.id && !owner) throw new Error("Only whoever added it, or the group's lead, can delete it.");
  await supabase.from("event_attendees").delete().eq("event_id", eventId);
  await supabase.from("events").delete().eq("id", eventId);
  if (e.group_id) revalidatePath(`/groups/${e.group_id}`);
  revalidatePath("/events");
}

/** Going, maybe, or not (null). */
export async function rsvp(eventId: string, status: "going" | "maybe" | null) {
  const { supabase, user } = await requireUser();
  if (!isRowId(eventId)) return;
  const { data: e } = await supabase.from("events").select("group_id").eq("id", eventId).maybeSingle();
  if (!e) return;
  if (e.group_id && !isCurrent(await roleIn(supabase, e.group_id, user.id))) return;
  await supabase.from("event_attendees").delete().eq("event_id", eventId).eq("user_id", user.id);
  if (status) await supabase.from("event_attendees").insert({ event_id: eventId, user_id: user.id, status, created_at: new Date().toISOString() });
  if (e.group_id) revalidatePath(`/groups/${e.group_id}`);
  revalidatePath("/events");
}
