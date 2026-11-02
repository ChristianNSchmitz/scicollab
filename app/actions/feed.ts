"use server";

import { revalidatePath } from "next/cache";
import { sessionUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { MUTE_KINDS, type MuteKind } from "@/lib/posts/mutes";

/**
 * Taking things out of your own feed (supabase/18-feed-mutes.sql): one post
 * ("Not interested"), a topic group or a person. Only you see the effect,
 * and every mute can be undone from the feed's Filter.
 */

type Result = { ok: true } | { error: string };

const valid = (kind: unknown, target: unknown): kind is MuteKind =>
  MUTE_KINDS.includes(kind as MuteKind) && (kind === "room" ? typeof target === "string" && /^[a-z0-9-]{1,64}$/.test(target) : isRowId(target));

export async function mute(kind: MuteKind, target: string): Promise<Result> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Sign in first." };
  if (!valid(kind, target)) return { error: "That cannot be muted." };
  if (kind === "person" && target === user.id) return { error: "You cannot mute yourself." };
  const { data: had } = await supabase.from("feed_mutes").select("target").eq("user_id", user.id).eq("kind", kind).eq("target", target).maybeSingle();
  if (!had) {
    const { error } = await supabase.from("feed_mutes").insert({ user_id: user.id, kind, target, created_at: new Date().toISOString() });
    if (error) return { error: "That did not work, try again." };
  }
  revalidatePath("/home");
  return { ok: true };
}

export async function unmute(kind: MuteKind, target: string): Promise<Result> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Sign in first." };
  if (!valid(kind, target)) return { error: "Nothing to undo." };
  await supabase.from("feed_mutes").delete().eq("user_id", user.id).eq("kind", kind).eq("target", target);
  revalidatePath("/home");
  return { ok: true };
}
