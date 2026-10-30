"use server";

import { revalidatePath } from "next/cache";
import { requireUser, sessionUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { isReaction, type ReactionTarget } from "@/lib/social/reactions";
import { unseenCount } from "@/lib/social/notifications";
import { canReadPost } from "@/lib/social/groups";

/**
 * Following and reactions. Both are small, reversible and private enough
 * that they need no confirmation: the follow is seen only by the two people,
 * a reaction can be taken back with the same click.
 */

export async function setFollow(personId: string, follow: boolean) {
  const { supabase, user } = await requireUser();
  if (!isRowId(personId) || personId === user.id) return { error: "You cannot follow that." };
  if (follow) {
    const { data: already } = await supabase.from("follows").select("followee_id")
      .eq("follower_id", user.id).eq("followee_id", personId).maybeSingle();
    if (!already) {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, followee_id: personId });
      if (error) return { error: error.message };
    }
  } else {
    await supabase.from("follows").delete().eq("follower_id", user.id).eq("followee_id", personId);
  }
  revalidatePath(`/people/${personId}`);
  revalidatePath("/network");
  revalidatePath("/home");
  return { ok: true as const };
}

/** Toggle one reaction on a post or an answer. */
export async function toggleReaction(kind: ReactionTarget, targetId: string, reaction: string, path: string) {
  const { supabase, user } = await requireUser();
  if ((kind !== "post" && kind !== "answer") || !isRowId(targetId) || !isReaction(reaction)) return { error: "Unknown reaction." };

  // Only on something that exists, and never on your own words.
  const { data: target } = await supabase.from(kind === "post" ? "posts" : "answers").select("*").eq("id", targetId).maybeSingle();
  if (!target || (kind === "post" && !(await canReadPost(supabase, target as any, user.id)))) return { error: "That no longer exists." };
  if (target.author_id === user.id) return { error: "You cannot react to your own post." };

  const { data: mine } = await supabase.from("reactions").select("id")
    .eq("user_id", user.id).eq("target_kind", kind).eq("target_id", targetId).eq("kind", reaction).maybeSingle();
  if (mine) await supabase.from("reactions").delete().eq("id", mine.id);
  else await supabase.from("reactions").insert({ user_id: user.id, target_kind: kind, target_id: targetId, kind: reaction });
  if (path.startsWith("/")) revalidatePath(path.split("?")[0]);
  return { ok: true as const, on: !mine };
}

/** The badge on the bell. Quiet when signed out: it is polled, not navigated to. */
export async function unseenNotifications(): Promise<number> {
  const { supabase, user } = await sessionUser();
  if (!user) return 0;
  const { data } = await supabase.from("profiles").select("notifications_seen_at").eq("id", user.id).maybeSingle();
  return unseenCount(supabase, user.id, data?.notifications_seen_at);
}

/** Names for the @mention suggestions in the composer, best match first. */
export async function suggestPeople(prefix: string): Promise<{ id: string; name: string; institution: string }[]> {
  const { supabase, user } = await sessionUser();
  const term = String(prefix ?? "").replace(/[%_,()]/g, "").trim().slice(0, 40);
  if (!user || term.length < 1) return [];
  const { data } = await supabase.from("profiles").select("id, display_name, institution")
    .ilike("display_name", `%${term}%`).neq("id", user.id).limit(20);
  const t = term.toLowerCase();
  return (data ?? [])
    .map((p: any) => ({ id: p.id, name: p.display_name as string, institution: (p.institution ?? "") as string }))
    .filter((p) => p.name)
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(t)) - Number(!b.name.toLowerCase().startsWith(t)) || a.name.localeCompare(b.name))
    .slice(0, 6);
}
