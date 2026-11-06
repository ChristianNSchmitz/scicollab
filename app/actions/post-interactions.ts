"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { sessionUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { checkMessage } from "@/app/actions/messages";
import { MESSAGE_PROBLEM } from "@/lib/messages";
import { canReadPost } from "@/lib/social/groups";
import { peopleById } from "@/lib/people";

/**
 * Responding to a post beyond reactions and replies (supabase/14): repost it
 * to your followers, save it for later, send it to someone. Posts inside a
 * group stay there, so they are neither reposted nor sent.
 */

type Result = { ok: true } | { error: string };

async function openPost(supabase: any, postId: string) {
  if (!isRowId(postId)) return null;
  const { data } = await supabase.from("posts").select("id, title, author_id, group_id, audience").eq("id", postId).maybeSingle();
  return data as { id: string; title: string; author_id: string; group_id: string | null; audience?: string } | null;
}

export async function repost(postId: string, note: string): Promise<Result> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Sign in first." };
  const post = await openPost(supabase, postId);
  if (!post) return { error: "That post is gone." };
  if (post.group_id) return { error: "Posts in a group stay in the group." };
  if (post.audience === "people") return { error: "This post is only for the people its author chose." };
  if (post.author_id === user.id) return { error: "This is your own post." };
  const { data: had } = await supabase.from("post_reposts").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
  const text = String(note ?? "").trim().slice(0, 1000);
  const { error } = had
    ? await supabase.from("post_reposts").update({ note: text }).eq("post_id", postId).eq("user_id", user.id)
    : await supabase.from("post_reposts").insert({ post_id: postId, user_id: user.id, note: text });
  if (error) return { error: "The repost did not go through." };
  revalidatePath("/home");
  return { ok: true };
}

export async function undoRepost(postId: string): Promise<Result> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Sign in first." };
  await supabase.from("post_reposts").delete().eq("post_id", postId).eq("user_id", user.id);
  revalidatePath("/home");
  return { ok: true };
}

export async function setSaved(postId: string, save: boolean): Promise<Result> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Sign in first." };
  if (save) {
    if (!(await openPost(supabase, postId))) return { error: "That post is gone." };
    const { data: had } = await supabase.from("saved_posts").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
    if (!had) await supabase.from("saved_posts").insert({ user_id: user.id, post_id: postId });
  } else {
    await supabase.from("saved_posts").delete().eq("post_id", postId).eq("user_id", user.id);
  }
  revalidatePath("/you/saved");
  return { ok: true };
}

/** Send a post to someone as a direct message, with a line of your own. */
export async function sendPost(postId: string, personId: string, note: string): Promise<Result> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Sign in first." };
  if (!isRowId(personId) || personId === user.id) return { error: "Pick someone to send it to." };
  const post = await openPost(supabase, postId);
  if (!post) return { error: "That post is gone." };
  if (post.group_id) return { error: "Posts in a group stay in the group." };
  if (post.audience === "people") return { error: "This post is only for the people its author chose." };
  const h = await headers();
  const base = process.env.SCICOLLAB_SITE_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const body = [String(note ?? "").trim().slice(0, 1500), `${post.title}\n${base}/posts/${post.id}`].filter(Boolean).join("\n\n");
  const problem = await checkMessage(personId, body, null);
  if (problem) return { error: MESSAGE_PROBLEM[problem] };
  const { error } = await supabase.from("messages").insert({ sender_id: user.id, recipient_id: personId, body });
  return error ? { error: "The message did not go through." } : { ok: true };
}

/** A post's replies, oldest first, for "View all replies" in a feed (only for whoever may read the post). */
export async function threadOf(postId: string): Promise<{ replies: { id: string; body: string; created_at: string; helped: boolean; author: { display_name: string; avatar_url: string | null } | null }[] } | { error: string }> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Sign in first." };
  if (!isRowId(postId)) return { error: "That post is gone." };
  const { data: post } = await supabase.from("posts").select("id, group_id, audience, author_id").eq("id", postId).maybeSingle();
  if (!post || !(await canReadPost(supabase, post, user.id))) return { error: "That post is gone." };
  const { data } = await supabase.from("post_replies").select("id, author_id, body, created_at, helped_at").eq("post_id", postId).order("created_at", { ascending: true }).limit(100);
  const people = await peopleById(supabase, (data ?? []).map((r: any) => r.author_id));
  return {
    replies: (data ?? []).map((r: any) => {
      const a = people.get(r.author_id);
      return { id: r.id, body: r.body, created_at: r.created_at, helped: !!r.helped_at, author: a ? { display_name: a.display_name, avatar_url: a.avatar_url ?? null } : null };
    }),
  };
}
